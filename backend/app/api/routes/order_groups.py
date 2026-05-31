from datetime import datetime, timezone
from decimal import Decimal
from typing import Annotated, Iterable

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.client import Client
from app.models.enums import ProductionStatus
from app.models.order import (
    ClientOrderGroup,
    Order,
    OrderItem,
    OrderItemService,
    OrderService,
)
from app.models.outsourcing import OrderOutsourcing
from app.models.user import User
from app.schemas.order_group import (
    ClientOrderGroupCreate,
    ClientOrderGroupOrderSummary,
    ClientOrderGroupRead,
    ClientOrderGroupUpdate,
)
from app.schemas.report import ClientOrderGroupReport, InternalOrderGroupReport
from app.services.reports import (
    build_client_order_group_report,
    build_internal_order_group_report,
    derive_order_group_financial_status,
    derive_order_group_production_status,
    generate_client_order_group_report_pdf,
    generate_internal_order_group_report_pdf,
)

router = APIRouter(dependencies=[Depends(get_current_user)])

MONEY_QUANTIZER = Decimal("0.01")


@router.get("", response_model=list[ClientOrderGroupRead])
def list_order_groups(db: Annotated[Session, Depends(get_db)]) -> list[ClientOrderGroupRead]:
    groups = list(
        db.scalars(
            select(ClientOrderGroup)
            .options(*_group_load_options())
            .order_by(ClientOrderGroup.created_at.desc())
        )
    )
    return [_serialize_group(group) for group in groups]


@router.post("", response_model=ClientOrderGroupRead, status_code=201)
def create_order_group(
    payload: ClientOrderGroupCreate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
) -> ClientOrderGroupRead:
    client = _get_active_client_or_404(db, payload.client_id)
    orders = _get_orders_for_linking(db, payload.order_ids)
    _validate_orders_can_link(client.id, orders)

    group = ClientOrderGroup(
        client_id=client.id,
        reference=payload.reference,
        notes=_clean_optional_text(payload.notes),
    )
    db.add(group)
    db.flush()

    for order in orders:
        order.client_order_group_id = group.id

    db.commit()
    return _serialize_group(_get_group_or_404(db, group.id))


@router.get("/{group_id}", response_model=ClientOrderGroupRead)
def get_order_group(
    group_id: int,
    db: Annotated[Session, Depends(get_db)],
) -> ClientOrderGroupRead:
    return _serialize_group(_get_group_or_404(db, group_id))


@router.put("/{group_id}", response_model=ClientOrderGroupRead)
def update_order_group(
    group_id: int,
    payload: ClientOrderGroupUpdate,
    db: Annotated[Session, Depends(get_db)],
) -> ClientOrderGroupRead:
    group = _get_group_or_404(db, group_id)
    group.reference = payload.reference
    group.notes = _clean_optional_text(payload.notes)
    group.updated_at = _utcnow()
    db.commit()
    return _serialize_group(_get_group_or_404(db, group.id))


