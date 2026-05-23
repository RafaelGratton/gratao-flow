from datetime import date, datetime, time
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, field_serializer, model_validator

from app.models.enums import PixKeyType, WeeklyClosingStatus

MoneyDecimal = Annotated[
    Decimal,
    Field(ge=Decimal("0"), max_digits=10, decimal_places=2),
]
ResultMoneyDecimal = Annotated[
    Decimal,
    Field(max_digits=10, decimal_places=2),
]
HoursDecimal = Annotated[
    Decimal,
    Field(ge=Decimal("0"), max_digits=10, decimal_places=2),
]


class WeeklyClosingCreate(BaseModel):
    employee_id: int
    start_date: date
    end_date: date
    discounts: MoneyDecimal = Decimal("0.00")
    advances: MoneyDecimal = Decimal("0.00")
    notes: str | None = None

    @model_validator(mode="after")
    def validate_period(self) -> "WeeklyClosingCreate":
        if self.start_date > self.end_date:
            raise ValueError("start_date must be lower than or equal to end_date")
        return self


class WeeklyClosingWorkLogRead(BaseModel):
    id: int
    work_date: date
    clock_in: time | None
    clock_out: time | None
    work_status: str
    net_hours: HoursDecimal
    overtime_hours: HoursDecimal
    total_amount: MoneyDecimal

    model_config = ConfigDict(from_attributes=True)

    @field_serializer("net_hours", "overtime_hours", "total_amount")
    def serialize_decimal(self, value: Decimal) -> str:
        return f"{value:.2f}"


class WeeklyClosingRead(BaseModel):
    id: int
    employee_id: int | None
    start_date: date
    end_date: date
    days_worked: int
    total_gross_hours: HoursDecimal
    total_break_hours: HoursDecimal
    total_net_hours: HoursDecimal
    total_regular_hours: HoursDecimal
    total_overtime_hours: HoursDecimal
    total_base_amount: MoneyDecimal
    total_overtime_amount: MoneyDecimal
    discounts: MoneyDecimal
    advances: MoneyDecimal
    total_payable: ResultMoneyDecimal
    employee_pix_key_type: PixKeyType | None
    employee_pix_key: str | None
    total_orders: int
    total_pieces_requested: int
    total_pieces_cut: int
    total_pieces_printed: int
    total_pieces_sewn: int
    total_invoiced: MoneyDecimal
    total_received: MoneyDecimal
    total_pending: MoneyDecimal
    total_outsourcing_customer: MoneyDecimal
    total_outsourcing_payout: MoneyDecimal
    total_outsourcing_profit: MoneyDecimal
    total_payout_paid: MoneyDecimal
    total_payout_pending: MoneyDecimal
    gross_result: ResultMoneyDecimal
    status: WeeklyClosingStatus
    closed_at: datetime | None
    paid_at: datetime | None = None
    notes: str | None
    created_at: datetime
    work_logs: list[WeeklyClosingWorkLogRead] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)

    @field_serializer(
        "total_gross_hours",
        "total_break_hours",
        "total_net_hours",
        "total_regular_hours",
        "total_overtime_hours",
        "total_base_amount",
        "total_overtime_amount",
        "discounts",
        "advances",
        "total_payable",
        "total_invoiced",
        "total_received",
        "total_pending",
        "total_outsourcing_customer",
        "total_outsourcing_payout",
        "total_outsourcing_profit",
        "total_payout_paid",
        "total_payout_pending",
        "gross_result",
    )
    def serialize_decimal(self, value: Decimal) -> str:
        return f"{value:.2f}"


class WeeklyClosingSummary(WeeklyClosingRead):
    pass
