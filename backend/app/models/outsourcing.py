from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import OutsourcingStatus, PayoutStatus


class Outsourcer(Base):
    __tablename__ = "outsourcers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str] = mapped_column(String(50), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    order_outsourcings = relationship("OrderOutsourcing", back_populates="outsourcer")


class OrderOutsourcing(Base):
    __tablename__ = "order_outsourcings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), nullable=False)
    order_item_id: Mapped[int | None] = mapped_column(
        ForeignKey("order_items.id"), nullable=True
    )
    outsourcer_id: Mapped[int | None] = mapped_column(
        ForeignKey("outsourcers.id"), nullable=True
    )
    quantity_sent: Mapped[int] = mapped_column(Integer, nullable=False)
    quantity_returned: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    customer_unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    outsourcer_unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    customer_total: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    outsourcer_total: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    profit_total: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    return_expected: Mapped[bool] = mapped_column(Boolean, nullable=False)
    direct_to_customer: Mapped[bool] = mapped_column(Boolean, nullable=False)
    status: Mapped[OutsourcingStatus] = mapped_column(
        Enum(
            OutsourcingStatus,
            name="outsourcing_status",
            values_callable=lambda enum_class: [item.value for item in enum_class],
        ),
        nullable=False,
    )
    payout_status: Mapped[PayoutStatus] = mapped_column(
        Enum(
            PayoutStatus,
            name="payout_status",
            values_callable=lambda enum_class: [item.value for item in enum_class],
        ),
        default=PayoutStatus.PENDING,
        nullable=False,
    )
    sent_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    returned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    order = relationship("Order", back_populates="outsourcings")
    order_item = relationship("OrderItem", back_populates="outsourcings")
    outsourcer = relationship("Outsourcer", back_populates="order_outsourcings")
