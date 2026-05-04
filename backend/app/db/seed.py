from decimal import Decimal
import os

from sqlalchemy import select

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.product import Product
from app.models.service import Service
from app.models.size import Size
from app.models.user import User

PRODUCTS = ["Blusa", "Casaco", "Calça", "Short", "Short saia"]
SIZES = ["4", "6", "8", "10", "12", "14", "16", "PP", "P", "M", "G", "GG"]
SERVICES = [
    {"name": "Corte", "type": "corte", "price_per_unit": Decimal("1.00")},
    {"name": "Confecção", "type": "confeccao", "price_per_unit": Decimal("5.00")},
    {"name": "Serigrafia frente", "type": "serigrafia", "price_per_unit": Decimal("1.50")},
    {"name": "Serigrafia frente e costas", "type": "serigrafia", "price_per_unit": Decimal("3.00")},
]

PRODUCT_TEXT_FIXES = {
    "Cal\u00c3\u00a7a": "Calça",
    "Cal\u00c3\u0083\u00c2\u00a7a": "Calça",
}

SERVICE_TEXT_FIXES = {
    "Confec\u00c3\u00a7\u00c3\u00a3o": "Confecção",
    "Confec\u00c3\u0083\u00c2\u00a7\u00c3\u0083\u00c2\u00a3o": "Confecção",
}


def seed() -> None:
    admin_email, admin_password = _get_admin_credentials()

    db = SessionLocal()
    try:
        _fix_legacy_encoding(db)

        admin = db.scalar(select(User).where(User.email == admin_email))
        if admin is None:
            db.add(
                User(
                    email=admin_email,
                    password_hash=hash_password(admin_password),
                    is_admin=True,
                )
            )
        else:
            admin.password_hash = hash_password(admin_password)
            admin.is_admin = True

        for product_name in PRODUCTS:
            exists = db.scalar(select(Product).where(Product.name == product_name))
            if exists is None:
                db.add(Product(name=product_name, is_active=True))

        for size_label in SIZES:
            exists = db.scalar(select(Size).where(Size.label == size_label))
            if exists is None:
                db.add(Size(label=size_label))

        for service_payload in SERVICES:
            exists = db.scalar(select(Service).where(Service.name == service_payload["name"]))
            if exists is None:
                db.add(Service(**service_payload, is_active=True))

        db.commit()
    finally:
        db.close()


def _get_admin_credentials() -> tuple[str, str]:
    admin_email = os.getenv("ADMIN_EMAIL")
    admin_password = os.getenv("ADMIN_PASSWORD")
    missing = [
        name
        for name, value in {
            "ADMIN_EMAIL": admin_email,
            "ADMIN_PASSWORD": admin_password,
        }.items()
        if not value
    ]
    if missing:
        raise RuntimeError(
            "Missing required admin seed environment variables: "
            + ", ".join(missing)
        )
    return admin_email, admin_password


def _fix_legacy_encoding(db) -> None:
    for legacy_name, fixed_name in PRODUCT_TEXT_FIXES.items():
        product = db.scalar(select(Product).where(Product.name == legacy_name))
        if product is not None:
            product.name = fixed_name

    for legacy_name, fixed_name in SERVICE_TEXT_FIXES.items():
        service = db.scalar(select(Service).where(Service.name == legacy_name))
        if service is not None:
            service.name = fixed_name


if __name__ == "__main__":
    seed()
