from datetime import datetime, timezone
from decimal import Decimal
import unicodedata
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.client import Client
from app.models.enums import (
    DeliveryStatus,
    FinancialStatus,
    OutsourcingStatus,
    PayoutStatus,
    ProductionEventType,
    ProductionStatus,
    SewingMode,
    StockMovementType,
    WeeklyClosingStatus,
)
from app.models.order import (
    Order,
    OrderItem,
    OrderItemService,
    OrderPayment,
    OrderService,
    ProductionEvent,
)
from app.models.outsourcing import OrderOutsourcing, Outsourcer
from app.models.product import Product
from app.models.service import Service
from app.models.size import Size
from app.models.user import User
from app.models.weekly_closing import WeeklyClosing
from app.schemas.order import (
    CutPieceAllocation,
    CutPieceReturn,
    CutRegister,
    ItemQuantityRegister,
    OperationalAdjustmentRegister,
    OperationalEventRegister,
    OperationalHistoryEntry,
    OrderCreate,
    OrderItemCancel,
    OrderRead,
    OrderSummary,
    OrderUpdate,
    PaymentCreate,
    PrintRegister,
    SewingRegister,
)
from app.schemas.outsourcing import (
    OrderOutsourcingRead,
    OutsourcingCreate,
    OutsourcingPayout,
    OutsourcingReturn,
)
from app.schemas.report import ClientOrderReport, InternalOrderReport
from app.services.reports import (
    build_client_order_report,
    build_internal_order_report,
    generate_client_order_report_pdf,
    generate_internal_order_report_pdf,
)
from app.services.deliveries import (
    ready_to_deliver_quantity,
    sync_item_delivery_status,
    sync_order_items_delivery_status,
)
from app.services.stock import (
    get_piece_stock_items_for_order_item,
    get_or_create_piece_stock_item_for_order_item,
    register_stock_movement,
)

router = APIRouter(dependencies=[Depends(get_current_user)])

MONEY_QUANTIZER = Decimal("0.01")
LEGACY_MULTI_ITEM_OPERATION_MESSAGE = "Esta operação deve ser executada por item em OS multi-itens."
STATUS_ORDER = {
    ProductionStatus.CREATED: 0,
    ProductionStatus.IN_PROGRESS: 1,
    ProductionStatus.MIXED: 2,
    ProductionStatus.IN_CUT: 3,
    ProductionStatus.CUT_DONE: 4,
    ProductionStatus.WAITING_PRINT: 5,
    ProductionStatus.IN_PRINT: 6,
    ProductionStatus.PRINT_DONE: 7,
    ProductionStatus.WAITING_SEWING: 8,
    ProductionStatus.IN_SEWING: 9,
    ProductionStatus.SEWING_DONE: 10,
    ProductionStatus.OUTSOURCED: 11,
    ProductionStatus.RETURNED: 12,
    ProductionStatus.PARTIAL_READY: 13,
    ProductionStatus.READY: 14,
    ProductionStatus.DELIVERED: 15,
    ProductionStatus.CANCELLED: 16,
}


@router.post("", response_model=OrderRead, status_code=201)
def create_order(
    payload: OrderCreate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
) -> Order:
    items_with_services = _ensure_order_references_exist(db, payload)
    first_item = items_with_services[0][0]

    order = Order(
        client_id=payload.client_id,
        product_id=first_item.product_id,
        size_id=first_item.size_id,
        color=first_item.color,
        quantity_requested=first_item.quantity_requested,
        quantity_cut=0,
        quantity_extra=0,
        quantity_printed=0,
        quantity_sewn=0,
        allow_printing_exception=payload.allow_printing_exception,
        production_paused=False,
        lot=payload.lot,
        notes=payload.notes,
        production_status=ProductionStatus.CREATED,
        financial_status=FinancialStatus.PENDING,
        amount_paid=Decimal("0.00"),
    )

    total_amount = Decimal("0.00")
    for item_payload, services in items_with_services:
        order_item = OrderItem(
            product_id=item_payload.product_id,
            size_id=item_payload.size_id,
            color=item_payload.color,
            quantity_requested=item_payload.quantity_requested,
            quantity_cut=0,
            quantity_printed=0,
            quantity_sewn=0,
            operational_priority=item_payload.operational_priority,
            sewing_mode=_normalized_sewing_mode(item_payload, services),
            notes=item_payload.notes,
            dtf_notes=item_payload.dtf_notes,
        )
        order.items.append(order_item)

        for service in services:
            unit_price = _service_unit_price(item_payload, service)
            total_price = _money(unit_price * item_payload.quantity_requested)
            total_amount += total_price
            order.services.append(
                OrderService(
                    service_id=service.id,
                    quantity=item_payload.quantity_requested,
                    unit_price=unit_price,
                    total_price=total_price,
                )
            )
            order_item.services.append(
                OrderItemService(
                    service_id=service.id,
                    quantity=item_payload.quantity_requested,
                    unit_price=unit_price,
                    total_price=total_price,
                )
            )

    order.total_amount = _money(total_amount)
    order.amount_due = order.total_amount
    _sync_order_snapshot_from_items(order)

    db.add(order)
    db.commit()
    return _get_order_or_404(db, order.id)


@router.get("", response_model=list[OrderSummary])
def list_orders(db: Annotated[Session, Depends(get_db)]) -> list[Order]:
    query = (
        select(Order)
        .where(Order.production_status != ProductionStatus.CANCELLED)
        .options(
            selectinload(Order.client),
            selectinload(Order.client_order_group),
            selectinload(Order.product),
            selectinload(Order.size),
            selectinload(Order.items).selectinload(OrderItem.product),
            selectinload(Order.items).selectinload(OrderItem.size),
            selectinload(Order.items).selectinload(OrderItem.delivery_history),
            selectinload(Order.items)
            .selectinload(OrderItem.services)
            .selectinload(OrderItemService.service),
            selectinload(Order.outsourcings),
        )
        .order_by(Order.created_at.desc())
    )
    return list(db.scalars(query))


@router.get("/{order_id}", response_model=OrderRead)
def get_order(order_id: int, db: Annotated[Session, Depends(get_db)]) -> Order:
    return _get_order_or_404(db, order_id)


@router.put("/{order_id}", response_model=OrderRead)
def update_order(
    order_id: int,
    payload: OrderUpdate,
    db: Annotated[Session, Depends(get_db)],
) -> Order:
    order = _get_order_or_404(db, order_id)
    _ensure_order_is_not_in_closed_weekly_closing(db, order)

    if _order_has_movements(order):
        _ensure_order_group_client_matches(order, payload.client_id)
        _apply_safe_order_update(db, order, payload)
        db.commit()
        return _get_order_or_404(db, order.id)

    items_with_services = _ensure_order_references_exist(db, payload)
    _ensure_order_group_client_matches(order, payload.client_id)
    order.client_id = payload.client_id
    order.allow_printing_exception = payload.allow_printing_exception
    order.notes = payload.notes
    _replace_order_items(order, items_with_services)
    _sync_order_snapshot_from_items(order)
    _refresh_financials(order)

    db.commit()
    return _get_order_or_404(db, order.id)


@router.post(
    "/{order_id}/items/{item_id}/cancel",
    response_model=OrderRead,
    status_code=201,
)
def cancel_order_item(
    order_id: int,
    item_id: int,
    payload: OrderItemCancel,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> Order:
    order = _get_order_or_404(db, order_id, for_update=True)
    _ensure_order_is_not_in_closed_weekly_closing(db, order)
    _ensure_order_is_open_for_production_control(order)
    item = _get_order_item_or_404(order, item_id)

    if item.is_cancelled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este item ja esta cancelado.",
        )
    active_items = _active_order_items(order)
    if len(active_items) <= 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nao e possivel cancelar o ultimo item ativo. Cancele a OS inteira.",
        )
    if not _item_has_movements(order, item):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Item sem movimento deve ser removido pela edicao da OS.",
        )
    if item.quantity_delivered >= item.quantity_requested:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nao e possivel cancelar item totalmente entregue sem fluxo de estorno.",
        )

    committed_cut_quantity = _committed_cut_piece_quantity(order, item)
    if item.quantity_cut > committed_cut_quantity:
        returnable_quantity = item.quantity_cut - committed_cut_quantity
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Este item possui pecas destinadas sem processamento. "
                f"Devolva {returnable_quantity} peca(s) ao estoque antes de cancelar."
            ),
        )

    item.is_cancelled = True
    item.cancelled_at = _utcnow()
    item.cancel_reason = payload.reason
    _add_production_event(
        db,
        order=order,
        item=item,
        event_type=ProductionEventType.ORDER_ITEM_CANCELLED,
        stage="item_cancellation",
        quantity=item.quantity_requested,
        reason=payload.reason,
        notes=payload.reason,
        user=user,
    )
    _sync_order_totals(order)
    sync_order_items_delivery_status(order)
    _sync_order_status_after_quantity_update(db, order)

    db.commit()
    return _get_order_or_404(db, order.id)


