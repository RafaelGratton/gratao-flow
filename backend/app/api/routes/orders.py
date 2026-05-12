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
    CutRegister,
    ItemQuantityRegister,
    OrderCreate,
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
from app.services.deliveries import sync_item_delivery_status, sync_order_items_delivery_status
from app.services.stock import (
    get_or_create_piece_stock_item_for_order,
    register_stock_movement,
)

router = APIRouter(dependencies=[Depends(get_current_user)])

MONEY_QUANTIZER = Decimal("0.01")
STATUS_ORDER = {
    ProductionStatus.CREATED: 0,
    ProductionStatus.IN_CUT: 1,
    ProductionStatus.CUT_DONE: 2,
    ProductionStatus.WAITING_PRINT: 3,
    ProductionStatus.IN_PRINT: 4,
    ProductionStatus.PRINT_DONE: 5,
    ProductionStatus.WAITING_SEWING: 6,
    ProductionStatus.IN_SEWING: 7,
    ProductionStatus.SEWING_DONE: 8,
    ProductionStatus.OUTSOURCED: 9,
    ProductionStatus.RETURNED: 10,
    ProductionStatus.READY: 11,
    ProductionStatus.DELIVERED: 12,
    ProductionStatus.CANCELLED: 13,
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
            sewing_mode=_normalized_sewing_mode(item_payload, services),
            notes=item_payload.notes,
        )
        order.items.append(order_item)

        for service in services:
            unit_price = _money(service.price_per_unit)
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
            selectinload(Order.product),
            selectinload(Order.size),
            selectinload(Order.items).selectinload(OrderItem.product),
            selectinload(Order.items).selectinload(OrderItem.size),
            selectinload(Order.items).selectinload(OrderItem.delivery_history),
            selectinload(Order.items)
            .selectinload(OrderItem.services)
            .selectinload(OrderItemService.service),
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
        _apply_safe_order_update(order, payload)
        db.commit()
        return _get_order_or_404(db, order.id)

    items_with_services = _ensure_order_references_exist(db, payload)
    order.client_id = payload.client_id
    order.allow_printing_exception = payload.allow_printing_exception
    order.notes = payload.notes
    _replace_order_items(order, items_with_services)
    _sync_order_snapshot_from_items(order)
    _refresh_financials(order)

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
) -> Order:
    order = _get_order_or_404(db, order_id)
    _ensure_order_is_not_in_closed_weekly_closing(db, order)
    if payload.quantity_cut < order.quantity_cut:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="quantity_cut cannot be lower than the current cut quantity",
        )

    previous_status = order.production_status
    previous_extra = order.quantity_extra
    order.quantity_cut = payload.quantity_cut
    order.quantity_extra = max(order.quantity_cut - order.quantity_requested, 0)
    quantity_extra_delta = order.quantity_extra - previous_extra
    db.add(
        ProductionEvent(
            order_id=order.id,
            event_type=ProductionEventType.CUT_REGISTERED,
            quantity=payload.quantity_cut,
            notes=payload.notes,
        )
    )

    if previous_status in {ProductionStatus.CREATED, ProductionStatus.IN_CUT}:
        _change_status(db, order, ProductionStatus.CUT_DONE, payload.quantity_cut)

    if quantity_extra_delta > 0:
        stock_item = get_or_create_piece_stock_item_for_order(db, order)
        register_stock_movement(
            db,
            stock_item,
            movement_type=StockMovementType.EXCESS_CUT,
            quantity=Decimal(quantity_extra_delta),
            reference_type="order",
            reference_id=order.id,
            notes=payload.notes,
        )

    db.commit()
    return _get_order_or_404(db, order.id)


