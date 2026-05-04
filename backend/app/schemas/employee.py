from datetime import date, datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator

from app.models.enums import EmployeePaymentStatus, WorkType

MoneyDecimal = Annotated[
    Decimal,
    Field(ge=Decimal("0"), max_digits=10, decimal_places=2),
]


class EmployeeCreate(BaseModel):
    name: str = Field(min_length=1)
    phone: str | None = None
    daily_rate: MoneyDecimal
    is_active: bool = True

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("name is required")
        return stripped


class EmployeeRead(BaseModel):
    id: int
    name: str
    phone: str | None
    daily_rate: MoneyDecimal
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @field_serializer("daily_rate")
    def serialize_daily_rate(self, value: Decimal) -> str:
        return f"{value:.2f}"


class WorkLogCreate(BaseModel):
    work_date: date
    work_type: WorkType
    notes: str | None = None


class WorkLogUpdate(BaseModel):
    work_type: WorkType | None = None
    notes: str | None = None


class WorkLogRead(BaseModel):
    id: int
    employee_id: int
    work_date: date
    work_type: WorkType
    amount: MoneyDecimal
    payment_status: EmployeePaymentStatus
    paid_at: datetime | None
    notes: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @field_serializer("amount")
    def serialize_amount(self, value: Decimal) -> str:
        return f"{value:.2f}"