@router.delete("/{order_id}", response_model=OrderRead)
def delete_order(
    order_id: int,
    db: Annotated[Session, Depends(get_db)],
) -> Order:
    order = _get_order_or_404(db, order_id)
    _ensure_order_is_not_in_closed_weekly_closing(db, order)

    if order.production_status != ProductionStatus.CANCELLED:
        _change_status(db, order, ProductionStatus.CANCELLED, None)

    db.commit()
    return _get_order_or_404(db, order.id)


@router.post("/{order_id}/pause-production", response_model=OrderRead, status_code=201)
def pause_order_production(
    order_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> Order:
    order = _get_order_or_404(db, order_id, for_update=True)
    _ensure_order_is_not_in_closed_weekly_closing(db, order)
    _ensure_order_is_open_for_production_control(order)
    if order.production_paused:
        return order

    order.production_paused = True
    _add_production_event(
        db,
        order=order,
        item=None,
        event_type=ProductionEventType.PRODUCTION_PAUSED,
        stage="production",
        notes="Producao pausada.",
        user=user,
    )
    db.commit()
    return _get_order_or_404(db, order.id)


@router.post("/{order_id}/resume-production", response_model=OrderRead, status_code=201)
def resume_order_production(
    order_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> Order:
    order = _get_order_or_404(db, order_id, for_update=True)
    _ensure_order_is_not_in_closed_weekly_closing(db, order)
    _ensure_order_is_open_for_production_control(order)
    if not order.production_paused:
        return order

    order.production_paused = False
    _add_production_event(
        db,
        order=order,
        item=None,
        event_type=ProductionEventType.PRODUCTION_RESUMED,
        stage="production",
        notes="Producao retomada.",
        user=user,
    )
    db.commit()
    return _get_order_or_404(db, order.id)


@router.get("/{order_id}/report/internal", response_model=InternalOrderReport)
def get_internal_order_report(
    order_id: int,
    db: Annotated[Session, Depends(get_db)],
) -> InternalOrderReport:
    order = _get_order_or_404(db, order_id)
    return build_internal_order_report(order)


@router.get("/{order_id}/report/client", response_model=ClientOrderReport)
def get_client_order_report(
    order_id: int,
    db: Annotated[Session, Depends(get_db)],
) -> ClientOrderReport:
    order = _get_order_or_404(db, order_id)
    return build_client_order_report(order)


@router.get("/{order_id}/report/internal/pdf")
def get_internal_order_report_pdf(
    order_id: int,
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    order = _get_order_or_404(db, order_id)
    report = build_internal_order_report(order)
    pdf = generate_internal_order_report_pdf(report)
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="order-{order_id}-internal-report.pdf"'},
    )


@router.get("/{order_id}/report/client/pdf")
def get_client_order_report_pdf(
    order_id: int,
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    order = _get_order_or_404(db, order_id)
    report = build_client_order_report(order)
    pdf = generate_client_order_report_pdf(report)
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="order-{order_id}-client-report.pdf"'},
    )


@router.post("/{order_id}/payments", response_model=OrderRead, status_code=201)
def create_order_payment(
    order_id: int,
    payload: PaymentCreate,
    db: Annotated[Session, Depends(get_db)],
) -> Order:
    order = _get_order_or_404(db, order_id)
    _ensure_order_is_not_in_closed_weekly_closing(db, order)

    payment_kwargs = {
        "order_id": order.id,
        "amount": _money(payload.amount),
        "payment_method": payload.payment_method,
        "notes": payload.notes,
    }
    if payload.paid_at is not None:
        payment_kwargs["paid_at"] = payload.paid_at

    order.payments.append(OrderPayment(**payment_kwargs))
    db.flush()
    _refresh_financials(order)
    db.commit()
    return _get_order_or_404(db, order.id)


@router.post("/{order_id}/cut", response_model=OrderRead, status_code=201)
def register_cut(
    order_id: int,
    payload: CutRegister,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> Order:
    order = _get_order_or_404(db, order_id, for_update=True)
    _ensure_order_is_not_in_closed_weekly_closing(db, order)
    _ensure_production_operation_allowed(order)
    item = _get_single_item_for_legacy_operation(order)

    _register_cut_entry(db, order, item, payload.quantity_cut, payload.notes, user)

    db.commit()
    return _get_order_or_404(db, order.id)


@router.post("/{order_id}/print", response_model=OrderRead, status_code=201)
def register_print(
    order_id: int,
    payload: PrintRegister,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> Order:
    order = _get_order_or_404(db, order_id, for_update=True)
    _ensure_order_is_not_in_closed_weekly_closing(db, order)
    _ensure_production_operation_allowed(order)
    item = _get_single_item_for_legacy_operation(order)
    _validate_item_print_registration(order, item, payload)

    before_quantity = item.quantity_printed
    item.quantity_printed += payload.quantity
    order.print_type = payload.print_type
    _add_production_event(
        db,
        order=order,
        item=item,
        event_type=ProductionEventType.PRINT_REGISTERED,
        stage="print",
        quantity=payload.quantity,
        notes=payload.notes,
        user=user,
        before_quantity=before_quantity,
        after_quantity=item.quantity_printed,
    )
    _sync_order_production_snapshot(db, order, payload.quantity, user)
    sync_order_items_delivery_status(order)

    db.commit()
    return _get_order_or_404(db, order.id)


@router.post("/{order_id}/sew", response_model=OrderRead, status_code=201)
def register_sewing(
    order_id: int,
    payload: SewingRegister,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> Order:
    order = _get_order_or_404(db, order_id, for_update=True)
    _ensure_order_is_not_in_closed_weekly_closing(db, order)
    _ensure_production_operation_allowed(order)
    item = _get_single_item_for_legacy_operation(order)
    _validate_item_sewing_registration(item, payload)

    before_quantity = item.quantity_sewn
    item.quantity_sewn += payload.quantity
    _add_production_event(
        db,
        order=order,
        item=item,
        event_type=ProductionEventType.SEWING_REGISTERED,
        stage="sew",
        quantity=payload.quantity,
        notes=payload.notes,
        user=user,
        before_quantity=before_quantity,
        after_quantity=item.quantity_sewn,
    )
    _sync_order_production_snapshot(db, order, payload.quantity, user)
    sync_order_items_delivery_status(order)

    db.commit()
    return _get_order_or_404(db, order.id)


@router.post(
    "/{order_id}/items/{item_id}/cut",
    response_model=OrderRead,
    status_code=201,
)
def register_item_cut(
    order_id: int,
    item_id: int,
    payload: ItemQuantityRegister,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> Order:
    order = _get_order_or_404(db, order_id, for_update=True)
    _ensure_order_is_not_in_closed_weekly_closing(db, order)
    _ensure_production_operation_allowed(order)
    item = _get_order_item_or_404(order, item_id)
    _ensure_item_is_active(item)

    _register_cut_entry(db, order, item, payload.quantity, payload.notes, user)

    db.commit()
    return _get_order_or_404(db, order.id)


@router.post(
    "/{order_id}/items/{item_id}/allocate-cut-pieces",
    response_model=OrderRead,
    status_code=201,
)
def allocate_cut_pieces_to_item(
    order_id: int,
    item_id: int,
    payload: CutPieceAllocation,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> Order:
    order = _get_order_or_404(db, order_id, for_update=True)
    _ensure_order_is_not_in_closed_weekly_closing(db, order)
    _ensure_production_operation_allowed(order)
    item = _get_order_item_or_404(order, item_id)
    _ensure_item_is_active(item)
    remaining_needed = item.quantity_requested - item.quantity_cut
    if payload.quantity > remaining_needed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Quantidade destinada excede a necessidade restante do item ({remaining_needed}).",
        )

    stock_items = get_piece_stock_items_for_order_item(db, item)
    if not stock_items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nao existe estoque de pecas cortadas compativel para este item.",
        )
    available_quantity = sum(
        (stock_item.quantity for stock_item in stock_items),
        Decimal("0.00"),
    )
    if available_quantity < Decimal(payload.quantity):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Saldo disponivel insuficiente no estoque compativel ({int(available_quantity)}).",
        )

    before_quantity = item.quantity_cut
    remaining_quantity = Decimal(payload.quantity)
    for stock_item in stock_items:
        movement_quantity = min(stock_item.quantity, remaining_quantity)
        if movement_quantity <= Decimal("0.00"):
            continue
        register_stock_movement(
            db,
            stock_item,
            movement_type=StockMovementType.ALLOCATED_TO_ORDER,
            quantity=movement_quantity,
            reference_type="order_item",
            reference_id=item.id,
            notes=_clean_optional_text(payload.notes),
        )
        remaining_quantity -= movement_quantity
        if remaining_quantity == Decimal("0.00"):
            break
    item.quantity_cut += payload.quantity
    _add_production_event(
        db,
        order=order,
        item=item,
        event_type=ProductionEventType.CUT_PIECES_ALLOCATED,
        stage="cut_allocation",
        quantity=payload.quantity,
        before_quantity=before_quantity,
        after_quantity=item.quantity_cut,
        notes=_clean_optional_text(payload.notes),
        user=user,
    )
    _sync_order_production_snapshot(db, order, payload.quantity, user)
    sync_order_items_delivery_status(order)

    db.commit()
    return _get_order_or_404(db, order.id)


@router.post(
    "/{order_id}/items/{item_id}/return-cut-pieces-to-stock",
    response_model=OrderRead,
    status_code=201,
)
def return_cut_pieces_to_stock(
    order_id: int,
    item_id: int,
    payload: CutPieceReturn,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> Order:
    order = _get_order_or_404(db, order_id, for_update=True)
    _ensure_order_is_not_in_closed_weekly_closing(db, order)
    _ensure_order_is_open_for_production_control(order)
    item = _get_order_item_or_404(order, item_id)
    _ensure_item_is_active(item)
    committed_quantity = _committed_cut_piece_quantity(order, item)
    returnable_quantity = item.quantity_cut - committed_quantity
    if payload.quantity > returnable_quantity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Quantidade devolvida excede o saldo destinado ainda nao comprometido "
                f"({max(returnable_quantity, 0)})."
            ),
        )

    stock_item = get_or_create_piece_stock_item_for_order_item(db, item)
    before_quantity = item.quantity_cut
    register_stock_movement(
        db,
        stock_item,
        movement_type=StockMovementType.RETURNED_FROM_ORDER,
        quantity=Decimal(payload.quantity),
        reference_type="order_item",
        reference_id=item.id,
        notes=payload.notes,
    )
    item.quantity_cut -= payload.quantity
    _add_production_event(
        db,
        order=order,
        item=item,
        event_type=ProductionEventType.CUT_PIECES_RETURNED,
        stage="cut_allocation",
        quantity=payload.quantity,
        before_quantity=before_quantity,
        after_quantity=item.quantity_cut,
        reason=payload.notes,
        notes=payload.notes,
        user=user,
    )
    sync_order_items_delivery_status(order)
    _sync_order_production_snapshot(db, order, payload.quantity, user)

    db.commit()
    return _get_order_or_404(db, order.id)


@router.post(
    "/{order_id}/items/{item_id}/print",
    response_model=OrderRead,
    status_code=201,
)
def register_item_print(
    order_id: int,
    item_id: int,
    payload: PrintRegister,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> Order:
    order = _get_order_or_404(db, order_id, for_update=True)
    _ensure_order_is_not_in_closed_weekly_closing(db, order)
    _ensure_production_operation_allowed(order)
    item = _get_order_item_or_404(order, item_id)
    _ensure_item_is_active(item)
    _validate_item_print_registration(order, item, payload)

    before_quantity = item.quantity_printed
    item.quantity_printed += payload.quantity
    order.print_type = payload.print_type
    _add_production_event(
        db,
        order=order,
        item=item,
        event_type=ProductionEventType.PRINT_REGISTERED,
        stage="print",
        quantity=payload.quantity,
        notes=payload.notes,
        user=user,
        before_quantity=before_quantity,
        after_quantity=item.quantity_printed,
    )
    _sync_order_production_snapshot(db, order, payload.quantity, user)
    sync_order_items_delivery_status(order)

    db.commit()
    return _get_order_or_404(db, order.id)


@router.post(
    "/{order_id}/items/{item_id}/sew",
    response_model=OrderRead,
    status_code=201,
)
def register_item_sewing(
    order_id: int,
    item_id: int,
    payload: SewingRegister,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> Order:
    order = _get_order_or_404(db, order_id, for_update=True)
    _ensure_order_is_not_in_closed_weekly_closing(db, order)
    _ensure_production_operation_allowed(order)
    item = _get_order_item_or_404(order, item_id)
    _ensure_item_is_active(item)
    _validate_item_sewing_registration(item, payload)

    before_quantity = item.quantity_sewn
    item.quantity_sewn += payload.quantity
    _add_production_event(
        db,
        order=order,
        item=item,
        event_type=ProductionEventType.SEWING_REGISTERED,
        stage="sew",
        quantity=payload.quantity,
        notes=payload.notes,
        user=user,
        before_quantity=before_quantity,
        after_quantity=item.quantity_sewn,
    )
    _sync_order_production_snapshot(db, order, payload.quantity, user)
    sync_order_items_delivery_status(order)

    db.commit()
    return _get_order_or_404(db, order.id)


@router.post("/{order_id}/outsourcing", response_model=OrderRead, status_code=201)
def create_order_outsourcing(
    order_id: int,
    payload: OutsourcingCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> Order:
    order = _get_order_or_404(db, order_id, for_update=True)
    _ensure_order_is_not_in_closed_weekly_closing(db, order)
    _ensure_production_operation_allowed(order)
    item = _validate_outsourcing_item(order, payload.order_item_id)
    _validate_outsourcer_exists(db, payload.outsourcer_id)
    if payload.direct_to_customer:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Terceirizacao sempre retorna para a Gratao antes da entrega ao cliente.",
        )

    available_quantity = _available_outsourcing_quantity_for_item(order, item)
    if payload.quantity_sent > available_quantity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot outsource more than available quantity ({available_quantity})",
        )

    customer_unit_price = _money(payload.customer_unit_price)
    outsourcer_unit_price = _money(payload.outsourcer_unit_price)
    customer_total = _money(customer_unit_price * payload.quantity_sent)
    outsourcer_total = _money(outsourcer_unit_price * payload.quantity_sent)
    profit_total = _money(customer_total - outsourcer_total)

    previous_outsourced_quantity = sum(
        existing.quantity_sent
        for existing in order.outsourcings
        if existing.order_item_id == item.id
        and existing.status != OutsourcingStatus.CANCELLED
    )

    outsourcing_status = OutsourcingStatus.SENT
    outsourcing = OrderOutsourcing(
        outsourcer_id=payload.outsourcer_id,
        quantity_sent=payload.quantity_sent,
        quantity_returned=0,
        customer_unit_price=customer_unit_price,
        outsourcer_unit_price=outsourcer_unit_price,
        customer_total=customer_total,
        outsourcer_total=outsourcer_total,
        profit_total=profit_total,
        return_expected=payload.return_expected,
        direct_to_customer=payload.direct_to_customer,
        status=outsourcing_status,
        payout_status=PayoutStatus.PENDING,
        notes=payload.notes,
    )
    outsourcing.order_item = item
    order.outsourcings.append(outsourcing)
    _add_production_event(
        db,
        order=order,
        item=item,
        event_type=ProductionEventType.OUTSOURCING_SENT,
        stage="outsourcing",
        quantity=payload.quantity_sent,
        notes=payload.notes,
        user=user,
        before_quantity=previous_outsourced_quantity,
        after_quantity=previous_outsourced_quantity + payload.quantity_sent,
    )

    _sync_order_totals(order)
    _sync_order_production_snapshot(db, order, payload.quantity_sent, user)

    db.commit()
    return _get_order_or_404(db, order.id)


@router.get("/{order_id}/outsourcings", response_model=list[OrderOutsourcingRead])
def list_order_outsourcings(
    order_id: int,
    db: Annotated[Session, Depends(get_db)],
) -> list[OrderOutsourcing]:
    _ensure_order_exists(db, order_id)
    query = (
        select(OrderOutsourcing)
        .where(OrderOutsourcing.order_id == order_id)
        .options(selectinload(OrderOutsourcing.outsourcer))
        .order_by(OrderOutsourcing.created_at.desc())
    )
    return list(db.scalars(query))


@router.post(
    "/{order_id}/outsourcing/{outsourcing_id}/return",
    response_model=OrderRead,
    status_code=201,
)
def register_outsourcing_return(
    order_id: int,
    outsourcing_id: int,
    payload: OutsourcingReturn,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> Order:
    order = _get_order_or_404(db, order_id, for_update=True)
    _ensure_order_is_not_in_closed_weekly_closing(db, order)
    _ensure_order_is_open_for_production_control(order)
    outsourcing = _get_order_outsourcing_or_404(db, order_id, outsourcing_id)

    if outsourcing.direct_to_customer:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot register return for direct-to-customer outsourcing",
        )
    if outsourcing.status == OutsourcingStatus.CANCELLED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot register return for cancelled outsourcing",
        )
    new_returned_quantity = outsourcing.quantity_returned + payload.quantity_returned
    if new_returned_quantity > outsourcing.quantity_sent:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot return more than sent quantity",
        )

    previous_returned_quantity = outsourcing.quantity_returned
    outsourcing.quantity_returned = new_returned_quantity
    if outsourcing.quantity_returned < outsourcing.quantity_sent:
        outsourcing.status = OutsourcingStatus.PARTIALLY_RETURNED
    else:
        outsourcing.status = OutsourcingStatus.RETURNED
        outsourcing.returned_at = _utcnow()

    _add_production_event(
        db,
        order=order,
        item=outsourcing.order_item,
        event_type=ProductionEventType.OUTSOURCING_RETURNED,
        stage="outsourcing_return",
        quantity=payload.quantity_returned,
        notes=payload.notes,
        user=user,
        before_quantity=previous_returned_quantity,
        after_quantity=outsourcing.quantity_returned,
    )

    if outsourcing.order_item is not None:
        sync_item_delivery_status(outsourcing.order_item, order)
    _sync_order_production_snapshot(db, order, payload.quantity_returned, user)

    db.commit()
    return _get_order_or_404(db, order.id)


@router.post(
    "/{order_id}/outsourcing/{outsourcing_id}/payout",
    response_model=OrderRead,
    status_code=201,
)
def pay_order_outsourcing(
    order_id: int,
    outsourcing_id: int,
    payload: OutsourcingPayout,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> Order:
    order = _get_order_or_404(db, order_id)
    _ensure_order_is_not_in_closed_weekly_closing(db, order)
    outsourcing = _get_order_outsourcing_or_404(db, order_id, outsourcing_id)

    outsourcing.payout_status = PayoutStatus.PAID
    outsourcing.paid_at = payload.paid_at or _utcnow()
    if payload.notes:
        outsourcing.notes = _append_note(outsourcing.notes, payload.notes)

    _add_production_event(
        db,
        order=order,
        item=outsourcing.order_item,
        event_type=ProductionEventType.OUTSOURCING_PAYOUT_PAID,
        stage="outsourcing",
        quantity=outsourcing.quantity_sent,
        notes=payload.notes,
        user=user,
    )

    db.commit()
    return _get_order_or_404(db, order.id)


@router.post(
    "/{order_id}/items/{item_id}/loss",
    response_model=OrderRead,
    status_code=201,
)
def register_item_loss(
    order_id: int,
    item_id: int,
    payload: OperationalEventRegister,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> Order:
    order = _get_order_or_404(db, order_id, for_update=True)
    _ensure_order_is_not_in_closed_weekly_closing(db, order)
    _ensure_production_operation_allowed(order)
    item = _get_order_item_or_404(order, item_id)
    _ensure_item_is_active(item)

    _add_production_event(
        db,
        order=order,
        item=item,
        event_type=ProductionEventType.LOSS_REGISTERED,
        stage=payload.stage,
        quantity=payload.quantity,
        reason=_clean_required_text(payload.reason) or payload.reason,
        notes=_clean_optional_text(payload.notes),
        user=user,
    )
    db.commit()
    return _get_order_or_404(db, order.id)


@router.post(
    "/{order_id}/items/{item_id}/rework",
    response_model=OrderRead,
    status_code=201,
)
def register_item_rework(
    order_id: int,
    item_id: int,
    payload: OperationalEventRegister,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> Order:
    order = _get_order_or_404(db, order_id, for_update=True)
    _ensure_order_is_not_in_closed_weekly_closing(db, order)
    _ensure_production_operation_allowed(order)
    item = _get_order_item_or_404(order, item_id)
    _ensure_item_is_active(item)

    _add_production_event(
        db,
        order=order,
        item=item,
        event_type=ProductionEventType.REWORK_REGISTERED,
        stage=payload.stage,
        quantity=payload.quantity,
        reason=_clean_required_text(payload.reason) or payload.reason,
        notes=_clean_optional_text(payload.notes),
        user=user,
    )
    db.commit()
    return _get_order_or_404(db, order.id)


@router.post(
    "/{order_id}/items/{item_id}/adjustment",
    response_model=OrderRead,
    status_code=201,
)
def register_item_adjustment(
    order_id: int,
    item_id: int,
    payload: OperationalAdjustmentRegister,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> Order:
    order = _get_order_or_404(db, order_id, for_update=True)
    _ensure_order_is_not_in_closed_weekly_closing(db, order)
    _ensure_production_operation_allowed(order)
    item = _get_order_item_or_404(order, item_id)
    _ensure_item_is_active(item)
    if payload.stage == "cut":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "A quantidade destinada nao pode ser ajustada diretamente. "
                "Use destinacao ou devolucao de pecas cortadas."
            ),
        )

    before_quantity = _quantity_for_adjustment_stage(item, payload.stage)
    after_quantity = before_quantity + payload.quantity_delta
    if after_quantity < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ajuste nao pode gerar quantidade negativa.",
        )

    _apply_item_adjustment(order, item, payload.stage, after_quantity)
    _add_production_event(
        db,
        order=order,
        item=item,
        event_type=ProductionEventType.ADJUSTMENT_REGISTERED,
        stage=payload.stage,
        quantity=payload.quantity_delta,
        before_quantity=before_quantity,
        after_quantity=after_quantity,
        reason=_clean_required_text(payload.reason) or payload.reason,
        notes=_clean_required_text(payload.notes) or payload.notes,
        user=user,
    )
    _sync_order_production_snapshot(db, order, abs(payload.quantity_delta), user)
    sync_order_items_delivery_status(order)

    db.commit()
    return _get_order_or_404(db, order.id)


@router.get(
    "/{order_id}/items/{item_id}/history",
    response_model=list[OperationalHistoryEntry],
)
def get_item_operational_history(
    order_id: int,
    item_id: int,
    db: Annotated[Session, Depends(get_db)],
) -> list[OperationalHistoryEntry]:
    order = _get_order_or_404(db, order_id)
    item = _get_order_item_or_404(order, item_id)
    return _build_item_operational_history(order, item)


def _add_production_event(
    db: Session,
    *,
    order: Order,
    item: OrderItem | None,
    event_type: ProductionEventType,
    stage: str | None = None,
    quantity: int | None = None,
    before_quantity: int | None = None,
    after_quantity: int | None = None,
    reason: str | None = None,
    notes: str | None = None,
    user: User | None = None,
    from_status: ProductionStatus | None = None,
    to_status: ProductionStatus | None = None,
) -> None:
    user_id, user_name = _user_snapshot(user)
    db.add(
        ProductionEvent(
            order_id=order.id,
            order_item_id=item.id if item is not None else None,
            event_type=event_type,
            stage=stage,
            quantity=quantity,
            before_quantity=before_quantity,
            after_quantity=after_quantity,
            reason=reason,
            notes=notes,
            user_id=user_id,
            user_name_snapshot=user_name,
            from_status=from_status,
            to_status=to_status,
        )
    )


def _user_snapshot(user: User | None) -> tuple[int | None, str | None]:
    if user is None:
        return None, None
    return user.id, user.name or user.email


def _quantity_for_adjustment_stage(item: OrderItem, stage: str) -> int:
    if stage == "cut":
        return item.quantity_cut
    if stage == "print":
        return item.quantity_printed
    if stage == "sew":
        return item.quantity_sewn
    if stage == "delivered":
        return item.quantity_delivered
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Etapa de ajuste invalida.")


def _apply_item_adjustment(
    order: Order,
    item: OrderItem,
    stage: str,
    after_quantity: int,
) -> None:
    if stage == "cut":
        _validate_cut_adjustment(order, item, after_quantity)
        item.quantity_cut = after_quantity
        return
    if stage == "print":
        _validate_print_adjustment(order, item, after_quantity)
        item.quantity_printed = after_quantity
        return
    if stage == "sew":
        _validate_sewing_adjustment(order, item, after_quantity)
        item.quantity_sewn = after_quantity
        return
    if stage == "delivered":
        _validate_delivery_adjustment(order, item, after_quantity)
        item.quantity_delivered = after_quantity
        if item.quantity_delivered < item.quantity_requested:
            item.delivered_at = None
        return
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Etapa de ajuste invalida.")


def _validate_cut_adjustment(order: Order, item: OrderItem, after_quantity: int) -> None:
    if after_quantity < item.quantity_printed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Saldo destinado nao pode ficar menor que a quantidade ja estampada.",
        )
    outsourced_quantity = _active_item_outsourced_quantity(order, item)
    if not _item_has_printing(item) and after_quantity < outsourced_quantity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Saldo destinado nao pode ficar menor que a quantidade ja enviada para terceirizacao.",
        )
    if not _item_has_printing(item) and not _item_has_sewing(item) and after_quantity < item.quantity_delivered:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Saldo destinado nao pode ficar menor que a quantidade ja entregue.",
        )