@router.post("/{order_id}/print", response_model=OrderRead, status_code=201)
def register_print(
    order_id: int,
    payload: PrintRegister,
    db: Annotated[Session, Depends(get_db)],
) -> Order:
    order = _get_order_or_404(db, order_id)
    _ensure_order_is_not_in_closed_weekly_closing(db, order)
    _validate_print_registration(order, payload)

    order.quantity_printed += payload.quantity
    order.print_type = payload.print_type
    db.add(
        ProductionEvent(
            order_id=order.id,
            event_type=ProductionEventType.PRINT_REGISTERED,
            quantity=payload.quantity,
            notes=payload.notes,
        )
    )

    if order.production_status == ProductionStatus.CUT_DONE:
        _change_status(db, order, ProductionStatus.IN_PRINT, payload.quantity)
    if order.quantity_printed >= order.quantity_requested:
        _change_status(db, order, ProductionStatus.PRINT_DONE, payload.quantity)

    db.commit()
    return _get_order_or_404(db, order.id)


@router.post("/{order_id}/sew", response_model=OrderRead, status_code=201)
def register_sewing(
    order_id: int,
    payload: SewingRegister,
    db: Annotated[Session, Depends(get_db)],
) -> Order:
    order = _get_order_or_404(db, order_id)
    _ensure_order_is_not_in_closed_weekly_closing(db, order)
    has_printing = _has_printing(order)
    _validate_sewing_registration(order, payload, has_printing)

    order.quantity_sewn += payload.quantity
    db.add(
        ProductionEvent(
            order_id=order.id,
            event_type=ProductionEventType.SEWING_REGISTERED,
            quantity=payload.quantity,
            notes=payload.notes,
        )
    )

    if order.production_status in {
        ProductionStatus.CUT_DONE,
        ProductionStatus.PRINT_DONE,
    }:
        _change_status(db, order, ProductionStatus.IN_SEWING, payload.quantity)
    if order.quantity_sewn >= order.quantity_requested:
        _change_status(db, order, ProductionStatus.SEWING_DONE, payload.quantity)

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
) -> Order:
    order = _get_order_or_404(db, order_id)
    _ensure_order_is_not_in_closed_weekly_closing(db, order)
    item = _get_order_item_or_404(order, item_id)

    new_quantity = item.quantity_cut + payload.quantity
    if new_quantity > item.quantity_requested:
        remaining = item.quantity_requested - item.quantity_cut
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Quantidade cortada excede o solicitado para este item. Faltam cortar {remaining}.",
        )

    item.quantity_cut = new_quantity
    db.add(
        ProductionEvent(
            order_id=order.id,
            order_item_id=item.id,
            event_type=ProductionEventType.CUT_REGISTERED,
            quantity=payload.quantity,
            notes=payload.notes,
        )
    )
    _sync_order_production_snapshot(db, order, payload.quantity)
    sync_order_items_delivery_status(order)

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
) -> Order:
    order = _get_order_or_404(db, order_id)
    _ensure_order_is_not_in_closed_weekly_closing(db, order)
    item = _get_order_item_or_404(order, item_id)
    _validate_item_print_registration(order, item, payload)

    item.quantity_printed += payload.quantity
    order.print_type = payload.print_type
    db.add(
        ProductionEvent(
            order_id=order.id,
            order_item_id=item.id,
            event_type=ProductionEventType.PRINT_REGISTERED,
            quantity=payload.quantity,
            notes=payload.notes,
        )
    )
    _sync_order_production_snapshot(db, order, payload.quantity)
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
) -> Order:
    order = _get_order_or_404(db, order_id)
    _ensure_order_is_not_in_closed_weekly_closing(db, order)
    item = _get_order_item_or_404(order, item_id)
    _validate_item_sewing_registration(item, payload)

    item.quantity_sewn += payload.quantity
    db.add(
        ProductionEvent(
            order_id=order.id,
            order_item_id=item.id,
            event_type=ProductionEventType.SEWING_REGISTERED,
            quantity=payload.quantity,
            notes=payload.notes,
        )
    )
    _sync_order_production_snapshot(db, order, payload.quantity)
    sync_order_items_delivery_status(order)

    db.commit()
    return _get_order_or_404(db, order.id)


