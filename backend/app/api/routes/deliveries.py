from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.enums import DeliveryStatus, ProductionEventType, ProductionStatus
from app.models.order import DeliveryHistory, Order, OrderItem, OrderItemService, ProductionEvent
from app.models.user import User
from app.schemas.delivery import (
    DeliveryItemRead,
    DeliveryListRead,
    DeliveryRegister,
    DeliverySummary,
)
from app.services.deliveries import (
    calculate_item_delivery_status,
    sync_item_delivery_status,
    sync_order_items_delivery_status,
)

router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("", response_model=DeliveryListRead)
def list_deliveries(
    db: Annotated[Session, Depends(get_db)],
    client: str | None = None,
    product: str | None = None,
    size: str | None = None,
    status_filter: Annotated[DeliveryStatus | None, Query(alias="status")] = None,
) -> DeliveryListRead:
    orders = _get_delivery_orders(db)
    rows = [
        _build_delivery_item(
            order,
            item,
            delivery_status=calculate_item_delivery_status(item, order),
        )
        for order in orders
        for item in order.items
    ]
    filtered_rows = [
        row
        for row in rows
        if _matches_filters(row, client, product, size, status_filter)
    ]

    today = datetime.now(timezone.utc).date()
    summary = DeliverySummary(
        ready=sum(1 for row in rows if row.delivery_status == DeliveryStatus.READY),
        partially_delivered=sum(
            1 for row in rows if row.delivery_status == DeliveryStatus.PARTIALLY_DELIVERED
        ),
        delivered_today=sum(
            1
            for row in rows
            if row.delivery_status == DeliveryStatus.DELIVERED
            and row.delivered_at is not None
            and row.delivered_at.date() == today
        ),
        pending=sum(1 for row in rows if row.delivery_status == DeliveryStatus.PENDING),
    )
    return DeliveryListRead(summary=summary, items=filtered_rows)


@router.post("/{order_item_id}/register", response_model=DeliveryItemRead, status_code=201)
def register_delivery(
    order_item_id: int,
    payload: DeliveryRegister,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> DeliveryItemRead:
    order, item = _get_order_item_with_delivery_context(db, order_item_id)
    sync_item_delivery_status(item, order)

    if item.delivery_status == DeliveryStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este item ainda nao esta pronto para entrega.",
        )

    remaining = item.quantity_requested - item.quantity_delivered
    if payload.quantity > remaining:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Quantidade entregue excede o solicitado. Faltam entregar {remaining}.",
        )

    item.quantity_delivered += payload.quantity
    item.delivery_history.append(
        DeliveryHistory(
            order_id=order.id,
            quantity=payload.quantity,
            responsible=user.name or user.email,
            notes=payload.notes,
        )
    )
    sync_item_delivery_status(item, order)
    _mark_order_delivered_if_complete(db, order, payload.quantity)

    db.commit()
    order, item = _get_order_item_with_delivery_context(db, order_item_id)
    return _build_delivery_item(order, item)


def _get_delivery_orders(db: Session) -> list[Order]:
    query = (
        select(Order)
        .where(Order.production_status != ProductionStatus.CANCELLED)
        .options(
            selectinload(Order.client),
            selectinload(Order.outsourcings),
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


def _get_order_item_with_delivery_context(
    db: Session,
    order_item_id: int,
) -> tuple[Order, OrderItem]:
    query = (
        select(OrderItem)
        .where(OrderItem.id == order_item_id)
        .options(
            selectinload(OrderItem.product),
            selectinload(OrderItem.size),
            selectinload(OrderItem.delivery_history),
            selectinload(OrderItem.services).selectinload(OrderItemService.service),
            selectinload(OrderItem.order).selectinload(Order.client),
            selectinload(OrderItem.order).selectinload(Order.outsourcings),
            selectinload(OrderItem.order).selectinload(Order.items).selectinload(OrderItem.product),
            selectinload(OrderItem.order).selectinload(Order.items).selectinload(OrderItem.size),
            selectinload(OrderItem.order)
            .selectinload(Order.items)
            .selectinload(OrderItem.delivery_history),
            selectinload(OrderItem.order)
            .selectinload(Order.items)
            .selectinload(OrderItem.services)
            .selectinload(OrderItemService.service),
        )
    )
    item = db.scalar(query)
    if item is None or item.order.production_status == ProductionStatus.CANCELLED:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item de entrega nao encontrado.",
        )
    return item.order, item


def _build_delivery_item(
    order: Order,
    item: OrderItem,
    delivery_status: DeliveryStatus | None = None,
) -> DeliveryItemRead:
    return DeliveryItemRead(
        order_id=order.id,
        order_item_id=item.id,
        client=order.client,
        product=item.product,
        size=item.size,
        color=item.color,
        quantity_requested=item.quantity_requested,
        quantity_delivered=item.quantity_delivered,
        quantity_remaining=max(item.quantity_requested - item.quantity_delivered, 0),
        delivery_status=delivery_status or item.delivery_status,
        delivered_at=item.delivered_at,
        history=list(item.delivery_history),
    )


def _matches_filters(
    row: DeliveryItemRead,
    client: str | None,
    product: str | None,
    size: str | None,
    status_filter: DeliveryStatus | None,
) -> bool:
    if client and row.client.name != client:
        return False
    if product and row.product.name != product:
        return False
    if size and row.size.label != size:
        return False
    if status_filter and row.delivery_status != status_filter:
        return False
    return True


def _mark_order_delivered_if_complete(
    db: Session,
    order: Order,
    quantity: int,
) -> None:
    sync_order_items_delivery_status(order)
    if not order.items:
        return
    if not all(item.delivery_status == DeliveryStatus.DELIVERED for item in order.items):
        return
    if order.production_status in {ProductionStatus.DELIVERED, ProductionStatus.CANCELLED}:
        return

    previous_status = order.production_status
    order.production_status = ProductionStatus.DELIVERED
    db.add(
        ProductionEvent(
            order_id=order.id,
            event_type=ProductionEventType.STATUS_CHANGED,
            quantity=quantity,
            from_status=previous_status,
            to_status=ProductionStatus.DELIVERED,
        )
    )