def _validate_print_adjustment(order: Order, item: OrderItem, after_quantity: int) -> None:
    if not _item_has_printing(item):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este item nao possui etapa de DTF.",
        )
    if after_quantity > item.quantity_cut:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="DTF nao pode ficar maior que a quantidade destinada para a OS.",
        )
    if after_quantity > item.quantity_requested:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="DTF nao pode ficar maior que a quantidade solicitada.",
        )
    if after_quantity < item.quantity_sewn:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="DTF nao pode ficar menor que a quantidade ja confeccionada.",
        )
    outsourced_quantity = _active_item_outsourced_quantity(order, item)
    if item.sewing_mode == SewingMode.OUTSOURCED and after_quantity < outsourced_quantity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="DTF nao pode ficar menor que a quantidade ja enviada para terceirizacao.",
        )
    if not _item_has_sewing(item) and item.sewing_mode != SewingMode.OUTSOURCED and after_quantity < item.quantity_delivered:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="DTF nao pode ficar menor que a quantidade ja entregue.",
        )


def _validate_sewing_adjustment(order: Order, item: OrderItem, after_quantity: int) -> None:
    if not _item_has_sewing(item) or item.sewing_mode != SewingMode.INTERNAL:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este item nao possui confeccao interna.",
        )
    sewing_limit = (
        min(item.quantity_printed, item.quantity_requested)
        if _item_has_printing(item)
        else min(item.quantity_cut, item.quantity_requested)
    )
    if after_quantity > sewing_limit:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Confeccao nao pode ficar maior que o saldo permitido.",
        )
    if after_quantity < item.quantity_delivered:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Confeccao nao pode ficar menor que a quantidade ja entregue.",
        )


