from datetime import date, datetime, time
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    Time,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import EmployeePaymentStatus, WorkPaymentMode, WorkType


class Employee(Base):
    __tablename__ = "employees"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str | None] = mapped_column(String(120), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    daily_rate: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    standard_daily_hours: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    standard_lunch_hours: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    work_logs = relationship(
        "EmployeeWorkLog",
        back_populates="employee",
        cascade="all, delete-orphan",
        order_by="EmployeeWorkLog.work_date.desc()",
    )
    weekly_closings = relationship(
        "WeeklyClosing",
        back_populates="employee",
        order_by="WeeklyClosing.start_date.desc()",
    )

    @property
    def hourly_rate(self) -> Decimal:
        if self.standard_daily_hours <= 0:
            return Decimal("0.00")
        return (self.daily_rate / self.standard_daily_hours).quantize(Decimal("0.01"))


class EmployeeWorkLog(Base):
    __tablename__ = "employee_work_logs"
    __table_args__ = (
        UniqueConstraint("employee_id", "work_date", name="uq_employee_work_logs_employee_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id"), nullable=False)
    work_date: Mapped[date] = mapped_column(Date, nullable=False)
    clock_in: Mapped[time | None] = mapped_column(Time, nullable=True)
    clock_out: Mapped[time | None] = mapped_column(Time, nullable=True)
    break_hours: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    gross_hours: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    net_hours: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    regular_hours: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    overtime_hours: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    payment_mode: Mapped[WorkPaymentMode] = mapped_column(
        Enum(
            WorkPaymentMode,
            name="employee_work_payment_mode",
            values_callable=lambda enum_class: [item.value for item in enum_class],
        ),
        default=WorkPaymentMode.FULL_DAY,
        nullable=False,
    )
    work_type: Mapped[WorkType] = mapped_column(
        Enum(
            WorkType,
            name="work_type",
            values_callable=lambda enum_class: [item.value for item in enum_class],
        ),
        nullable=False,
    )
    base_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    overtime_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    weekly_closing_id: Mapped[int | None] = mapped_column(
        ForeignKey("weekly_closings.id"), nullable=True
    )
    payment_status: Mapped[EmployeePaymentStatus] = mapped_column(
        Enum(
            EmployeePaymentStatus,
            name="employee_payment_status",
            values_callable=lambda enum_class: [item.value for item in enum_class],
        ),
        default=EmployeePaymentStatus.PENDING,
        nullable=False,
    )
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    employee = relationship("Employee", back_populates="work_logs")
    weekly_closing = relationship("WeeklyClosing", back_populates="work_logs")
