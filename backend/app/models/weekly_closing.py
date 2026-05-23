from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import PixKeyType, WeeklyClosingStatus


class WeeklyClosing(Base):
    __tablename__ = "weekly_closings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    employee_id: Mapped[int | None] = mapped_column(ForeignKey("employees.id"), nullable=True)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    days_worked: Mapped[int] = mapped_column(Integer, nullable=False)
    total_gross_hours: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    total_break_hours: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    total_net_hours: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    total_regular_hours: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    total_overtime_hours: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    total_base_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    total_overtime_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    discounts: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    advances: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    total_payable: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    employee_pix_key_type: Mapped[PixKeyType | None] = mapped_column(
        Enum(
            PixKeyType,
            name="employee_pix_key_type",
            values_callable=lambda enum_class: [item.value for item in enum_class],
        ),
        nullable=True,
    )
    employee_pix_key: Mapped[str | None] = mapped_column(String(255), nullable=True)
    total_orders: Mapped[int] = mapped_column(Integer, nullable=False)
    total_pieces_requested: Mapped[int] = mapped_column(Integer, nullable=False)
    total_pieces_cut: Mapped[int] = mapped_column(Integer, nullable=False)
    total_pieces_printed: Mapped[int] = mapped_column(Integer, nullable=False)
    total_pieces_sewn: Mapped[int] = mapped_column(Integer, nullable=False)
    total_invoiced: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    total_received: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    total_pending: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    total_outsourcing_customer: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=False
    )
    total_outsourcing_payout: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=False
    )
    total_outsourcing_profit: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=False
    )
    total_payout_paid: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    total_payout_pending: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    gross_result: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    status: Mapped[WeeklyClosingStatus] = mapped_column(
        Enum(
            WeeklyClosingStatus,
            name="weekly_closing_status",
            values_callable=lambda enum_class: [item.value for item in enum_class],
        ),
        default=WeeklyClosingStatus.OPEN,
        nullable=False,
    )
    closed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    orders = relationship("Order", back_populates="weekly_closing")
    employee = relationship("Employee", back_populates="weekly_closings")
    work_logs = relationship(
        "EmployeeWorkLog",
        back_populates="weekly_closing",
        order_by="EmployeeWorkLog.work_date",
    )