@router.post("/{order_id}/outsourcing", response_model=OrderRead, status_code=201)
def create_order_outsourcing(
    order_id: int,
    payload: OutsourcingCreate,
    db: Annotated[Session, Depends(get_db)],
) -> Order:
    order = _get_order_or_404(db, order_id)
    _ensure_order_is_not_in_closed_weekly_closing(db, order)
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

    outsourcing_status = OutsourcingStatus.SENT
    outsourcing = OrderOutsourcing(
        order_id=order.id,
        order_item_id=item.id,
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
    db.add(outsourcing)
    db.add(
        ProductionEvent(
            order_id=order.id,
            order_item_id=item.id,
            event_type=ProductionEventType.OUTSOURCING_SENT,
            quantity=payload.quantity_sent,
            notes=payload.notes,
        )
    )

    _change_status(db, order, ProductionStatus.OUTSOURCED, payload.quantity_sent)

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
) -> Order:
    order = _get_order_or_404(db, order_id)
    _ensure_order_is_not_in_closed_weekly_closing(db, order)
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

    outsourcing.quantity_returned = new_returned_quantity
    if outsourcing.quantity_returned < outsourcing.quantity_sent:
        outsourcing.status = OutsourcingStatus.PARTIALLY_RETURNED
    else:
        outsourcing.status = OutsourcingStatus.RETURNED
        outsourcing.returned_at = _utcnow()

    db.add(
        ProductionEvent(
            order_id=order.id,
            order_item_id=outsourcing.order_item_id,
            event_type=ProductionEventType.OUTSOURCING_RETURNED,
            quantity=payload.quantity_returned,
            notes=payload.notes,
        )
    )

    if outsourcing.status == OutsourcingStatus.RETURNED:
        if outsourcing.order_item is not None:
            sync_item_delivery_status(outsourcing.order_item, order)
        _sync_order_production_snapshot(db, order, payload.quantity_returned)

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
) -> Order:
    order = _get_order_or_404(db, order_id)
    _ensure_order_is_not_in_closed_weekly_closing(db, order)
    outsourcing = _get_order_outsourcing_or_404(db, order_id, outsourcing_id)

    outsourcing.payout_status = PayoutStatus.PAID
    outsourcing.paid_at = payload.paid_at or _utcnow()
    if payload.notes:
        outsourcing.notes = _append_note(outsourcing.notes, payload.notes)

    db.add(
        ProductionEvent(
            order_id=order.id,
            event_type=ProductionEventType.OUTSOURCING_PAYOUT_PAID,
            quantity=outsourcing.quantity_sent,
            notes=payload.notes,
        )
    )

    db.commit()
    return _get_order_or_404(db, order.id)


def _order_has_movements(order: Order) -> bool:
    return (
        order.production_status != ProductionStatus.CREATED
        or order.quantity_cut > 0
        or order.quantity_printed > 0
        or order.quantity_sewn > 0
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


def _apply_safe_order_update(order: Order, payload: OrderUpdate) -> None:
    existing_items = {item.id: item for item in order.items}
    payload_ids = [item.id for item in payload.items]
    if any(item_id is None for item_id in payload_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Esta OS ja possui movimentacoes. Nao e possivel adicionar itens; "
                "apenas cor e observacoes podem ser alteradas."
            ),
        )
    if set(payload_ids) != set(existing_items):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Esta OS ja possui movimentacoes. Nao e possivel remover ou trocar itens; "
                "apenas cor e observacoes podem ser alteradas."
            ),
        )
    if payload.client_id != order.client_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Esta OS ja possui movimentacoes. Nao e possivel alterar o cliente; "
                "apenas cor e observacoes podem ser alteradas."
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

    for item_payload in payload.items:
        item = existing_items[item_payload.id]
        current_service_ids = [item_service.service_id for item_service in item.services]
        if (
            item_payload.product_id != item.product_id
            or item_payload.size_id != item.size_id
            or item_payload.sewing_mode != item.sewing_mode
            or item_payload.service_ids != current_service_ids
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Esta OS ja possui movimentacoes. Campos de produto, tamanho, "
                    "servicos e producao final nao podem ser alterados."
                ),
            )
        movement_floor = _item_quantity_movement_floor(order, item)
        if item_payload.quantity_requested < movement_floor:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Nao e possivel reduzir a quantidade abaixo do que ja foi produzido/entregue."
                ),
            )
        item.quantity_requested = item_payload.quantity_requested
        item.color = item_payload.color
        item.notes = item_payload.notes

    first_item = order.items[0]
    order.product_id = first_item.product_id
    order.size_id = first_item.size_id
    order.color = first_item.color
    order.notes = payload.notes
    _sync_order_totals(order)


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


