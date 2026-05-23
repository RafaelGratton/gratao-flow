from datetime import date, datetime, time
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator, model_validator

from app.models.enums import EmployeePaymentStatus, PixKeyType, WorkPaymentMode, WorkType

MoneyDecimal = Annotated[
    Decimal,
    Field(ge=Decimal("0"), max_digits=10, decimal_places=2),
]
HoursDecimal = Annotated[
    Decimal,
    Field(ge=Decimal("0"), max_digits=5, decimal_places=2),
]


class EmployeeCreate(BaseModel):
    name: str = Field(min_length=1)
    role: str | None = None
    phone: str | None = None
    daily_rate: MoneyDecimal = Decimal("120.00")
    standard_daily_hours: HoursDecimal = Decimal("8.00")
    standard_lunch_hours: HoursDecimal = Decimal("1.00")
    pix_key_type: PixKeyType | None = None
    pix_key: str | None = None
    is_active: bool = True
    notes: str | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("name is required")
        return stripped

    @field_validator("role", "phone", "pix_key", "notes")
    @classmethod
    def blank_to_none(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None

    @model_validator(mode="after")
    def validate_hours(self) -> "EmployeeCreate":
        if self.standard_daily_hours <= 0:
            raise ValueError("standard_daily_hours must be greater than zero")
        if self.pix_key_type is None and self.pix_key is not None:
            raise ValueError("pix_key_type is required when pix_key is informed")
        return self


class EmployeeUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1)
    role: str | None = None
    phone: str | None = None
    daily_rate: MoneyDecimal | None = None
    standard_daily_hours: HoursDecimal | None = None
    standard_lunch_hours: HoursDecimal | None = None
    pix_key_type: PixKeyType | None = None
    pix_key: str | None = None
    is_active: bool | None = None
    notes: str | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        if not stripped:
            raise ValueError("name is required")
        return stripped

    @field_validator("role", "phone", "pix_key", "notes")
    @classmethod
    def blank_to_none(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None

    @model_validator(mode="after")
    def validate_hours(self) -> "EmployeeUpdate":
        if self.standard_daily_hours is not None and self.standard_daily_hours <= 0:
            raise ValueError("standard_daily_hours must be greater than zero")
        return self


class EmployeeRead(BaseModel):
    id: int
    name: str
    role: str | None
    phone: str | None
    daily_rate: MoneyDecimal
    standard_daily_hours: HoursDecimal
    standard_lunch_hours: HoursDecimal
    pix_key_type: PixKeyType | None
    pix_key: str | None
    hourly_rate: MoneyDecimal
    is_active: bool
    notes: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @field_serializer(
        "daily_rate",
        "standard_daily_hours",
        "standard_lunch_hours",
        "hourly_rate",
    )
    def serialize_decimal(self, value: Decimal) -> str:
        return f"{value:.2f}"


class WorkLogCreate(BaseModel):
    work_date: date
    clock_in: time
    clock_out: time | None = None
    break_hours: HoursDecimal = Decimal("1.00")
    payment_mode: WorkPaymentMode = WorkPaymentMode.FULL_DAY
    notes: str | None = None


class WorkLogUpdate(BaseModel):
    work_date: date | None = None
    clock_in: time | None = None
    clock_out: time | None = None
    break_hours: HoursDecimal | None = None
    payment_mode: WorkPaymentMode | None = None
    notes: str | None = None


class WorkLogClockOut(BaseModel):
    clock_out: time
    break_hours: HoursDecimal | None = None
    payment_mode: WorkPaymentMode | None = None
    notes: str | None = None


class WorkLogRead(BaseModel):
    id: int
    employee_id: int
    work_date: date
    clock_in: time | None
    clock_out: time | None
    work_status: str
    break_hours: HoursDecimal
    gross_hours: HoursDecimal
    net_hours: HoursDecimal
    regular_hours: HoursDecimal
    overtime_hours: HoursDecimal
    payment_mode: WorkPaymentMode
    work_type: WorkType
    base_amount: MoneyDecimal
    overtime_amount: MoneyDecimal
    total_amount: MoneyDecimal
    amount: MoneyDecimal
    weekly_closing_id: int | None
    payment_status: EmployeePaymentStatus
    paid_at: datetime | None
    notes: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @field_serializer(
        "break_hours",
        "gross_hours",
        "net_hours",
        "regular_hours",
        "overtime_hours",
        "base_amount",
        "overtime_amount",
        "total_amount",
        "amount",
    )
    def serialize_decimal(self, value: Decimal) -> str:
        return f"{value:.2f}"