def _validate_delivery_adjustment(order: Order, item: OrderItem, after_quantity: int) -> None:
    ready_quantity = ready_to_deliver_quantity(item, order)
    if after_quantity > ready_quantity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Entrega nao pode ficar maior que a quantidade pronta.",
        )
    if after_quantity > item.quantity_requested:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Entrega nao pode ficar maior que a quantidade solicitada.",
        )


def _active_item_outsourced_quantity(order: Order, item: OrderItem) -> int:
    return sum(
        outsourcing.quantity_sent
        for outsourcing in order.outsourcings
        if outsourcing.order_item_id == item.id
        and outsourcing.status != OutsourcingStatus.CANCELLED
    )


def _committed_cut_piece_quantity(order: Order, item: OrderItem) -> int:
    return max(
        item.quantity_printed,
        item.quantity_sewn,
        item.quantity_delivered,
        _active_item_outsourced_quantity(order, item),
    )


def _build_item_operational_history(
    order: Order,
    item: OrderItem,
) -> list[OperationalHistoryEntry]:
    entries: list[OperationalHistoryEntry] = []
    for event in order.production_events:
        if event.order_item_id != item.id:
            continue
        if event.event_type == ProductionEventType.DELIVERY_REGISTERED:
            continue
        entries.append(
            OperationalHistoryEntry(
                source="production_event",
                event_type=event.event_type.value,
                label=_production_event_label(event),
                order_id=order.id,
                order_item_id=item.id,
                stage=event.stage,
                quantity=event.quantity,
                before_quantity=event.before_quantity,
                after_quantity=event.after_quantity,
                reason=event.reason,
                notes=event.notes,
                user_id=event.user_id,
                user_name=event.user_name_snapshot,
                created_at=event.created_at,
            )
        )
    for delivery in item.delivery_history:
        entries.append(
            OperationalHistoryEntry(
                source="delivery_history",
                event_type=ProductionEventType.DELIVERY_REGISTERED.value,
                label="Entrega registrada",
                order_id=order.id,
                order_item_id=item.id,
                stage="delivered",
                quantity=delivery.quantity,
                notes=delivery.delivery_notes or delivery.notes,
                user_id=delivery.user_id,
                user_name=delivery.user_name_snapshot or delivery.responsible,
                picked_up_by=delivery.picked_up_by,
                pickup_document=delivery.pickup_document,
                created_at=delivery.delivered_at,
            )
        )
    return sorted(entries, key=lambda entry: entry.created_at, reverse=True)