@router.delete("/{group_id}", status_code=204)
def delete_order_group(
    group_id: int,
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    group = _get_group_or_404(db, group_id)
    for order in group.orders:
        order.client_order_group_id = None
    db.delete(group)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{group_id}/available-orders", response_model=list[ClientOrderGroupOrderSummary])
def list_available_orders(
    group_id: int,
    db: Annotated[Session, Depends(get_db)],
) -> list[Order]:
    group = _get_group_or_404(db, group_id)
    return list(
        db.scalars(
            select(Order)
            .where(
                Order.client_id == group.client_id,
                Order.client_order_group_id.is_(None),
                Order.production_status != ProductionStatus.CANCELLED,
            )
            .options(*_order_load_options())
            .order_by(Order.created_at.desc())
        )
    )


@router.post("/{group_id}/orders/{order_id}", response_model=ClientOrderGroupRead, status_code=201)
def link_order_to_group(
    group_id: int,
    order_id: int,
    db: Annotated[Session, Depends(get_db)],
) -> ClientOrderGroupRead:
    group = _get_group_or_404(db, group_id)
    order = _get_order_or_404(db, order_id, for_update=True)
    _validate_order_can_link(group.client_id, order)
    order.client_order_group_id = group.id
    group.updated_at = _utcnow()
    db.commit()
    return _serialize_group(_get_group_or_404(db, group.id))


@router.delete("/{group_id}/orders/{order_id}", response_model=ClientOrderGroupRead)
def unlink_order_from_group(
    group_id: int,
    order_id: int,
    db: Annotated[Session, Depends(get_db)],
) -> ClientOrderGroupRead:
    group = _get_group_or_404(db, group_id)
    order = _get_order_or_404(db, order_id, for_update=True)
    if order.client_order_group_id != group.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Esta OS nao pertence a este Pedido de Cliente.",
        )
    order.client_order_group_id = None
    group.updated_at = _utcnow()
    db.commit()
    return _serialize_group(_get_group_or_404(db, group.id))


@router.get("/{group_id}/report/internal", response_model=InternalOrderGroupReport)
def get_internal_order_group_report(
    group_id: int,
    db: Annotated[Session, Depends(get_db)],
) -> InternalOrderGroupReport:
    return build_internal_order_group_report(_get_group_or_404(db, group_id))


@router.get("/{group_id}/report/client", response_model=ClientOrderGroupReport)
def get_client_order_group_report(
    group_id: int,
    db: Annotated[Session, Depends(get_db)],
) -> ClientOrderGroupReport:
    return build_client_order_group_report(_get_group_or_404(db, group_id))


@router.get("/{group_id}/report/internal/pdf")
def get_internal_order_group_report_pdf(
    group_id: int,
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    report = build_internal_order_group_report(_get_group_or_404(db, group_id))
    pdf = generate_internal_order_group_report_pdf(report)
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="order-group-{group_id}-internal-report.pdf"'
        },
    )


@router.get("/{group_id}/report/client/pdf")
def get_client_order_group_report_pdf(
    group_id: int,
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    report = build_client_order_group_report(_get_group_or_404(db, group_id))
    pdf = generate_client_order_group_report_pdf(report)
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="order-group-{group_id}-client-report.pdf"'
        },
    )


def _serialize_group(group: ClientOrderGroup) -> ClientOrderGroupRead:
    orders = list(group.orders)
    total_amount = _sum_money(order.total_amount for order in orders)
    amount_paid = _sum_money(order.amount_paid for order in orders)
    amount_due = _sum_money(order.amount_due for order in orders)
    return ClientOrderGroupRead(
        id=group.id,
        client_id=group.client_id,
        client=group.client,
        reference=group.reference,
        notes=group.notes,
        production_status=derive_order_group_production_status(orders),
        financial_status=derive_order_group_financial_status(total_amount, amount_paid),
        total_amount=total_amount,
        amount_paid=amount_paid,
        amount_due=amount_due,
        quantity_requested=sum(order.quantity_requested for order in orders),
        order_count=len(orders),
        outsourcing_revenue_total=_sum_money(order.outsourcing_revenue_total for order in orders),
        outsourcing_cost_total=_sum_money(order.outsourcing_cost_total for order in orders),
        outsourcing_paid_total=_sum_money(order.outsourcing_paid_total for order in orders),
        outsourcing_pending_total=_sum_money(order.outsourcing_pending_total for order in orders),
        estimated_result=_sum_money(order.estimated_result for order in orders),
        orders=orders,
        created_at=group.created_at,
        updated_at=group.updated_at,
    )


def _get_group_or_404(db: Session, group_id: int) -> ClientOrderGroup:
    group = db.scalar(
        select(ClientOrderGroup)
        .where(ClientOrderGroup.id == group_id)
        .options(*_group_load_options())
    )
    if group is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pedido de Cliente nao encontrado.",
        )
    return group