def _replace_order_items(
    order: Order,
    items_with_services: list[tuple[object, list[Service]]],
) -> None:
    order.items.clear()
    order.services.clear()

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
            sewing_mode=_normalized_sewing_mode(item_payload, services),
            notes=item_payload.notes,
        )
        order.items.append(order_item)

        for service in services:
            unit_price = _money(service.price_per_unit)
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


def _sync_order_snapshot_from_items(order: Order) -> None:
    first_item = order.items[0]
    order.product_id = first_item.product_id
    order.size_id = first_item.size_id
    order.color = first_item.color
    order.quantity_requested = sum(item.quantity_requested for item in order.items)
    order.quantity_cut = sum(item.quantity_cut for item in order.items)
    order.quantity_printed = sum(item.quantity_printed for item in order.items)
    order.quantity_sewn = sum(item.quantity_sewn for item in order.items)
    order.quantity_extra = 0


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


def _get_order_or_404(db: Session, order_id: int) -> Order:
    query = (
        select(Order)
        .where(Order.id == order_id)
        .options(
            selectinload(Order.client),
            selectinload(Order.product),
            selectinload(Order.size),
            selectinload(Order.items).selectinload(OrderItem.product),
            selectinload(Order.items).selectinload(OrderItem.size),
            selectinload(Order.items)
            .selectinload(OrderItem.services)
            .selectinload(OrderItemService.service),
            selectinload(Order.services).selectinload(OrderService.service),
            selectinload(Order.payments),
            selectinload(Order.production_events),
            selectinload(Order.outsourcings).selectinload(OrderOutsourcing.outsourcer),
        )
    )
    order = db.scalar(query)
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    return order


def _get_order_item_or_404(order: Order, item_id: int) -> OrderItem:
    for item in order.items:
        if item.id == item_id:
            return item
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Order item not found",
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


def _ensure_order_is_not_in_closed_weekly_closing(db: Session, order: Order) -> None:
    if order.weekly_closing_id is None:
        return
    closing_status = db.scalar(
        select(WeeklyClosing.status).where(WeeklyClosing.id == order.weekly_closing_id)
    )
    if closing_status == WeeklyClosingStatus.CLOSED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Esta OS pertence a um fechamento semanal já fechado.",
        )


def _money(value: Decimal) -> Decimal:
    return value.quantize(MONEY_QUANTIZER)


def _validate_print_registration(order: Order, payload: PrintRegister) -> None:
    if order.production_status not in {
        ProductionStatus.CUT_DONE,
        ProductionStatus.IN_PRINT,
    }:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Printing is only allowed when production status is cut_done or in_print",
        )
    if order.quantity_cut == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot register printing before cut",
        )
    print_limit = min(order.quantity_cut, order.quantity_requested)
    if order.quantity_printed + payload.quantity > print_limit:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot print more than the order quantity available after cut",
        )
    if not _has_printing(order):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot register printing because this order has no serigrafia service",
        )

    product_name = _normalized_product_name(order.product.name)
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


def _validate_item_print_registration(
    order: Order,
    item: OrderItem,
    payload: PrintRegister,
) -> None:
    if not _item_has_printing(item):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Serigrafia nao faz parte do fluxo deste item.",
        )
    if item.quantity_cut == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nao e possivel registrar serigrafia antes do corte do item.",
        )
    if item.quantity_printed + payload.quantity > item.quantity_cut:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nao e possivel estampar mais do que a quantidade cortada do item.",
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