def _production_event_label(event: ProductionEvent) -> str:
    labels = {
        ProductionEventType.CUT_REGISTERED: "Corte registrado no estoque",
        ProductionEventType.CUT_PIECES_ALLOCATED: "Pecas cortadas destinadas a OS",
        ProductionEventType.CUT_PIECES_RETURNED: "Pecas cortadas devolvidas ao estoque",
        ProductionEventType.PRODUCTION_PAUSED: "Producao pausada",
        ProductionEventType.PRODUCTION_RESUMED: "Producao retomada",
        ProductionEventType.PRINT_REGISTERED: "DTF registrado",
        ProductionEventType.SEWING_REGISTERED: "Confeccao registrada",
        ProductionEventType.OUTSOURCING_SENT: "Terceirizacao enviada",
        ProductionEventType.OUTSOURCING_RETURNED: "Retorno de terceirizacao registrado",
        ProductionEventType.OUTSOURCING_PAYOUT_PAID: "Pagamento de terceirizacao registrado",
        ProductionEventType.DELIVERY_REGISTERED: "Entrega registrada",
        ProductionEventType.ORDER_ITEM_CANCELLED: "Item cancelado",
        ProductionEventType.LOSS_REGISTERED: "Perda registrada",
        ProductionEventType.REWORK_REGISTERED: "Retrabalho registrado",
        ProductionEventType.ADJUSTMENT_REGISTERED: "Ajuste operacional registrado",
        ProductionEventType.STATUS_CHANGED: "Status alterado",
    }
    return labels.get(event.event_type, event.event_type.value)


def _order_has_movements(order: Order) -> bool:
    return (
        order.production_status != ProductionStatus.CREATED
        or bool(order.production_events)
        or bool(order.payments)
        or bool(order.outsourcings)
        or any(
            item.quantity_cut > 0
            or item.quantity_printed > 0
            or item.quantity_sewn > 0
            or item.quantity_delivered > 0
            or item.delivered_at is not None
            for item in order.items
        )
    )


def _apply_safe_order_update(db: Session, order: Order, payload: OrderUpdate) -> None:
    items_with_services = _ensure_order_references_exist(db, payload)
    existing_items = {item.id: item for item in order.items}
    existing_active_items = {item.id: item for item in _active_order_items(order)}
    payload_existing_ids = [item.id for item in payload.items if item.id is not None]
    unknown_ids = [item_id for item_id in payload_existing_ids if item_id not in existing_items]
    if unknown_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Item da OS invalido.")
    cancelled_payload_ids = [
        item_id
        for item_id in payload_existing_ids
        if existing_items[item_id].is_cancelled
    ]
    if cancelled_payload_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Itens cancelados nao podem ser editados. Eles permanecem apenas como historico.",
        )
    if payload.client_id != order.client_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Esta OS ja possui movimentacoes ou pagamentos. Nao e possivel alterar o cliente."
            ),
        )
    if payload.allow_printing_exception != order.allow_printing_exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Esta OS ja possui movimentacoes. Nao e possivel alterar excecoes de producao; "
                "apenas cor e observacoes podem ser alteradas."
            ),
        )

    omitted_active_items = [
        item
        for item_id, item in existing_active_items.items()
        if item_id not in payload_existing_ids
    ]
    for item in omitted_active_items:
        if _item_has_movements(order, item):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Item com movimento nao pode ser removido fisicamente. "
                    "Use o cancelamento controlado do item."
                ),
            )
        order.items.remove(item)

    for item_payload, services in items_with_services:
        if item_payload.id is None:
            _append_new_order_item(order, item_payload, services)
            continue

        item = existing_items[item_payload.id]
        current_service_ids = [item_service.service_id for item_service in item.services]
        normalized_sewing_mode = _normalized_sewing_mode(item_payload, services)
        item_has_movements = _item_has_movements(order, item)
        if item_has_movements:
            if item_payload.product_id != item.product_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Nao e possivel trocar produto/modelo de item ja movimentado.",
                )
            if item_payload.size_id != item.size_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Nao e possivel trocar tamanho de item ja movimentado.",
                )
            if normalized_sewing_mode != item.sewing_mode:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Nao e possivel trocar a producao final de item ja movimentado.",
                )
            if item_payload.service_ids != current_service_ids:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Nao e possivel trocar servicos de item ja movimentado.",
                )
            _sync_existing_item_service_prices(item, item_payload)
            if item_payload.color != item.color and item.quantity_cut > 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        "Nao e possivel alterar a cor de um item que possui pecas "
                        "cortadas destinadas. Devolva o saldo antes de alterar a cor."
                    ),
                )
            movement_floor = _item_quantity_movement_floor(order, item)
            if item_payload.quantity_requested < movement_floor:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        "Nao e possivel reduzir a quantidade abaixo do que ja foi produzido, "
                        "destinado, terceirizado ou entregue."
                    ),
                )
        else:
            item.product_id = item_payload.product_id
            item.size_id = item_payload.size_id
            item.sewing_mode = normalized_sewing_mode
            _replace_item_services(item, item_payload, services)

        item.quantity_requested = item_payload.quantity_requested
        item.color = item_payload.color
        item.operational_priority = item_payload.operational_priority
        item.notes = item_payload.notes
        item.dtf_notes = item_payload.dtf_notes

    if not _active_order_items(order):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A OS precisa manter pelo menos um item ativo.",
        )

    order.notes = payload.notes
    _sync_order_totals(order)
    sync_order_items_delivery_status(order)
    _sync_order_status_after_quantity_update(db, order)


