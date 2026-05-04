from datetime import datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, field_serializer

from app.models.enums import (
    FinancialStatus,
    PaymentMethod,
    PrintType,
    ProductionEventType,
    ProductionStatus,
)
from app.schemas.client import ClientRead
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


class OrderCreate(BaseModel):
    client_id: int
    product_id: int
    size_id: int
    color: str
    quantity_requested: int = Field(gt=0)
    allow_printing_exception: bool = False
    lot: str
    notes: str | None = None
    service_ids: list[int] = Field(min_length=1)


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
    event_type: ProductionEventType
    quantity: int | None
    notes: str | None
    from_status: ProductionStatus | None = Field(default=None, serialization_alias="from")
    to_status: ProductionStatus | None = Field(default=None, serialization_alias="to")
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CutRegister(BaseModel):
    quantity_cut: int = Field(gt=0)
    notes: str | None = None


class PrintRegister(BaseModel):
    quantity: int = Field(gt=0)
    print_type: PrintType
    notes: str | None = None


class SewingRegister(BaseModel):
    quantity: int = Field(gt=0)
    notes: str | None = None


class OrderSummary(BaseModel):
    id: int
    client: ClientRead
    product: ProductRead
    size: SizeRead
    color: str
    quantity_requested: int
    production_status: ProductionStatus
    financial_status: FinancialStatus
    total_amount: MoneyDecimal
    amount_paid: MoneyDecimal
    amount_due: MoneyDecimal
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
    services: list[OrderServiceRead]
    payments: list[PaymentRead]
    production_events: list[ProductionEventRead]
    outsourcings: list[OrderOutsourcingRead]
