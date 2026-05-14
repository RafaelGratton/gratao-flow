from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import DeliveryStatus
from app.schemas.client import ClientRead
from app.schemas.product import ProductRead
from app.schemas.size import SizeRead


class DeliveryHistoryRead(BaseModel):
    id: int
    order_id: int
    order_item_id: int
    quantity: int
    user_id: int | None
    user_name_snapshot: str | None
    responsible: str
    picked_up_by: str | None
    pickup_document: str | None
    delivery_notes: str | None
    notes: str | None
    delivered_at: datetime
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DeliveryItemRead(BaseModel):
    order_id: int
    order_item_id: int
    client: ClientRead
    product: ProductRead
    size: SizeRead
    color: str
    quantity_requested: int
    quantity_ready: int
    quantity_ready_total: int
    quantity_available_to_deliver: int
    quantity_delivered: int
    quantity_remaining: int
    quantity_pending_production: int
    delivery_status: DeliveryStatus
    queue_status: str
    operational_status: str
    delivered_at: datetime | None
    ready_since: datetime | None
    available_since: datetime | None
    ready_waiting_days: int | None
    last_delivery_at: datetime | None
    last_delivery_days: int | None
    partially_delivered_since: datetime | None
    partially_delivered_days: int | None
    last_picked_up_by: str | None
    last_pickup_document: str | None
    has_multiple_deliveries: bool
    has_weak_delivery_proof: bool
    important_notes: list[str] = Field(default_factory=list)
    bottleneck_flags: list[str] = Field(default_factory=list)
    history: list[DeliveryHistoryRead]


class DeliverySummary(BaseModel):
    ready: int
    partial: int
    delivered: int
    partially_delivered: int
    delivered_today: int
    pending: int
    waiting_quantity: int
    weak_proof: int


class DeliveryListRead(BaseModel):
    summary: DeliverySummary
    items: list[DeliveryItemRead]


class DeliveryRegister(BaseModel):
    quantity: int = Field(gt=0)
    picked_up_by: str | None = None
    pickup_document: str | None = None
    delivery_notes: str | None = None
    notes: str | None = None