def _get_order_or_404(db: Session, order_id: int, *, for_update: bool = False) -> Order:
    query = select(Order).where(Order.id == order_id).options(*_order_load_options())
    if for_update:
        query = query.with_for_update()
    order = db.scalar(query)
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="OS nao encontrada.")
    return order


def _get_active_client_or_404(db: Session, client_id: int) -> Client:
    client = db.get(Client, client_id)
    if client is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente nao encontrado.")
    if not client.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cliente inativo nao pode receber Pedido de Cliente.",
        )
    return client


def _get_orders_for_linking(db: Session, order_ids: list[int]) -> list[Order]:
    unique_ids = list(dict.fromkeys(order_ids))
    if len(unique_ids) != len(order_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A mesma OS foi informada mais de uma vez.",
        )
    orders = list(
        db.scalars(
            select(Order)
            .where(Order.id.in_(unique_ids))
            .options(*_order_load_options())
            .with_for_update()
        )
    )
    found_ids = {order.id for order in orders}
    missing_ids = [order_id for order_id in unique_ids if order_id not in found_ids]
    if missing_ids:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"OS nao encontrada(s): {', '.join(str(order_id) for order_id in missing_ids)}.",
        )
    return orders


def _validate_orders_can_link(client_id: int, orders: list[Order]) -> None:
    for order in orders:
        _validate_order_can_link(client_id, order)


def _validate_order_can_link(client_id: int, order: Order) -> None:
    if order.client_id != client_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A OS pertence a outro cliente e nao pode ser vinculada a este Pedido de Cliente.",
        )
    if order.client_order_group_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A OS ja esta vinculada a outro Pedido de Cliente.",
        )


def _group_load_options() -> tuple[object, ...]:
    return (
        selectinload(ClientOrderGroup.client),
        selectinload(ClientOrderGroup.orders).selectinload(Order.client),
        selectinload(ClientOrderGroup.orders).selectinload(Order.product),
        selectinload(ClientOrderGroup.orders).selectinload(Order.size),
        selectinload(ClientOrderGroup.orders).selectinload(Order.payments),
        selectinload(ClientOrderGroup.orders)
        .selectinload(Order.items)
        .selectinload(OrderItem.product),
        selectinload(ClientOrderGroup.orders)
        .selectinload(Order.items)
        .selectinload(OrderItem.size),
        selectinload(ClientOrderGroup.orders)
        .selectinload(Order.items)
        .selectinload(OrderItem.delivery_history),
        selectinload(ClientOrderGroup.orders)
        .selectinload(Order.items)
        .selectinload(OrderItem.services)
        .selectinload(OrderItemService.service),
        selectinload(ClientOrderGroup.orders)
        .selectinload(Order.services)
        .selectinload(OrderService.service),
        selectinload(ClientOrderGroup.orders).selectinload(Order.production_events),
        selectinload(ClientOrderGroup.orders)
        .selectinload(Order.outsourcings)
        .selectinload(OrderOutsourcing.outsourcer),
    )


def _order_load_options() -> tuple[object, ...]:
    return (
        selectinload(Order.client),
        selectinload(Order.product),
        selectinload(Order.size),
        selectinload(Order.payments),
        selectinload(Order.items).selectinload(OrderItem.product),
        selectinload(Order.items).selectinload(OrderItem.size),
        selectinload(Order.items).selectinload(OrderItem.delivery_history),
        selectinload(Order.items)
        .selectinload(OrderItem.services)
        .selectinload(OrderItemService.service),
        selectinload(Order.services).selectinload(OrderService.service),
        selectinload(Order.production_events),
        selectinload(Order.outsourcings).selectinload(OrderOutsourcing.outsourcer),
    )


def _sum_money(values: Iterable[Decimal]) -> Decimal:
    return sum(values, Decimal("0.00")).quantize(MONEY_QUANTIZER)


def _clean_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = " ".join(value.split())
    return cleaned or None


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)
