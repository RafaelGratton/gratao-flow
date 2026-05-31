from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Size(Base):
    __tablename__ = "sizes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    label: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    orders = relationship("Order", back_populates="size")
    order_items = relationship("OrderItem", back_populates="size")
    stock_items = relationship("StockItem", back_populates="size")

    @property
    def can_delete(self) -> bool:
        return (
            len(self.orders) == 0
            and len(self.order_items) == 0
            and len(self.stock_items) == 0
        )
