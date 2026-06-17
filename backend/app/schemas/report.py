from datetime import datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, field_serializer

from app.models.enums import (
    DeliveryStatus,
    FinancialStatus,
    OutsourcingStatus,
    PayoutStatus,
    PaymentMethod,
    ProductionEventType,
    ProductionStatus,
    SewingMode,
)

MoneyDecimal = Annotated[
    Decimal,
    Field(ge=Decimal("0"), max_digits=10, decimal_places=2),
]

SignedMoneyDecimal = Annotated[
    Decimal,
    Field(max_digits=10, decimal_places=2),
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


class ReportItem(BaseModel):
    id: int
    product: ReportProduct
    size: ReportSize
    color: str
    quantity_requested: int
    quantity_cut: int
    quantity_printed: int
    quantity_sewn: int
    quantity_delivered: int
    delivery_status: DeliveryStatus
    sewing_mode: SewingMode | None
    dtf_notes: str | None = None
    is_cancelled: bool = False
    cancelled_at: datetime | None = None
    cancel_reason: str | None = None
    services: list[ReportService]
    outsourcing_services: list[ReportService] = Field(default_factory=list)


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


class GroupClientReportPayment(ClientReportPayment):
    order_id: int


class GroupInternalReportPayment(InternalReportPayment):
    order_id: int


class InternalReportProductionEvent(BaseModel):
    order_item_id: int | None
    event_type: ProductionEventType
    quantity: int | None
    notes: str | None
    from_status: ProductionStatus | None
    to_status: ProductionStatus | None
    created_at: datetime


class GroupInternalReportProductionEvent(InternalReportProductionEvent):
    order_id: int


class InternalReportOutsourcing(BaseModel):
    order_item_id: int | None
    outsourcer: str | None
    quantity_sent: int
    quantity_returned: int
    customer_unit_price: MoneyDecimal
    outsourcer_unit_price: MoneyDecimal
    customer_total: MoneyDecimal
    outsourcer_total: MoneyDecimal
    profit_total: SignedMoneyDecimal
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


class GroupInternalReportOutsourcing(InternalReportOutsourcing):
    order_id: int


class ClientOrderGroupReportOrder(BaseModel):
    order_id: int
    production_status: str
    quantity: int
    total_amount: MoneyDecimal
    amount_paid: MoneyDecimal
    amount_due: MoneyDecimal
    items: list[ReportItem]

    @field_serializer("total_amount", "amount_paid", "amount_due")
    def serialize_money(self, value: Decimal) -> str:
        return f"{value:.2f}"


class InternalOrderGroupReportOrder(BaseModel):
    order_id: int
    production_status: ProductionStatus
    financial_status: FinancialStatus
    quantity_requested: int
    total_amount: MoneyDecimal
    amount_paid: MoneyDecimal
    amount_due: MoneyDecimal
    outsourcing_cost_total: MoneyDecimal
    outsourcing_paid_total: MoneyDecimal
    outsourcing_pending_total: MoneyDecimal
    estimated_result: SignedMoneyDecimal
    items: list[ReportItem]
    payments: list[GroupInternalReportPayment]
    production_events: list[GroupInternalReportProductionEvent]
    outsourcings: list[GroupInternalReportOutsourcing]

    @field_serializer(
        "total_amount",
        "amount_paid",
        "amount_due",
        "outsourcing_cost_total",
        "outsourcing_paid_total",
        "outsourcing_pending_total",
        "estimated_result",
    )
    def serialize_money(self, value: Decimal) -> str:
        return f"{value:.2f}"


class ClientOrderGroupReport(BaseModel):
    group_id: int
    reference: str
    client: ReportClient
    quantity: int
    orders: list[ClientOrderGroupReportOrder]
    total_amount: MoneyDecimal
    payments: list[GroupClientReportPayment]
    amount_paid: MoneyDecimal
    amount_due: MoneyDecimal
    production_status: str
    financial_status: FinancialStatus

    @field_serializer("total_amount", "amount_paid", "amount_due")
    def serialize_money(self, value: Decimal) -> str:
        return f"{value:.2f}"


class InternalOrderGroupReport(BaseModel):
    group_id: int
    reference: str
    client: ReportClient
    quantity_requested: int
    order_count: int
    orders: list[InternalOrderGroupReportOrder]
    total_amount: MoneyDecimal
    amount_paid: MoneyDecimal
    amount_due: MoneyDecimal
    outsourcing_cost_total: MoneyDecimal
    outsourcing_paid_total: MoneyDecimal
    outsourcing_pending_total: MoneyDecimal
    estimated_result: SignedMoneyDecimal
    production_status: ProductionStatus
    financial_status: FinancialStatus

    @field_serializer(
        "total_amount",
        "amount_paid",
        "amount_due",
        "outsourcing_cost_total",
        "outsourcing_paid_total",
        "outsourcing_pending_total",
        "estimated_result",
    )
    def serialize_money(self, value: Decimal) -> str:
        return f"{value:.2f}"


class InternalOrderReport(BaseModel):
    order_id: int
    client: ReportClient
    quantity_requested: int
    quantity_cut: int
    quantity_printed: int
    quantity_sewn: int
    quantity_extra: int
    items: list[ReportItem]
    total_amount: MoneyDecimal
    amount_paid: MoneyDecimal
    amount_due: MoneyDecimal
    outsourcing_cost_total: MoneyDecimal
    outsourcing_paid_total: MoneyDecimal
    outsourcing_pending_total: MoneyDecimal
    estimated_result: SignedMoneyDecimal
    payments: list[InternalReportPayment]
    production_status: ProductionStatus
    financial_status: FinancialStatus
    production_events: list[InternalReportProductionEvent]
    outsourcings: list[InternalReportOutsourcing]

    @field_serializer(
        "total_amount",
        "amount_paid",
        "amount_due",
        "outsourcing_cost_total",
        "outsourcing_paid_total",
        "outsourcing_pending_total",
        "estimated_result",
    )
    def serialize_money(self, value: Decimal) -> str:
        return f"{value:.2f}"


class ClientOrderReport(BaseModel):
    client: ReportClient
    order_id: int
    quantity: int
    items: list[ReportItem]
    total_amount: MoneyDecimal
    payments: list[ClientReportPayment]
    amount_paid: MoneyDecimal
    amount_due: MoneyDecimal
    production_status: str

    @field_serializer("total_amount", "amount_paid", "amount_due")
    def serialize_money(self, value: Decimal) -> str:
        return f"{value:.2f}"
