from datetime import date, datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, field_serializer, model_validator

from app.models.enums import WeeklyClosingStatus

MoneyDecimal = Annotated[
    Decimal,
    Field(ge=Decimal("0"), max_digits=10, decimal_places=2),
]

ResultMoneyDecimal = Annotated[
    Decimal,
    Field(max_digits=10, decimal_places=2),
]


class WeeklyClosingCreate(BaseModel):
    start_date: date
    end_date: date
    notes: str | None = None

    @model_validator(mode="after")
    def validate_period(self) -> "WeeklyClosingCreate":
        if self.start_date > self.end_date:
            raise ValueError("start_date must be lower than or equal to end_date")
        return self


class WeeklyClosingRead(BaseModel):
    id: int
    start_date: date
    end_date: date
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
    notes: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @field_serializer(
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
    def serialize_money(self, value: Decimal) -> str:
        return f"{value:.2f}"


class WeeklyClosingSummary(WeeklyClosingRead):
    pass
