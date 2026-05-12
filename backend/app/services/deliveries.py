from datetime import datetime, timezone

from app.models.enums import DeliveryStatus, OutsourcingStatus, SewingMode
from app.models.order import Order, OrderItem


def calculate_item_delivery_status(item: OrderItem, order: Order) -> DeliveryStatus:
    if item.quantity_delivered >= item.quantity_requested:
        return DeliveryStatus.DELIVERED
    if item.quantity_delivered > 0:
        return DeliveryStatus.PARTIALLY_DELIVERED
    if item_is_ready_for_delivery(item, order):
        return DeliveryStatus.READY
    return DeliveryStatus.PENDING


def sync_item_delivery_status(item: OrderItem, order: Order) -> None:
    next_status = calculate_item_delivery_status(item, order)
    item.delivery_status = next_status
    if next_status == DeliveryStatus.DELIVERED and item.delivered_at is None:
        item.delivered_at = datetime.now(timezone.utc)


def sync_order_items_delivery_status(order: Order) -> None:
    for item in order.items:
        sync_item_delivery_status(item, order)


def item_is_ready_for_delivery(item: OrderItem, order: Order) -> bool:
    return available_to_deliver(item, order) > 0


def available_to_deliver(item: OrderItem, order: Order) -> int:
    if item.sewing_mode == SewingMode.OUTSOURCED:
        ready_quantity = _outsourced_returned_quantity(item, order)
    elif _item_has_service(item, "confeccao"):
        ready_quantity = item.quantity_sewn
    elif _item_has_service(item, "serigrafia"):
        ready_quantity = item.quantity_printed
    elif _item_has_service(item, "corte"):
        ready_quantity = item.quantity_cut
    else:
        ready_quantity = item.quantity_requested
    return max(ready_quantity - item.quantity_delivered, 0)


def _outsourced_returned_quantity(item: OrderItem, order: Order) -> int:
    active_outsourcings = [
        outsourcing
        for outsourcing in order.outsourcings
        if outsourcing.order_item_id == item.id
        and outsourcing.status != OutsourcingStatus.CANCELLED
    ]
    if not active_outsourcings:
        return 0
    return sum(outsourcing.quantity_returned for outsourcing in active_outsourcings)


def _item_has_service(item: OrderItem, service_type: str) -> bool:
    return any(
        item_service.service.type == service_type
        for item_service in item.services
    )
