from datetime import datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, field_serializer

from app.models.enums import (
    FinancialStatus,
    OutsourcingStatus,
    PayoutStatus,
    PaymentMethod,
    ProductionEventType,
    ProductionStatus,
)

MoneyDecimal = Annotated[
    Decimal,
    Field(ge=Decimal("0"), max_digits=10, decimal_places=2),
]


class ReportClient(BaseModel):
    id: int
    name: str
    phone: str
    type: str

    model_config = ConfigDict(from_attributes=True)


class ReportProduct(BaseModel):
    id: int
    name: str

    model_config = ConfigDict(from_attributes=True)


class ReportSize(BaseModel):
    id: int
    label: str

    model_config = ConfigDict(from_attributes=True)


class ReportService(BaseModel):
    name: str
    quantity: int
    unit_price: MoneyDecimal
    total_price: MoneyDecimal

    @field_serializer("unit_price", "total_price")
    def serialize_money(self, value: Decimal) -> str:
        return f"{value:.2f}"


class InternalReportPayment(BaseModel):
    amount: MoneyDecimal
    payment_method: PaymentMethod
    paid_at: datetime
    notes: str | None

    @field_serializer("amount")
    def serialize_money(self, value: Decimal) -> str:
        return f"{value:.2f}"


class ClientReportPayment(BaseModel):
    amount: MoneyDecimal
    payment_method: PaymentMethod
    paid_at: datetime

    @field_serializer("amount")
    def serialize_money(self, value: Decimal) -> str:
        return f"{value:.2f}"


class InternalReportProductionEvent(BaseModel):
    event_type: ProductionEventType
    quantity: int | None
    notes: str | None
    from_status: ProductionStatus | None
    to_status: ProductionStatus | None
    created_at: datetime


class InternalReportOutsourcing(BaseModel):
    outsourcer: str | None
    quantity_sent: int
    quantity_returned: int
    customer_unit_price: MoneyDecimal
    outsourcer_unit_price: MoneyDecimal
    customer_total: MoneyDecimal
    outsourcer_total: MoneyDecimal
    profit_total: MoneyDecimal
    status: OutsourcingStatus
    payout_status: PayoutStatus

    @field_serializer(
        "customer_unit_price",
        "outsourcer_unit_price",
        "customer_total",
        "outsourcer_total",
        "profit_total",
    )
    def serialize_money(self, value: Decimal) -> str:
        return f"{value:.2f}"


class InternalOrderReport(BaseModel):
    order_id: int
    client: ReportClient
    product: ReportProduct
    size: ReportSize
    color: str
    quantity_requested: int
    quantity_cut: int
    quantity_printed: int
    quantity_sewn: int
    quantity_extra: int
    services: list[ReportService]
    total_amount: MoneyDecimal
    amount_paid: MoneyDecimal
    amount_due: MoneyDecimal
    payments: list[InternalReportPayment]
    production_status: ProductionStatus
    financial_status: FinancialStatus
    production_events: list[InternalReportProductionEvent]
    outsourcings: list[InternalReportOutsourcing]

    @field_serializer("total_amount", "amount_paid", "amount_due")
    def serialize_money(self, value: Decimal) -> str:
        return f"{value:.2f}"


class ClientOrderReport(BaseModel):
    client: ReportClient
    order_id: int
    product: ReportProduct
    size: ReportSize
    color: str
    quantity: int
    services: list[ReportService]
    total_amount: MoneyDecimal
    payments: list[ClientReportPayment]
    amount_paid: MoneyDecimal
    amount_due: MoneyDecimal
    production_status: str

    @field_serializer("total_amount", "amount_paid", "amount_due")
    def serialize_money(self, value: Decimal) -> str:
        return f"{value:.2f}"
