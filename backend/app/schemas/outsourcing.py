from datetime import datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator, model_validator

from app.models.enums import OutsourcingStatus, PayoutStatus

MoneyDecimal = Annotated[
    Decimal,
    Field(ge=Decimal("0"), max_digits=10, decimal_places=2),
]


class OutsourcerCreate(BaseModel):
    name: str = Field(min_length=1)
    phone: str
    notes: str | None = None
    is_active: bool = True

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("name is required")
        return stripped


class OutsourcerRead(BaseModel):
    id: int
    name: str
    phone: str
    notes: str | None
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class OutsourcingCreate(BaseModel):
    order_item_id: int = Field(gt=0)
    outsourcer_id: int | None = None
    quantity_sent: int = Field(gt=0)
    customer_unit_price: MoneyDecimal
    outsourcer_unit_price: MoneyDecimal
    return_expected: bool = True
    direct_to_customer: bool = False
    notes: str | None = None

    @model_validator(mode="after")
    def validate_flow_and_prices(self) -> "OutsourcingCreate":
        if self.outsourcer_unit_price > self.customer_unit_price:
            raise ValueError("outsourcer_unit_price cannot be greater than customer_unit_price")
        if self.direct_to_customer:
            raise ValueError("Terceirizacao sempre retorna para a Gratao antes da entrega ao cliente")
        self.return_expected = True
        return self


class OutsourcingReturn(BaseModel):
    quantity_returned: int = Field(gt=0)
    notes: str | None = None


class OutsourcingPayout(BaseModel):
    paid_at: datetime | None = None
    notes: str | None = None


class OrderOutsourcingRead(BaseModel):
    id: int
    order_item_id: int | None
    outsourcer_id: int | None
    outsourcer: OutsourcerRead | None
    quantity_sent: int
    quantity_returned: int
    customer_unit_price: MoneyDecimal
    outsourcer_unit_price: MoneyDecimal
    customer_total: MoneyDecimal
    outsourcer_total: MoneyDecimal
    profit_total: MoneyDecimal
    return_expected: bool
    direct_to_customer: bool
    status: OutsourcingStatus
    payout_status: PayoutStatus
    sent_at: datetime
    returned_at: datetime | None
    paid_at: datetime | None
    notes: str | None

    model_config = ConfigDict(from_attributes=True)

    @field_serializer(
        "customer_unit_price",
        "outsourcer_unit_price",
        "customer_total",
        "outsourcer_total",
        "profit_total",
    )
    def serialize_money(self, value: Decimal) -> str:
        return f"{value:.2f}"
