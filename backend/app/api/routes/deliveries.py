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
    available_to_deliver,
    calculate_item_delivery_status,
    ready_to_deliver_quantity,
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
    q: str | None = None,
    queue: str | None = None,
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
        if _matches_filters(row, client, product, size, q, queue, status_filter)
    ]

    today = datetime.now(timezone.utc).date()
    summary = DeliverySummary(
        ready=sum(1 for row in rows if row.queue_status == "ready_for_pickup"),
        partial=sum(1 for row in rows if row.queue_status == "partial"),
        delivered=sum(1 for row in rows if row.queue_status == "delivered"),
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
        pending=sum(1 for row in rows if row.queue_status == "pending"),
        waiting_quantity=sum(row.quantity_available_to_deliver for row in rows),
        weak_proof=sum(1 for row in rows if row.has_weak_delivery_proof),
    )
    return DeliveryListRead(summary=summary, items=filtered_rows)


@router.post("/{order_item_id}/register", response_model=DeliveryItemRead, status_code=201)
def register_delivery(
    order_item_id: int,
    payload: DeliveryRegister,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> DeliveryItemRead:
    order, item = _get_order_item_with_delivery_context(db, order_item_id, for_update=True)
    if order.production_paused:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A producao desta OS esta pausada. Retome a OS antes de registrar entrega.",
        )
    sync_item_delivery_status(item, order)

    if item.delivery_status == DeliveryStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este item ainda nao esta pronto para entrega.",
        )

    picked_up_by = _clean_required_text(payload.picked_up_by)
    pickup_document = _clean_required_text(payload.pickup_document)
    if picked_up_by is None or pickup_document is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Informe quem retirou e um documento ou contato para registrar a entrega.",
        )

    available_now = available_to_deliver(item, order)
    if payload.quantity > available_now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Quantidade entregue excede o disponivel para entrega agora ({available_now}).",
        )

    item.quantity_delivered += payload.quantity
    user_name = user.name or user.email
    item.delivery_history.append(
        DeliveryHistory(
            order_id=order.id,
            quantity=payload.quantity,
            user_id=user.id,
            user_name_snapshot=user_name,
            responsible=user_name,
            picked_up_by=picked_up_by,
            pickup_document=pickup_document,
            delivery_notes=_clean_optional_text(payload.delivery_notes),
            notes=_clean_optional_text(payload.notes),
        )
    )
    db.add(
        ProductionEvent(
            order_id=order.id,
            order_item_id=item.id,
            event_type=ProductionEventType.DELIVERY_REGISTERED,
            stage="delivered",
            quantity=payload.quantity,
            notes=_clean_optional_text(payload.delivery_notes) or _clean_optional_text(payload.notes),
            user_id=user.id,
            user_name_snapshot=user_name,
        )
    )
    sync_item_delivery_status(item, order)
    _mark_order_delivered_if_complete(db, order, payload.quantity, user)

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
            selectinload(Order.production_events),
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
    *,
    for_update: bool = False,
) -> tuple[Order, OrderItem]:
    if for_update:
        order_id = db.scalar(select(OrderItem.order_id).where(OrderItem.id == order_item_id))
        if order_id is not None:
            db.scalar(select(Order).where(Order.id == order_id).with_for_update())
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
            selectinload(OrderItem.order).selectinload(Order.production_events),
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
    quantity_ready_total = ready_to_deliver_quantity(item, order)
    quantity_available = available_to_deliver(item, order)
    quantity_remaining = max(item.quantity_requested - item.quantity_delivered, 0)
    status_value = delivery_status or item.delivery_status
    queue_status = _queue_status(item, quantity_available, quantity_remaining)
    operational_status = _operational_status(item, quantity_ready_total, quantity_available, quantity_remaining)
    ready_since = item.available_since or _ready_since(order, item, quantity_ready_total)
    last_delivery = item.delivery_history[-1] if item.delivery_history else None
    first_delivery = item.delivery_history[0] if item.delivery_history else None
    now = datetime.now(timezone.utc)
    important_notes = _important_notes(item)
    has_weak_proof = any(
        not _clean_required_text(entry.picked_up_by)
        or not _clean_required_text(entry.pickup_document)
        for entry in item.delivery_history
    )
    bottleneck_flags = _bottleneck_flags(
        queue_status=queue_status,
        quantity_available=quantity_available,
        ready_waiting_days=_days_since(ready_since, now),
        last_delivery_days=_days_since(last_delivery.delivered_at, now) if last_delivery else None,
        has_weak_proof=has_weak_proof,
    )
    return DeliveryItemRead(
        order_id=order.id,
        order_item_id=item.id,
        production_paused=order.production_paused,
        client=order.client,
        product=item.product,
        size=item.size,
        color=item.color,
        quantity_requested=item.quantity_requested,
        quantity_ready=quantity_available,
        quantity_ready_total=quantity_ready_total,
        quantity_available_to_deliver=quantity_available,
        quantity_delivered=item.quantity_delivered,
        quantity_remaining=quantity_remaining,
        quantity_pending_production=max(item.quantity_requested - item.quantity_delivered - quantity_available, 0),
        delivery_status=status_value,
        queue_status=queue_status,
        operational_status=operational_status,
        delivered_at=item.delivered_at,
        ready_since=ready_since,
        available_since=item.available_since,
        ready_waiting_days=_days_since(ready_since, now) if quantity_available > 0 else None,
        last_delivery_at=last_delivery.delivered_at if last_delivery else None,
        last_delivery_days=_days_since(last_delivery.delivered_at, now) if last_delivery else None,
        partially_delivered_since=first_delivery.delivered_at if item.quantity_delivered > 0 and quantity_remaining > 0 and first_delivery else None,
        partially_delivered_days=_days_since(first_delivery.delivered_at, now) if item.quantity_delivered > 0 and quantity_remaining > 0 and first_delivery else None,
        last_picked_up_by=last_delivery.picked_up_by if last_delivery else None,
        last_pickup_document=last_delivery.pickup_document if last_delivery else None,
        has_multiple_deliveries=len(item.delivery_history) > 1,
        has_weak_delivery_proof=has_weak_proof,
        important_notes=important_notes,
        bottleneck_flags=bottleneck_flags,
        history=list(item.delivery_history),
    )


