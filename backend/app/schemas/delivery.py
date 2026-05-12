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
    responsible: str
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
    quantity_delivered: int
    quantity_remaining: int
    quantity_pending_production: int
    delivery_status: DeliveryStatus
    delivered_at: datetime | None
    history: list[DeliveryHistoryRead]


class DeliverySummary(BaseModel):
    ready: int
    partially_delivered: int
    delivered_today: int
    pending: int


class DeliveryListRead(BaseModel):
    summary: DeliverySummary
    items: list[DeliveryItemRead]


class DeliveryRegister(BaseModel):
    quantity: int = Field(gt=0)
    notes: str | None = None
