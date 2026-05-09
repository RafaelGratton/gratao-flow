from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import case, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.product import Product
from app.models.user import User
from app.schemas.product import ProductCreate, ProductRead, ProductUpdate

router = APIRouter(dependencies=[Depends(get_current_user)])

PRODUCT_ORDER = ["Blusa", "Casaco", "Calça", "Short", "Short saia"]


@router.post("", response_model=ProductRead, status_code=201)
def create_product(
    payload: ProductCreate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
) -> Product:
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Product name is required")
    _ensure_product_name_available(db, name)

    product = Product(name=name, is_active=payload.is_active)
    db.add(product)
    db.commit()
    return _get_product_or_404(db, product.id)


@router.get("", response_model=list[ProductRead])
def list_products(db: Annotated[Session, Depends(get_db)]) -> list[Product]:
    order_case = case(
        {name: index for index, name in enumerate(PRODUCT_ORDER)},
        value=Product.name,
        else_=len(PRODUCT_ORDER),
    )
    return list(
        db.scalars(
            select(Product)
            .options(
                selectinload(Product.orders),
                selectinload(Product.order_items),
                selectinload(Product.stock_items),
            )
            .order_by(order_case, Product.id)
        )
    )


@router.put("/{product_id}", response_model=ProductRead)
def update_product(
    product_id: int,
    payload: ProductUpdate,
    db: Annotated[Session, Depends(get_db)],
) -> Product:
    product = _get_product_or_404(db, product_id)
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Product name is required")
    _ensure_product_name_available(db, name, product_id)

    product.name = name
    product.is_active = payload.is_active
    db.commit()
    return _get_product_or_404(db, product.id)


@router.delete("/{product_id}", response_model=ProductRead | None)
def delete_product(
    product_id: int,
    db: Annotated[Session, Depends(get_db)],
) -> Product | Response:
    product = _get_product_or_404(db, product_id)
    if not product.can_delete:
        product.is_active = False
        db.commit()
        return _get_product_or_404(db, product.id)

    db.delete(product)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _get_product_or_404(db: Session, product_id: int) -> Product:
    product = db.scalar(
        select(Product)
        .where(Product.id == product_id)
        .options(
            selectinload(Product.orders),
            selectinload(Product.order_items),
            selectinload(Product.stock_items),
        )
    )
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return product


def _ensure_product_name_available(
    db: Session,
    name: str,
    product_id: int | None = None,
) -> None:
    query = select(Product).where(Product.name == name)
    if product_id is not None:
        query = query.where(Product.id != product_id)
    if db.scalar(query) is not None:
        raise HTTPException(status_code=400, detail="Product name already exists")
