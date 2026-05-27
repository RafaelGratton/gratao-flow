from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.enums import StockCategory, StockMovementType
from app.models.product import Product
from app.models.size import Size
from app.models.stock import StockItem, StockMovement

STOCK_QUANTIZER = Decimal("0.01")


def create_stock_item(
    db: Session,
    *,
    name: str,
    category: StockCategory,
    quantity: Decimal,
    unit: str | None = "unidade",
    product_id: int | None = None,
    size_id: int | None = None,
    color: str | None = None,
    notes: str | None = None,
    is_active: bool = True,
) -> StockItem:
    _validate_stock_item_references(db, category, product_id, size_id)
    item = StockItem(
        name=name,
        category=category,
        product_id=product_id,
        size_id=size_id,
        color=color,
        unit=unit or "unidade",
        quantity=_stock_quantity(quantity),
        notes=notes,
        is_active=is_active,
    )
    db.add(item)
    db.flush()
    if item.quantity > Decimal("0.00"):
        db.add(
            StockMovement(
                stock_item_id=item.id,
                movement_type=StockMovementType.ENTRY,
                quantity=item.quantity,
                previous_quantity=Decimal("0.00"),
                new_quantity=item.quantity,
                notes=notes or "Initial stock quantity",
            )
        )
    return item


def register_stock_movement(
    db: Session,
    item: StockItem,
    *,
    movement_type: StockMovementType,
    quantity: Decimal,
    notes: str | None = None,
    reference_type: str | None = None,
    reference_id: int | None = None,
) -> StockMovement:
    quantity = _stock_quantity(quantity)
    if quantity <= Decimal("0.00"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Stock movement quantity must be greater than zero",
        )

    previous_quantity = _stock_quantity(item.quantity)
    new_quantity = _calculate_new_quantity(previous_quantity, movement_type, quantity)
    if new_quantity < Decimal("0.00"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Stock quantity cannot be negative",
        )

    item.quantity = new_quantity
    movement = StockMovement(
        stock_item_id=item.id,
        movement_type=movement_type,
        quantity=quantity,
        previous_quantity=previous_quantity,
        new_quantity=new_quantity,
        reference_type=reference_type,
        reference_id=reference_id,
        notes=notes,
    )
    db.add(movement)
    return movement


def adjust_stock_quantity(
    db: Session,
    item: StockItem,
    *,
    quantity: Decimal,
    notes: str | None = None,
) -> StockMovement:
    new_quantity = _stock_quantity(quantity)
    previous_quantity = _stock_quantity(item.quantity)
    item.quantity = new_quantity
    movement = StockMovement(
        stock_item_id=item.id,
        movement_type=StockMovementType.ADJUSTMENT,
        quantity=abs(new_quantity - previous_quantity),
        previous_quantity=previous_quantity,
        new_quantity=new_quantity,
        notes=notes,
    )
    db.add(movement)
    return movement


def get_piece_stock_items_for_order_item(db: Session, order_item) -> list[StockItem]:
    return list(
        db.scalars(
            select(StockItem)
            .where(
                StockItem.category == StockCategory.PIECE,
                StockItem.product_id == order_item.product_id,
                StockItem.size_id == order_item.size_id,
                StockItem.color == order_item.color,
                StockItem.is_active.is_(True),
            )
            .order_by(StockItem.id)
            .with_for_update()
        )
    )


def get_piece_stock_item_for_order_item(db: Session, order_item) -> StockItem | None:
    items = get_piece_stock_items_for_order_item(db, order_item)
    return items[0] if items else None


def get_or_create_piece_stock_item_for_order_item(db: Session, order_item) -> StockItem:
    item = get_piece_stock_item_for_order_item(db, order_item)
    if item is not None:
        return item

    item = StockItem(
        name=f"{order_item.product.name} {order_item.size.label} {order_item.color}",
        category=StockCategory.PIECE,
        product_id=order_item.product_id,
        size_id=order_item.size_id,
        color=order_item.color,
        unit="unidade",
        quantity=Decimal("0.00"),
        is_active=True,
    )
    db.add(item)
    db.flush()
    return item


def get_or_create_piece_stock_item_for_order(db: Session, order) -> StockItem:
    return get_or_create_piece_stock_item_for_order_item(db, order)


def _validate_stock_item_references(
    db: Session,
    category: StockCategory,
    product_id: int | None,
    size_id: int | None,
) -> None:
    if category == StockCategory.PIECE and (product_id is None or size_id is None):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="product_id and size_id are required for piece stock items",
        )
    if product_id is not None and db.get(Product, product_id) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Product not found")
    if size_id is not None and db.get(Size, size_id) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Size not found")


def _calculate_new_quantity(
    previous_quantity: Decimal,
    movement_type: StockMovementType,
    quantity: Decimal,
) -> Decimal:
    if movement_type in {
        StockMovementType.ENTRY,
        StockMovementType.EXCESS_CUT,
        StockMovementType.CUT_ENTRY,
        StockMovementType.RETURNED_FROM_ORDER,
    }:
        return _stock_quantity(previous_quantity + quantity)
    if movement_type in {
        StockMovementType.EXIT,
        StockMovementType.LOSS,
        StockMovementType.ALLOCATED_TO_ORDER,
    }:
        return _stock_quantity(previous_quantity - quantity)
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Unsupported stock movement type for this operation",
    )


def _stock_quantity(value: Decimal) -> Decimal:
    return value.quantize(STOCK_QUANTIZER)
