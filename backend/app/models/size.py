from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Size(Base):
    __tablename__ = "sizes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    label: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)

    orders = relationship("Order", back_populates="size")
    stock_items = relationship("StockItem", back_populates="size")
