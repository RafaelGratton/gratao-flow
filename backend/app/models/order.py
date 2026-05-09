from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import (
    FinancialStatus,
    PaymentMethod,
    PrintType,
    ProductionEventType,
    ProductionFlow,
    ProductionStatus,
)


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"), nullable=False)
    weekly_closing_id: Mapped[int | None] = mapped_column(
        ForeignKey("weekly_closings.id"), nullable=True
    )
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    size_id: Mapped[int] = mapped_column(ForeignKey("sizes.id"), nullable=False)
    color: Mapped[str] = mapped_column(String(100), nullable=False)
    quantity_requested: Mapped[int] = mapped_column(Integer, nullable=False)
    quantity_cut: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    quantity_extra: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    print_type: Mapped[PrintType | None] = mapped_column(
        Enum(
            PrintType,
            name="print_type",
            values_callable=lambda enum_class: [item.value for item in enum_class],
        ),
        nullable=True,
    )
    allow_printing_exception: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    quantity_printed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    quantity_sewn: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    lot: Mapped[str] = mapped_column(String(100), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    total_amount: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), default=Decimal("0.00"), nullable=False
    )
    amount_paid: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), default=Decimal("0.00"), nullable=False
    )
    amount_due: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), default=Decimal("0.00"), nullable=False
    )
    production_status: Mapped[ProductionStatus] = mapped_column(
        Enum(
            ProductionStatus,
            name="production_status",
            values_callable=lambda enum_class: [item.value for item in enum_class],
        ),
        default=ProductionStatus.CREATED,
        nullable=False,
    )
    financial_status: Mapped[FinancialStatus] = mapped_column(
        Enum(
            FinancialStatus,
            name="financial_status",
            values_callable=lambda enum_class: [item.value for item in enum_class],
        ),
        default=FinancialStatus.PENDING,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    client = relationship("Client", back_populates="orders")
    weekly_closing = relationship("WeeklyClosing", back_populates="orders")
    product = relationship("Product", back_populates="orders")
    size = relationship("Size", back_populates="orders")
    services = relationship(
        "OrderService",
        back_populates="order",
        cascade="all, delete-orphan",
        order_by="OrderService.id",
    )
    items = relationship(
        "OrderItem",
        back_populates="order",
        cascade="all, delete-orphan",
        order_by="OrderItem.id",
    )
    payments = relationship(
        "OrderPayment",
        back_populates="order",
        cascade="all, delete-orphan",
        order_by="OrderPayment.id",
    )
    production_events = relationship(
        "ProductionEvent",
        back_populates="order",
        cascade="all, delete-orphan",
        order_by="ProductionEvent.id",
    )
    outsourcings = relationship(
        "OrderOutsourcing",
        back_populates="order",
        cascade="all, delete-orphan",
        order_by="OrderOutsourcing.id",
    )


class OrderService(Base):
    __tablename__ = "order_services"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), nullable=False)
    service_id: Mapped[int] = mapped_column(ForeignKey("services.id"), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    total_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    order = relationship("Order", back_populates="services")
    service = relationship("Service", back_populates="order_services")


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), nullable=False)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    size_id: Mapped[int] = mapped_column(ForeignKey("sizes.id"), nullable=False)
    color: Mapped[str] = mapped_column(String(100), nullable=False)
    quantity_requested: Mapped[int] = mapped_column(Integer, nullable=False)
    quantity_cut: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    quantity_printed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    quantity_sewn: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    production_flow: Mapped[ProductionFlow] = mapped_column(
        Enum(
            ProductionFlow,
            name="production_flow",
            values_callable=lambda enum_class: [item.value for item in enum_class],
        ),
        default=ProductionFlow.INTERNAL_SEWING,
        nullable=False,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    order = relationship("Order", back_populates="items")
    product = relationship("Product", back_populates="order_items")
    size = relationship("Size", back_populates="order_items")
    services = relationship(
        "OrderItemService",
        back_populates="order_item",
        cascade="all, delete-orphan",
        order_by="OrderItemService.id",
    )
    production_events = relationship(
        "ProductionEvent",
        back_populates="order_item",
        order_by="ProductionEvent.id",
    )


class OrderItemService(Base):
    __tablename__ = "order_item_services"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    order_item_id: Mapped[int] = mapped_column(ForeignKey("order_items.id"), nullable=False)
    service_id: Mapped[int] = mapped_column(ForeignKey("services.id"), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    total_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    order_item = relationship("OrderItem", back_populates="services")
    service = relationship("Service", back_populates="order_item_services")


class OrderPayment(Base):
    __tablename__ = "order_payments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    payment_method: Mapped[PaymentMethod] = mapped_column(
        Enum(
            PaymentMethod,
            name="payment_method",
            values_callable=lambda enum_class: [item.value for item in enum_class],
        ),
        nullable=False,
    )
    paid_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    order = relationship("Order", back_populates="payments")


class ProductionEvent(Base):
    __tablename__ = "production_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), nullable=False)
    order_item_id: Mapped[int | None] = mapped_column(
        ForeignKey("order_items.id"), nullable=True
    )
    event_type: Mapped[ProductionEventType] = mapped_column(
        Enum(
            ProductionEventType,
            name="production_event_type",
            values_callable=lambda enum_class: [item.value for item in enum_class],
        ),
        nullable=False,
    )
    quantity: Mapped[int | None] = mapped_column(Integer, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    from_status: Mapped[ProductionStatus | None] = mapped_column(
        Enum(
            ProductionStatus,
            name="production_status",
            values_callable=lambda enum_class: [item.value for item in enum_class],
        ),
        nullable=True,
    )
    to_status: Mapped[ProductionStatus | None] = mapped_column(
        Enum(
            ProductionStatus,
            name="production_status",
            values_callable=lambda enum_class: [item.value for item in enum_class],
        ),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    order = relationship("Order", back_populates="production_events")
    order_item = relationship("OrderItem", back_populates="production_events")
