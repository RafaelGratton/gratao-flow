from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator

from app.models.enums import FinancialStatus, ProductionStatus
from app.schemas.client import ClientRead
from app.schemas.order import MoneyDecimal, OrderItemRead, PaymentRead, SignedMoneyDecimal
from app.schemas.product import ProductRead
from app.schemas.size import SizeRead


class ClientOrderGroupCreate(BaseModel):
    client_id: int
    reference: str = Field(min_length=1, max_length=255)
    notes: str | None = None
    order_ids: list[int] = Field(min_length=1)

    @field_validator("reference")
    @classmethod
    def validate_reference(cls, value: str) -> str:
        cleaned = " ".join(value.split())
        if not cleaned:
            raise ValueError("reference is required")
        return cleaned


class ClientOrderGroupUpdate(BaseModel):
    reference: str = Field(min_length=1, max_length=255)
    notes: str | None = None

    @field_validator("reference")
    @classmethod
    def validate_reference(cls, value: str) -> str:
        cleaned = " ".join(value.split())
        if not cleaned:
            raise ValueError("reference is required")
        return cleaned


class ClientOrderGroupOrderSummary(BaseModel):
    id: int
    client_order_group_id: int | None = None
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
    outsourcing_revenue_total: MoneyDecimal
    outsourcing_cost_total: MoneyDecimal
    outsourcing_paid_total: MoneyDecimal
    outsourcing_pending_total: MoneyDecimal
    estimated_result: SignedMoneyDecimal
    items: list[OrderItemRead] = Field(default_factory=list)
    payments: list[PaymentRead] = Field(default_factory=list)
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @field_serializer(
        "total_amount",
        "amount_paid",
        "amount_due",
        "outsourcing_revenue_total",
        "outsourcing_cost_total",
        "outsourcing_paid_total",
        "outsourcing_pending_total",
        "estimated_result",
    )
    def serialize_money(self, value: Decimal) -> str:
        return f"{value:.2f}"


class ClientOrderGroupRead(BaseModel):
    id: int
    client_id: int
    client: ClientRead
    reference: str
    notes: str | None
    production_status: ProductionStatus
    financial_status: FinancialStatus
    total_amount: MoneyDecimal
    amount_paid: MoneyDecimal
    amount_due: MoneyDecimal
    quantity_requested: int
    order_count: int
    outsourcing_cost_total: MoneyDecimal
    outsourcing_revenue_total: MoneyDecimal
    outsourcing_paid_total: MoneyDecimal
    outsourcing_pending_total: MoneyDecimal
    estimated_result: SignedMoneyDecimal
    orders: list[ClientOrderGroupOrderSummary]
    created_at: datetime
    updated_at: datetime

    @field_serializer(
        "total_amount",
        "amount_paid",
        "amount_due",
        "outsourcing_revenue_total",
        "outsourcing_cost_total",
        "outsourcing_paid_total",
        "outsourcing_pending_total",
        "estimated_result",
    )
    def serialize_money(self, value: Decimal) -> str:
        return f"{value:.2f}"
