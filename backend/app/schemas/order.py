from datetime import datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator, model_validator

from app.models.enums import (
    DeliveryStatus,
    FinancialStatus,
    OperationalPriority,
    PaymentMethod,
    PrintType,
    ProductionEventType,
    ProductionStatus,
    SewingMode,
)
from app.schemas.client import ClientRead
from app.schemas.delivery import DeliveryHistoryRead
from app.schemas.product import ProductRead
from app.schemas.outsourcing import OrderOutsourcingRead
from app.schemas.service import ServiceRead
from app.schemas.size import SizeRead

MoneyDecimal = Annotated[
    Decimal,
    Field(
        ge=Decimal("0"),
        max_digits=10,
        decimal_places=2,
        examples=[450.00],
        json_schema_extra={"example": 450.00},
    ),
]

PositiveMoneyDecimal = Annotated[
    Decimal,
    Field(
        gt=Decimal("0"),
        max_digits=10,
        decimal_places=2,
        examples=[200.00],
        json_schema_extra={"example": 200.00},
    ),
]


class OrderItemCreate(BaseModel):
    product_id: int
    size_id: int
    color: str
    quantity_requested: int = Field(gt=0)
    operational_priority: OperationalPriority = OperationalPriority.NORMAL
    sewing_mode: SewingMode | None = None
    notes: str | None = None
    service_ids: list[int] = Field(min_length=1)


class OrderItemUpdate(BaseModel):
    id: int | None = None
    product_id: int
    size_id: int
    color: str
    quantity_requested: int = Field(gt=0)
    operational_priority: OperationalPriority = OperationalPriority.NORMAL
    sewing_mode: SewingMode | None = None
    notes: str | None = None
    service_ids: list[int] = Field(min_length=1)


class OrderCreate(BaseModel):
    client_id: int
    items: list[OrderItemCreate] | None = None
    product_id: int | None = None
    size_id: int | None = None
    color: str | None = None
    quantity_requested: int | None = Field(default=None, gt=0)
    allow_printing_exception: bool = False
    lot: str = ""
    notes: str | None = None
    service_ids: list[int] | None = None

    @model_validator(mode="after")
    def validate_items(self) -> "OrderCreate":
        if self.items:
            return self
        legacy_fields = (
            self.product_id,
            self.size_id,
            self.color,
            self.quantity_requested,
            self.service_ids,
        )
        if all(value is not None for value in legacy_fields) and self.service_ids:
            return self
        raise ValueError("At least one order item is required")

    def normalized_items(self) -> list[OrderItemCreate]:
        if self.items:
            return self.items
        return [
            OrderItemCreate(
                product_id=self.product_id or 0,
                size_id=self.size_id or 0,
                color=self.color or "",
                quantity_requested=self.quantity_requested or 0,
                sewing_mode=None,
                notes=self.notes,
                service_ids=self.service_ids or [],
            )
        ]


class OrderUpdate(BaseModel):
    client_id: int
    items: list[OrderItemUpdate] = Field(min_length=1)
    allow_printing_exception: bool = False
    notes: str | None = None


class OrderServiceRead(BaseModel):
    id: int
    service_id: int
    service: ServiceRead
    quantity: int
    unit_price: MoneyDecimal
    total_price: MoneyDecimal
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @field_serializer("unit_price", "total_price")
    def serialize_money(self, value: Decimal) -> str:
        return f"{value:.2f}"


class OrderItemServiceRead(BaseModel):
    id: int
    service_id: int
    service: ServiceRead
    quantity: int
    unit_price: MoneyDecimal
    total_price: MoneyDecimal
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @field_serializer("unit_price", "total_price")
    def serialize_money(self, value: Decimal) -> str:
        return f"{value:.2f}"


class OrderItemRead(BaseModel):
    id: int
    product_id: int
    product: ProductRead
    size_id: int
    size: SizeRead
    color: str
    quantity_requested: int
    quantity_cut: int
    quantity_printed: int
    quantity_sewn: int
    quantity_delivered: int
    operational_priority: OperationalPriority
    delivered_at: datetime | None
    available_since: datetime | None
    delivery_status: DeliveryStatus
    sewing_mode: SewingMode | None
    notes: str | None
    delivery_history: list[DeliveryHistoryRead] = Field(default_factory=list)
    services: list[OrderItemServiceRead]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PaymentCreate(BaseModel):
    amount: PositiveMoneyDecimal
    payment_method: PaymentMethod
    paid_at: datetime | None = None
    notes: str | None = None