def _validate_sewing_registration(
    order: Order,
    payload: SewingRegister,
    has_printing: bool,
) -> None:
    allowed_statuses = (
        {ProductionStatus.PRINT_DONE, ProductionStatus.IN_SEWING}
        if has_printing
        else {ProductionStatus.CUT_DONE, ProductionStatus.IN_SEWING}
    )
    if order.production_status not in allowed_statuses:
        expected = "print_done or in_sewing" if has_printing else "cut_done or in_sewing"
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Sewing is only allowed when production status is {expected}",
        )
    if has_printing and order.quantity_sewn + payload.quantity > order.quantity_printed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot sew more than the printed quantity",
        )
    sewing_limit = (
        order.quantity_printed
        if has_printing
        else min(order.quantity_cut, order.quantity_requested)
    )
    if order.quantity_sewn + payload.quantity > sewing_limit:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot sew more than the order quantity available for sewing",
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
            detail="Nao e possivel registrar confeccao antes do corte do item.",
        )
    if _item_has_printing(item) and item.quantity_printed < item.quantity_requested:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nao e possivel registrar confeccao antes de concluir a serigrafia do item.",
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


def _validate_outsourcing_stage(order: Order) -> None:
    if order.production_status not in {
        ProductionStatus.CUT_DONE,
        ProductionStatus.PRINT_DONE,
    }:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Outsourcing is only allowed when production status is cut_done or print_done",
        )
    if not any(_item_is_ready_for_outsourcing(item) for item in order.items):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nenhum item desta OS esta pronto para terceirizacao.",
        )


def _validate_outsourcing_item(order: Order, order_item_id: int) -> OrderItem:
    item = _get_order_item_or_404(order, order_item_id)
    if item.sewing_mode != SewingMode.OUTSOURCED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este item nao esta configurado para terceirizacao.",
        )
    if item.quantity_cut < item.quantity_requested:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nao e possivel terceirizar antes de concluir o corte do item.",
        )
    if _item_has_printing(item) and item.quantity_printed < item.quantity_requested:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nao e possivel terceirizar antes de concluir a serigrafia do item.",
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
        for item in order.items
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


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _has_printing(order: Order) -> bool:
    return any(
        order_service.service.type == "serigrafia"
        for order_service in order.services
    )


def _item_has_printing(item: OrderItem) -> bool:
    return any(
        item_service.service.type == "serigrafia"
        for item_service in item.services
    )


def _item_has_cut(item: OrderItem) -> bool:
    return any(item_service.service.type == "corte" for item_service in item.services)


def _item_has_sewing(item: OrderItem) -> bool:
    return any(item_service.service.type == "confeccao" for item_service in item.services)


def _sync_order_production_snapshot(
    db: Session,
    order: Order,
    quantity: int | None,
) -> None:
    order.quantity_cut = sum(item.quantity_cut for item in order.items)
    order.quantity_printed = sum(item.quantity_printed for item in order.items)
    order.quantity_sewn = sum(item.quantity_sewn for item in order.items)
    order.quantity_extra = 0

    next_status = _derive_order_status_from_items(order)
    if next_status != order.production_status and _can_advance_status(
        order.production_status,
        next_status,
    ):
        _change_status(db, order, next_status, quantity)


def _derive_order_status_from_items(order: Order) -> ProductionStatus:
    if not order.items:
        return order.production_status
    if all(_item_is_complete(item, order) for item in order.items):
        return ProductionStatus.READY
    if any(item.quantity_sewn > 0 for item in order.items):
        return ProductionStatus.IN_SEWING
    print_items = [item for item in order.items if _item_has_printing(item)]
    if print_items and all(item.quantity_printed >= item.quantity_requested for item in print_items):
        return ProductionStatus.PRINT_DONE
    if any(item.quantity_printed > 0 for item in print_items):
        return ProductionStatus.IN_PRINT
    cut_items = [item for item in order.items if _item_has_cut(item)]
    if cut_items and all(item.quantity_cut >= item.quantity_requested for item in cut_items):
        return ProductionStatus.CUT_DONE
    if any(item.quantity_cut > 0 for item in cut_items):
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
    db.add(
        ProductionEvent(
            order_id=order.id,
            event_type=ProductionEventType.STATUS_CHANGED,
            quantity=quantity,
            from_status=previous_status,
            to_status=next_status,
        )
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