def _item_quantity_movement_floor(order: Order, item: OrderItem) -> int:
    returned_outsourced = sum(
        outsourcing.quantity_returned
        for outsourcing in order.outsourcings
        if outsourcing.order_item_id == item.id and outsourcing.status != OutsourcingStatus.CANCELLED
    )
    sent_outsourced = sum(
        outsourcing.quantity_sent
        for outsourcing in order.outsourcings
        if outsourcing.order_item_id == item.id and outsourcing.status != OutsourcingStatus.CANCELLED
    )
    return max(
        item.quantity_cut,
        item.quantity_printed,
        item.quantity_sewn,
        item.quantity_delivered,
        returned_outsourced,
        sent_outsourced,
    )


def _active_order_items(order: Order) -> list[OrderItem]:
    return [item for item in order.items if not item.is_cancelled]


def _item_has_movements(order: Order, item: OrderItem) -> bool:
    return (
        item.quantity_cut > 0
        or item.quantity_printed > 0
        or item.quantity_sewn > 0
        or item.quantity_delivered > 0
        or item.delivered_at is not None
        or any(event.order_item_id == item.id for event in order.production_events)
        or any(
            outsourcing.order_item_id == item.id
            and outsourcing.status != OutsourcingStatus.CANCELLED
            for outsourcing in order.outsourcings
        )
    )


def _append_new_order_item(order: Order, item_payload: object, services: list[Service]) -> None:
    order_item = OrderItem(
        product_id=item_payload.product_id,
        size_id=item_payload.size_id,
        color=item_payload.color,
        quantity_requested=item_payload.quantity_requested,
        quantity_cut=0,
        quantity_printed=0,
        quantity_sewn=0,
        quantity_delivered=0,
        operational_priority=item_payload.operational_priority,
        sewing_mode=_normalized_sewing_mode(item_payload, services),
        notes=item_payload.notes,
        dtf_notes=item_payload.dtf_notes,
        is_cancelled=False,
    )
    order.items.append(order_item)
    _replace_item_services(order_item, item_payload, services)


def _replace_item_services(
    item: OrderItem,
    item_payload: object,
    services: list[Service],
) -> None:
    item.services.clear()
    for service in services:
        unit_price = _service_unit_price(item_payload, service)
        total_price = _money(unit_price * item_payload.quantity_requested)
        item.services.append(
            OrderItemService(
                service_id=service.id,
                service=service,
                quantity=item_payload.quantity_requested,
                unit_price=unit_price,
                total_price=total_price,
            )
        )


def _sync_existing_item_service_prices(item: OrderItem, item_payload: object) -> None:
    service_prices = getattr(item_payload, "service_prices", None) or {}
    for item_service in item.services:
        if item_service.service_id in service_prices:
            item_service.unit_price = _money(service_prices[item_service.service_id])


def _replace_order_items(
    order: Order,
    items_with_services: list[tuple[object, list[Service]]],
) -> None:
    order.items.clear()
    order.services.clear()

    total_amount = Decimal("0.00")
    for item_payload, services in items_with_services:
        _append_new_order_item(order, item_payload, services)

        for service in services:
            unit_price = _service_unit_price(item_payload, service)
            total_price = _money(unit_price * item_payload.quantity_requested)
            total_amount += total_price
            order.services.append(
                OrderService(
                    service_id=service.id,
                    quantity=item_payload.quantity_requested,
                    unit_price=unit_price,
                    total_price=total_price,
                )
            )

    order.total_amount = _money(total_amount)


def _sync_order_snapshot_from_items(order: Order) -> None:
    active_items = _active_order_items(order)
    if not active_items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A OS precisa manter pelo menos um item ativo.",
        )
    first_item = active_items[0]
    order.product_id = first_item.product_id
    order.size_id = first_item.size_id
    order.color = first_item.color
    order.quantity_requested = sum(item.quantity_requested for item in active_items)
    order.quantity_cut = sum(item.quantity_cut for item in active_items)
    order.quantity_printed = sum(item.quantity_printed for item in active_items)
    order.quantity_sewn = sum(item.quantity_sewn for item in active_items)
    order.quantity_extra = sum(
        max(item.quantity_cut - item.quantity_requested, 0)
        for item in active_items
    )


def _sync_order_totals(order: Order) -> None:
    _sync_order_snapshot_from_items(order)

    total_amount = Decimal("0.00")
    service_snapshots: list[tuple[int, int, Decimal, Decimal]] = []
    for item in _active_order_items(order):
        for item_service in item.services:
            item_service.quantity = item.quantity_requested
            item_service.total_price = _money(
                item_service.unit_price * item.quantity_requested
            )
            total_amount += item_service.total_price
            service_snapshots.append(
                (
                    item_service.service_id,
                    item_service.quantity,
                    item_service.unit_price,
                    item_service.total_price,
                )
            )

    if len(order.services) == len(service_snapshots):
        for order_service, (
            service_id,
            quantity,
            unit_price,
            total_price,
        ) in zip(order.services, service_snapshots):
            order_service.service_id = service_id
            order_service.quantity = quantity
            order_service.unit_price = unit_price
            order_service.total_price = total_price
    else:
        order.services.clear()
        for service_id, quantity, unit_price, total_price in service_snapshots:
            order.services.append(
                OrderService(
                    service_id=service_id,
                    quantity=quantity,
                    unit_price=unit_price,
                    total_price=total_price,
                )
            )

    total_amount += _active_outsourcing_revenue_total(order)
    order.total_amount = _money(total_amount)
    _refresh_financials(order)


def _service_unit_price(item_payload: object, service: Service) -> Decimal:
    service_prices = getattr(item_payload, "service_prices", None) or {}
    return _money(service_prices.get(service.id, service.price_per_unit))


def _ensure_order_references_exist(
    db: Session,
    payload: OrderCreate | OrderUpdate,
) -> list[tuple[object, list[Service]]]:
    client = db.get(Client, payload.client_id)
    if client is None:
        raise HTTPException(status_code=400, detail="Client not found")
    if not client.is_active:
        raise HTTPException(status_code=400, detail="Inactive client is not allowed")

    items = payload.normalized_items() if isinstance(payload, OrderCreate) else payload.items
    items_with_services = []
    for item in items:
        product = db.get(Product, item.product_id)
        if product is None:
            raise HTTPException(status_code=400, detail="Product not found")
        if not product.is_active:
            raise HTTPException(status_code=400, detail="Inactive product is not allowed")
        if db.get(Size, item.size_id) is None:
            raise HTTPException(status_code=400, detail="Size not found")
        if len(set(item.service_ids)) != len(item.service_ids):
            raise HTTPException(status_code=400, detail="Services cannot be duplicated")

        services = list(db.scalars(select(Service).where(Service.id.in_(item.service_ids))))
        services_by_id = {service.id: service for service in services}
        missing_service_ids = [
            service_id for service_id in item.service_ids if service_id not in services_by_id
        ]
        if missing_service_ids:
            raise HTTPException(status_code=400, detail="Service not found")

        inactive_service_ids = [service.id for service in services if not service.is_active]
        if inactive_service_ids:
            raise HTTPException(status_code=400, detail="Inactive services are not allowed")

        _validate_item_sewing_mode(item, services)
        items_with_services.append(
            (item, [services_by_id[service_id] for service_id in item.service_ids])
        )

    return items_with_services


def _validate_item_sewing_mode(item: object, services: list[Service]) -> None:
    has_sewing = any(service.type == "confeccao" for service in services)
    sewing_mode = getattr(item, "sewing_mode", None)
    if sewing_mode == SewingMode.OUTSOURCED and has_sewing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Item terceirizado não deve incluir serviço Confecção. "
                "Os valores da terceirização são lançados na aba Terceirização."
            ),
        )
    if has_sewing:
        return
    if sewing_mode == SewingMode.INTERNAL and not has_sewing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="sewing_mode=internal so deve ser usado com servico de Confeccao.",
        )
    if sewing_mode == SewingMode.OUTSOURCED:
        return
    if sewing_mode is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="sewing_mode invalido para os servicos informados.",
        )