class PaymentRead(BaseModel):
    id: int
    amount: MoneyDecimal
    payment_method: PaymentMethod
    paid_at: datetime
    notes: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @field_serializer("amount")
    def serialize_amount(self, value: Decimal) -> str:
        return f"{value:.2f}"


class ProductionEventRead(BaseModel):
    id: int
    order_item_id: int | None
    event_type: ProductionEventType
    stage: str | None
    quantity: int | None
    before_quantity: int | None
    after_quantity: int | None
    reason: str | None
    notes: str | None
    user_id: int | None
    user_name_snapshot: str | None
    from_status: ProductionStatus | None = Field(default=None, serialization_alias="from")
    to_status: ProductionStatus | None = Field(default=None, serialization_alias="to")
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CutRegister(BaseModel):
    quantity_cut: int = Field(gt=0)
    notes: str | None = None


class ItemQuantityRegister(BaseModel):
    quantity: int = Field(gt=0)
    notes: str | None = None


class CutPieceAllocation(BaseModel):
    quantity: int = Field(gt=0)
    notes: str | None = None


class CutPieceReturn(BaseModel):
    quantity: int = Field(gt=0)
    notes: str = Field(min_length=1)

    @field_validator("notes")
    @classmethod
    def validate_notes(cls, value: str) -> str:
        cleaned = " ".join(value.split())
        if not cleaned:
            raise ValueError("notes is required to return allocated cut pieces")
        return cleaned


class PrintRegister(BaseModel):
    quantity: int = Field(gt=0)
    print_type: PrintType
    notes: str | None = None


class SewingRegister(BaseModel):
    quantity: int = Field(gt=0)
    notes: str | None = None


class OperationalEventRegister(BaseModel):
    stage: str = Field(min_length=1, max_length=50)
    quantity: int = Field(gt=0)
    reason: str = Field(min_length=1, max_length=255)
    notes: str | None = None


class OperationalAdjustmentRegister(BaseModel):
    stage: str = Field(pattern="^(cut|print|sew|delivered)$")
    quantity_delta: int
    reason: str = Field(min_length=1, max_length=255)
    notes: str = Field(min_length=1)

    @model_validator(mode="after")
    def validate_quantity_delta(self) -> "OperationalAdjustmentRegister":
        if self.quantity_delta == 0:
            raise ValueError("quantity_delta cannot be zero")
        return self


class OperationalHistoryEntry(BaseModel):
    source: str
    event_type: str
    label: str
    order_id: int
    order_item_id: int
    stage: str | None = None
    quantity: int | None = None
    before_quantity: int | None = None
    after_quantity: int | None = None
    reason: str | None = None
    notes: str | None = None
    user_id: int | None = None
    user_name: str | None = None
    picked_up_by: str | None = None
    pickup_document: str | None = None
    created_at: datetime


class OrderSummary(BaseModel):
    id: int
    client: ClientRead
    product: ProductRead
    size: SizeRead
    color: str
    quantity_requested: int
    production_status: ProductionStatus
    production_paused: bool
    financial_status: FinancialStatus
    total_amount: MoneyDecimal
    amount_paid: MoneyDecimal
    amount_due: MoneyDecimal
    items: list[OrderItemRead] = Field(default_factory=list)
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @field_serializer("total_amount", "amount_paid", "amount_due")
    def serialize_money(self, value: Decimal) -> str:
        return f"{value:.2f}"


class OrderRead(OrderSummary):
    color: str
    quantity_cut: int
    quantity_extra: int
    quantity_printed: int
    quantity_sewn: int
    print_type: PrintType | None
    allow_printing_exception: bool
    lot: str
    notes: str | None
    items: list[OrderItemRead]
    services: list[OrderServiceRead]
    payments: list[PaymentRead]
    production_events: list[ProductionEventRead]
    outsourcings: list[OrderOutsourcingRead]
