from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SystemSettings(Base):
    __tablename__ = "system_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    company_name: Mapped[str] = mapped_column(String(255), nullable=False)
    company_phone: Mapped[str] = mapped_column(String(50), nullable=False)
    company_address: Mapped[str] = mapped_column(String(255), nullable=False)
    company_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
