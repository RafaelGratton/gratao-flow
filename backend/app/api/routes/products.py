from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import case, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin
from app.db.session import get_db
from app.models.product import Product
from app.schemas.product import ProductRead

router = APIRouter(dependencies=[Depends(get_current_admin)])

PRODUCT_ORDER = ["Blusa", "Casaco", "Calça", "Short", "Short saia"]


@router.get("", response_model=list[ProductRead])
def list_products(db: Annotated[Session, Depends(get_db)]) -> list[Product]:
    order_case = case(
        {name: index for index, name in enumerate(PRODUCT_ORDER)},
        value=Product.name,
        else_=len(PRODUCT_ORDER),
    )
    return list(db.scalars(select(Product).order_by(order_case, Product.id)))