def _normalized_sewing_mode(item: object, services: list[Service]) -> SewingMode | None:
    has_sewing = any(service.type == "confeccao" for service in services)
    sewing_mode = getattr(item, "sewing_mode", None)
    if sewing_mode == SewingMode.OUTSOURCED:
        return SewingMode.OUTSOURCED
    if not has_sewing:
        return None
    return sewing_mode or SewingMode.INTERNAL


def _get_order_or_404(db: Session, order_id: int, *, for_update: bool = False) -> Order:
    query = (
        select(Order)
        .where(Order.id == order_id)
        .options(
            selectinload(Order.client),
            selectinload(Order.client_order_group),
            selectinload(Order.product),
            selectinload(Order.size),
            selectinload(Order.items).selectinload(OrderItem.product),
            selectinload(Order.items).selectinload(OrderItem.size),
            selectinload(Order.items).selectinload(OrderItem.delivery_history),
            selectinload(Order.items)
            .selectinload(OrderItem.services)
            .selectinload(OrderItemService.service),
            selectinload(Order.services).selectinload(OrderService.service),
            selectinload(Order.payments),
            selectinload(Order.production_events),
            selectinload(Order.outsourcings).selectinload(OrderOutsourcing.outsourcer),
        )
    )
    if for_update:
        query = query.with_for_update()
    order = db.scalar(query)
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    return order


def _get_single_item_for_legacy_operation(order: Order) -> OrderItem:
    active_items = _active_order_items(order)
    if len(active_items) != 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=LEGACY_MULTI_ITEM_OPERATION_MESSAGE,
        )
    return active_items[0]


def _register_cut_entry(
    db: Session,
    order: Order,
    item: OrderItem,
    quantity: int,
    notes: str | None,
    user: User | None,
) -> None:
    stock_item = get_or_create_piece_stock_item_for_order_item(db, item)
    previous_stock_quantity = int(stock_item.quantity)
    register_stock_movement(
        db,
        stock_item,
        movement_type=StockMovementType.CUT_ENTRY,
        quantity=Decimal(quantity),
        reference_type="order_item",
        reference_id=item.id,
        notes=_clean_optional_text(notes),
    )
    _add_production_event(
        db,
        order=order,
        item=item,
        event_type=ProductionEventType.CUT_REGISTERED,
        stage="cut_stock",
        quantity=quantity,
        notes=_clean_optional_text(notes),
        user=user,
        before_quantity=previous_stock_quantity,
        after_quantity=int(stock_item.quantity),
    )


def _get_order_item_or_404(order: Order, item_id: int) -> OrderItem:
    for item in order.items:
        if item.id == item_id:
            return item
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Order item not found",
    )


def _ensure_item_is_active(item: OrderItem) -> None:
    if item.is_cancelled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Item cancelado nao permite novas acoes produtivas.",
        )


def _refresh_financials(order: Order) -> None:
    amount_paid = _money(sum((payment.amount for payment in order.payments), Decimal("0.00")))
    order.amount_paid = amount_paid
    order.amount_due = max(_money(order.total_amount - amount_paid), Decimal("0.00"))

    if amount_paid == Decimal("0.00"):
        order.financial_status = FinancialStatus.PENDING
    elif amount_paid < order.total_amount:
        order.financial_status = FinancialStatus.PARTIAL
    else:
        order.financial_status = FinancialStatus.PAID


def _active_outsourcing_revenue_total(order: Order) -> Decimal:
    return _money(
        sum(
            (
                outsourcing.customer_total
                for outsourcing in order.outsourcings
                if outsourcing.status != OutsourcingStatus.CANCELLED
            ),
            Decimal("0.00"),
        )
    )


def _ensure_order_is_not_in_closed_weekly_closing(db: Session, order: Order) -> None:
    if order.weekly_closing_id is None:
        return
    closing_status = db.scalar(
        select(WeeklyClosing.status).where(WeeklyClosing.id == order.weekly_closing_id)
    )
    if closing_status in {WeeklyClosingStatus.CLOSED, WeeklyClosingStatus.PAID}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Esta OS pertence a um fechamento semanal já fechado.",
        )


def _ensure_order_is_open_for_production_control(order: Order) -> None:
    if order.production_status in {ProductionStatus.CANCELLED, ProductionStatus.DELIVERED}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nao e possivel alterar a producao de uma OS cancelada ou entregue.",
        )


def _ensure_production_operation_allowed(order: Order) -> None:
    _ensure_order_is_open_for_production_control(order)
    if order.production_paused:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A producao desta OS esta pausada. Retome a OS antes de avancar.",
        )


def _money(value: Decimal) -> Decimal:
    return value.quantize(MONEY_QUANTIZER)


def _validate_item_print_registration(
    order: Order,
    item: OrderItem,
    payload: PrintRegister,
) -> None:
    if not _item_has_printing(item):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="DTF nao faz parte do fluxo deste item.",
        )
    if item.quantity_cut == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nao e possivel registrar DTF sem pecas destinadas para este item.",
        )
    if item.quantity_printed + payload.quantity > item.quantity_cut:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nao e possivel estampar mais do que a quantidade destinada para este item.",
        )
    if item.quantity_printed + payload.quantity > item.quantity_requested:
        remaining = item.quantity_requested - item.quantity_printed
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Quantidade estampada excede o solicitado para este item. Faltam estampar {remaining}.",
        )
    product_name = _normalized_product_name(item.product.name)
    if product_name == "casaco" and payload.print_type != "front":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Casaco only allows front printing",
        )
    if _requires_printing_exception(product_name) and not order.allow_printing_exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This product requires allow_printing_exception to register printing",
        )


def _validate_item_sewing_registration(item: OrderItem, payload: SewingRegister) -> None:
    if not _item_has_sewing(item) or item.sewing_mode != SewingMode.INTERNAL:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Confeccao interna nao faz parte do fluxo deste item.",
        )
    if item.quantity_cut == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nao e possivel registrar confeccao sem pecas destinadas para este item.",
        )
    sewing_limit = (
        min(item.quantity_printed, item.quantity_requested)
        if _item_has_printing(item)
        else min(item.quantity_cut, item.quantity_requested)
    )
    if item.quantity_sewn + payload.quantity > sewing_limit:
        remaining = sewing_limit - item.quantity_sewn
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Quantidade confeccionada excede o saldo do item. Faltam confeccionar {remaining}.",
        )


def _sync_order_status_after_quantity_update(db: Session, order: Order) -> None:
    if order.production_status == ProductionStatus.CANCELLED:
        return

    _sync_order_snapshot_from_items(order)
    next_status = _derive_order_status_from_items(order)
    _set_order_aggregate_status(db, order, next_status, None)


def _validate_outsourcing_stage(order: Order) -> None:
    if order.production_status not in {
        ProductionStatus.CUT_DONE,
        ProductionStatus.PRINT_DONE,
    }:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Outsourcing is only allowed when production status is cut_done or print_done",
        )
    if not any(_item_is_ready_for_outsourcing(item) for item in _active_order_items(order)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nenhum item desta OS esta pronto para terceirizacao.",
        )


def _validate_outsourcing_item(order: Order, order_item_id: int) -> OrderItem:
    item = _get_order_item_or_404(order, order_item_id)
    _ensure_item_is_active(item)
    if item.sewing_mode != SewingMode.OUTSOURCED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este item nao esta configurado para terceirizacao.",
        )
    if item.quantity_cut < item.quantity_requested:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nao e possivel terceirizar antes de concluir a destinacao do item.",
        )
    if _item_has_printing(item) and item.quantity_printed < item.quantity_requested:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nao e possivel terceirizar antes de concluir o DTF do item.",
        )
    if _available_outsourcing_quantity_for_item(order, item) <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este item nao possui saldo para terceirizacao.",
        )
    return item


def _validate_outsourcer_exists(db: Session, outsourcer_id: int | None) -> None:
    if outsourcer_id is not None and db.get(Outsourcer, outsourcer_id) is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Outsourcer not found",
        )


def _available_outsourcing_quantity(order: Order) -> int:
    max_quantity = sum(
        _available_item_outsourcing_quantity(item)
        for item in _active_order_items(order)
        if _item_is_ready_for_outsourcing(item)
    )
    already_outsourced = sum(
        outsourcing.quantity_sent
        for outsourcing in order.outsourcings
        if outsourcing.status != OutsourcingStatus.CANCELLED
    )
    return max(max_quantity - already_outsourced, 0)