def _matches_filters(
    row: DeliveryItemRead,
    client: str | None,
    product: str | None,
    size: str | None,
    q: str | None,
    queue: str | None,
    status_filter: DeliveryStatus | None,
) -> bool:
    if client and row.client.name != client:
        return False
    if product and row.product.name != product:
        return False
    if size and row.size.label != size:
        return False
    if queue and row.queue_status != queue:
        return False
    if status_filter and row.delivery_status != status_filter:
        return False
    if q and not _matches_search(row, q):
        return False
    return True


def _mark_order_delivered_if_complete(
    db: Session,
    order: Order,
    quantity: int,
    user: User,
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
            user_id=user.id,
            user_name_snapshot=user.name or user.email,
            from_status=previous_status,
            to_status=ProductionStatus.DELIVERED,
        )
    )


def _queue_status(
    item: OrderItem,
    quantity_available: int,
    quantity_remaining: int,
) -> str:
    if quantity_remaining == 0:
        return "delivered"
    if item.quantity_delivered > 0:
        return "partial"
    if quantity_available > 0:
        return "ready_for_pickup"
    return "pending"


def _operational_status(
    item: OrderItem,
    quantity_ready_total: int,
    quantity_available: int,
    quantity_remaining: int,
) -> str:
    if quantity_remaining == 0:
        return "delivered_total"
    if item.quantity_delivered > 0:
        if quantity_available > 0:
            return "delivered_partial_waiting_pickup"
        return "delivered_partial_waiting_production"
    if quantity_available > 0:
        if quantity_ready_total >= item.quantity_requested:
            return "ready_total_waiting_pickup"
        return "ready_partial_waiting_pickup"
    return "waiting_production"


def _ready_since(order: Order, item: OrderItem, quantity_ready_total: int) -> datetime | None:
    if quantity_ready_total <= 0:
        return None
    event_types = _ready_event_types(item)
    if not event_types:
        return order.created_at
    threshold = item.quantity_requested if quantity_ready_total >= item.quantity_requested else 1
    running_total = 0
    candidate: datetime | None = None
    for event in sorted(order.production_events, key=lambda event: event.created_at):
        if event.order_item_id != item.id or event.event_type not in event_types:
            continue
        running_total += event.quantity or 0
        candidate = event.created_at
        if running_total >= threshold:
            return event.created_at
    return candidate


def _ready_event_types(item: OrderItem) -> set[ProductionEventType]:
    service_types = {_normalize_service_type(item_service.service.type) for item_service in item.services}
    service_names = {_normalize_service_type(item_service.service.name) for item_service in item.services}
    has_sewing = "confeccao" in service_types or any("confec" in name for name in service_names)
    has_printing = "serigrafia" in service_types or any("serigrafia" in name or "dtf" in name for name in service_names)
    has_cut = "corte" in service_types or any("corte" in name for name in service_names)
    if item.sewing_mode and item.sewing_mode.value == "outsourced":
        return {ProductionEventType.OUTSOURCING_RETURNED}
    if has_sewing:
        return {ProductionEventType.SEWING_REGISTERED}
    if has_printing:
        return {ProductionEventType.PRINT_REGISTERED}
    if has_cut:
        return {ProductionEventType.CUT_REGISTERED}
    return set()


def _days_since(value: datetime | None, now: datetime) -> int | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return max((now - value).days, 0)


def _important_notes(item: OrderItem) -> list[str]:
    notes: list[str] = []
    if item.notes:
        notes.append(item.notes)
    return notes


def _bottleneck_flags(
    queue_status: str,
    quantity_available: int,
    ready_waiting_days: int | None,
    last_delivery_days: int | None,
    has_weak_proof: bool,
) -> list[str]:
    flags: list[str] = []
    if quantity_available > 0 and ready_waiting_days is not None and ready_waiting_days >= 3:
        flags.append("ready_waiting_too_long")
    if queue_status == "partial":
        flags.append("partial_delivery")
        if last_delivery_days is not None and last_delivery_days >= 3:
            flags.append("partial_stopped")
    if has_weak_proof:
        flags.append("weak_delivery_proof")
    return flags


def _matches_search(row: DeliveryItemRead, query: str) -> bool:
    needle = _normalize_service_type(query)
    if not needle:
        return True
    values = [
        str(row.order_id),
        row.client.name,
        row.product.name,
        row.color,
        row.size.label,
        row.operational_status,
        *row.important_notes,
    ]
    for entry in row.history:
        values.extend(
            [
                entry.picked_up_by or "",
                entry.pickup_document or "",
                entry.delivery_notes or "",
                entry.notes or "",
                entry.responsible,
            ]
        )
    return needle in _normalize_service_type(" ".join(values))


def _clean_required_text(value: str | None) -> str | None:
    cleaned = _clean_optional_text(value)
    return cleaned or None


def _clean_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = " ".join(value.split())
    return cleaned or None


def _normalize_service_type(value: str) -> str:
    import unicodedata

    normalized = unicodedata.normalize("NFKD", value)
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii")
    return " ".join(ascii_value.lower().split())
