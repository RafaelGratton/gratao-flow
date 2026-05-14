from datetime import datetime, timezone
import unicodedata

from app.models.enums import DeliveryStatus, OutsourcingStatus, SewingMode
from app.models.service import Service
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
    available_quantity = available_to_deliver(item, order)
    next_status = calculate_item_delivery_status(item, order)
    item.delivery_status = next_status
    if available_quantity > 0 and item.available_since is None:
        item.available_since = datetime.now(timezone.utc)
    if available_quantity <= 0 and item.quantity_delivered == 0:
        item.available_since = None
    if next_status == DeliveryStatus.DELIVERED and item.delivered_at is None:
        item.delivered_at = datetime.now(timezone.utc)


def sync_order_items_delivery_status(order: Order) -> None:
    for item in order.items:
        sync_item_delivery_status(item, order)


def item_is_ready_for_delivery(item: OrderItem, order: Order) -> bool:
    return available_to_deliver(item, order) > 0


def available_to_deliver(item: OrderItem, order: Order) -> int:
    ready_quantity = ready_to_deliver_quantity(item, order)
    return max(ready_quantity - item.quantity_delivered, 0)


def ready_to_deliver_quantity(item: OrderItem, order: Order) -> int:
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
    return min(ready_quantity, item.quantity_requested)


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
        _service_matches(item_service.service, service_type)
        for item_service in item.services
    )


def _service_matches(service: Service, service_type: str) -> bool:
    normalized_type = _normalize(service_type)
    service_type_value = _normalize(service.type)
    service_name_value = _normalize(service.name)
    aliases = {
        "serigrafia": {"dtf"},
        "confeccao": {"confec"},
        "corte": set(),
    }.get(normalized_type, set())
    return (
        service_type_value == normalized_type
        or normalized_type in service_name_value
        or any(alias in service_name_value for alias in aliases)
    )


def _normalize(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii")
    return " ".join(ascii_value.lower().split())