def _available_outsourcing_quantity_for_item(order: Order, item: OrderItem) -> int:
    max_quantity = _available_item_outsourcing_quantity(item)
    already_outsourced = sum(
        outsourcing.quantity_sent
        for outsourcing in order.outsourcings
        if outsourcing.order_item_id == item.id
        and outsourcing.status != OutsourcingStatus.CANCELLED
    )
    return max(max_quantity - already_outsourced, 0)


def _ensure_order_exists(db: Session, order_id: int) -> None:
    if db.get(Order, order_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")


def _ensure_order_group_client_matches(order: Order, next_client_id: int) -> None:
    if order.client_order_group_id is None:
        return
    if order.client_order_group and order.client_order_group.client_id == next_client_id:
        return
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Nao e possivel alterar o cliente de uma OS vinculada a Pedido de Cliente.",
    )


def _get_order_outsourcing_or_404(
    db: Session,
    order_id: int,
    outsourcing_id: int,
) -> OrderOutsourcing:
    query = (
        select(OrderOutsourcing)
        .where(
            OrderOutsourcing.id == outsourcing_id,
            OrderOutsourcing.order_id == order_id,
        )
        .options(
            selectinload(OrderOutsourcing.outsourcer),
            selectinload(OrderOutsourcing.order_item),
        )
    )
    outsourcing = db.scalar(query)
    if outsourcing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Outsourcing not found",
        )
    return outsourcing


def _append_note(current_notes: str | None, new_note: str) -> str:
    return f"{current_notes}\n{new_note}" if current_notes else new_note


def _clean_required_text(value: str | None) -> str | None:
    cleaned = _clean_optional_text(value)
    return cleaned or None


def _clean_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = " ".join(value.split())
    return cleaned or None


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _item_has_printing(item: OrderItem) -> bool:
    return any(
        _service_matches(item_service.service, "serigrafia", {"dtf"})
        for item_service in item.services
    )


def _item_has_cut(item: OrderItem) -> bool:
    return any(
        _service_matches(item_service.service, "corte", set())
        for item_service in item.services
    )


def _item_has_sewing(item: OrderItem) -> bool:
    return any(
        _service_matches(item_service.service, "confeccao", {"confec"})
        for item_service in item.services
    )


def _service_matches(service: Service, service_type: str, aliases: set[str]) -> bool:
    service_type_value = _normalized_product_name(service.type)
    service_name_value = _normalized_product_name(service.name)
    normalized_type = _normalized_product_name(service_type)
    return (
        service_type_value == normalized_type
        or normalized_type in service_name_value
        or any(alias in service_name_value for alias in aliases)
    )


def _sync_order_production_snapshot(
    db: Session,
    order: Order,
    quantity: int | None,
    user: User | None = None,
) -> None:
    active_items = _active_order_items(order)
    order.quantity_cut = sum(item.quantity_cut for item in active_items)
    order.quantity_printed = sum(item.quantity_printed for item in active_items)
    order.quantity_sewn = sum(item.quantity_sewn for item in active_items)
    order.quantity_extra = sum(
        max(item.quantity_cut - item.quantity_requested, 0)
        for item in active_items
    )

    next_status = _derive_order_status_from_items(order)
    _set_order_aggregate_status(db, order, next_status, quantity, user)


def _derive_order_status_from_items(order: Order) -> ProductionStatus:
    active_items = _active_order_items(order)
    if not active_items:
        return order.production_status
    if order.production_status == ProductionStatus.CANCELLED:
        return ProductionStatus.CANCELLED
    if all(item.delivery_status == DeliveryStatus.DELIVERED for item in active_items):
        return ProductionStatus.DELIVERED
    if len(active_items) == 1:
        return _derive_single_item_status(order, active_items[0])

    complete_items = [
        item for item in active_items
        if _item_is_complete(item, order)
    ]
    if len(complete_items) == len(active_items):
        return ProductionStatus.READY
    if complete_items:
        return ProductionStatus.PARTIAL_READY

    item_statuses = {
        _derive_single_item_status(order, item)
        for item in active_items
    }
    active_statuses = {
        item_status
        for item_status in item_statuses
        if item_status != ProductionStatus.CREATED
    }
    if len(active_statuses) > 1:
        return ProductionStatus.MIXED
    if active_statuses:
        return ProductionStatus.IN_PROGRESS
    return ProductionStatus.CREATED


def _derive_single_item_status(order: Order, item: OrderItem) -> ProductionStatus:
    if _item_is_complete(item, order):
        return ProductionStatus.READY
    if item.sewing_mode == SewingMode.OUTSOURCED:
        active_outsourcings = [
            outsourcing
            for outsourcing in order.outsourcings
            if outsourcing.order_item_id == item.id
            and outsourcing.status != OutsourcingStatus.CANCELLED
        ]
        if any(outsourcing.quantity_returned > 0 for outsourcing in active_outsourcings):
            return ProductionStatus.RETURNED
        if active_outsourcings:
            return ProductionStatus.OUTSOURCED
    if item.quantity_sewn > 0:
        return ProductionStatus.IN_SEWING
    if _item_has_printing(item) and item.quantity_printed >= item.quantity_requested:
        return ProductionStatus.PRINT_DONE
    if _item_has_printing(item) and item.quantity_printed > 0:
        return ProductionStatus.IN_PRINT
    if item.quantity_cut >= item.quantity_requested:
        return ProductionStatus.CUT_DONE
    if item.quantity_cut > 0:
        return ProductionStatus.IN_CUT
    return ProductionStatus.CREATED


def _item_is_complete(item: OrderItem, order: Order) -> bool:
    if item.sewing_mode == SewingMode.OUTSOURCED:
        return _outsourced_item_is_complete(item, order)
    if _item_has_sewing(item):
        return item.quantity_sewn >= item.quantity_requested
    if _item_has_printing(item):
        return item.quantity_printed >= item.quantity_requested
    if _item_has_cut(item):
        return item.quantity_cut >= item.quantity_requested
    return True


def _item_is_ready_for_outsourcing(item: OrderItem) -> bool:
    if item.is_cancelled:
        return False
    if item.sewing_mode != SewingMode.OUTSOURCED:
        return False
    if item.quantity_cut < item.quantity_requested:
        return False
    if _item_has_printing(item) and item.quantity_printed < item.quantity_requested:
        return False
    return True


def _outsourced_item_is_complete(item: OrderItem, order: Order) -> bool:
    active_outsourcings = [
        outsourcing
        for outsourcing in order.outsourcings
        if outsourcing.order_item_id == item.id
        and outsourcing.status != OutsourcingStatus.CANCELLED
    ]
    if not active_outsourcings:
        return False
    returned_quantity = sum(outsourcing.quantity_returned for outsourcing in active_outsourcings)
    return returned_quantity >= item.quantity_requested and all(
        outsourcing.status == OutsourcingStatus.RETURNED for outsourcing in active_outsourcings
    )


def _available_item_outsourcing_quantity(item: OrderItem) -> int:
    if _item_has_printing(item):
        return min(item.quantity_printed, item.quantity_requested)
    if _item_has_cut(item):
        return min(item.quantity_cut, item.quantity_requested)
    return item.quantity_requested


def _set_order_aggregate_status(
    db: Session,
    order: Order,
    next_status: ProductionStatus,
    quantity: int | None,
    user: User | None = None,
) -> None:
    if order.production_status in {ProductionStatus.CANCELLED, ProductionStatus.DELIVERED}:
        return
    if next_status == order.production_status:
        return

    previous_status = order.production_status
    order.production_status = next_status
    _add_production_event(
        db,
        order=order,
        item=None,
        event_type=ProductionEventType.STATUS_CHANGED,
        quantity=quantity,
        user=user,
        from_status=previous_status,
        to_status=next_status,
    )


def _can_advance_status(
    current_status: ProductionStatus,
    next_status: ProductionStatus,
) -> bool:
    if current_status in {
        ProductionStatus.CANCELLED,
        ProductionStatus.DELIVERED,
    }:
        return False
    return STATUS_ORDER[next_status] >= STATUS_ORDER[current_status]


def _change_status(
    db: Session,
    order: Order,
    next_status: ProductionStatus,
    quantity: int | None,
) -> None:
    previous_status = order.production_status
    if previous_status == next_status:
        return
    if STATUS_ORDER[next_status] < STATUS_ORDER[previous_status]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot regress production status from {previous_status.value} to {next_status.value}",
        )

    order.production_status = next_status
    _add_production_event(
        db,
        order=order,
        item=None,
        event_type=ProductionEventType.STATUS_CHANGED,
        quantity=quantity,
        from_status=previous_status,
        to_status=next_status,
    )


def _normalized_product_name(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii")
    return " ".join(ascii_value.lower().split())


def _requires_printing_exception(product_name: str) -> bool:
    return (
        product_name.startswith("cal")
        or product_name == "short"
        or product_name == "short saia"
    )
