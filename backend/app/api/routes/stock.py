from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.enums import StockCategory, StockMovementType
from app.models.stock import StockItem
from app.schemas.stock import (
    StockAdjustmentCreate,
    StockItemCreate,
    StockItemDetail,
    StockItemRead,
    StockMovementCreate,
)
from app.services.stock import (
    adjust_stock_quantity,
    create_stock_item,
    register_stock_movement,
)

router = APIRouter(dependencies=[Depends(get_current_user)])


@router.post("/items", response_model=StockItemRead, status_code=201)
def create_item(
    payload: StockItemCreate,
    db: Annotated[Session, Depends(get_db)],
) -> StockItem:
    if payload.category == StockCategory.PIECE and payload.quantity > 0:
        _require_piece_manual_note(payload.notes)
    item = create_stock_item(db, **payload.model_dump())
    db.commit()
    return _get_stock_item_or_404(db, item.id)


@router.get("/items", response_model=list[StockItemRead])
def list_items(db: Annotated[Session, Depends(get_db)]) -> list[StockItem]:
    query = (
        select(StockItem)
        .where(StockItem.is_active.is_(True))
        .options(
            selectinload(StockItem.product),
            selectinload(StockItem.size),
            selectinload(StockItem.movements),
        )
        .order_by(StockItem.created_at.desc(), StockItem.id.desc())
    )
    return list(db.scalars(query))


@router.get("/items/{item_id}", response_model=StockItemDetail)
def get_item(item_id: int, db: Annotated[Session, Depends(get_db)]) -> StockItem:
    return _get_stock_item_or_404(db, item_id)


@router.post("/items/{item_id}/entry", response_model=StockItemDetail, status_code=201)
def register_entry(
    item_id: int,
    payload: StockMovementCreate,
    db: Annotated[Session, Depends(get_db)],
) -> StockItem:
    item = _get_stock_item_or_404(db, item_id, for_update=True)
    if item.category == StockCategory.PIECE:
        _require_piece_manual_note(payload.notes)
    register_stock_movement(
        db,
        item,
        movement_type=StockMovementType.ENTRY,
        quantity=payload.quantity,
        notes=payload.notes,
    )
    db.commit()
    return _get_stock_item_or_404(db, item.id)


@router.post("/items/{item_id}/exit", response_model=StockItemDetail, status_code=201)
def register_exit(
    item_id: int,
    payload: StockMovementCreate,
    db: Annotated[Session, Depends(get_db)],
) -> StockItem:
    item = _get_stock_item_or_404(db, item_id, for_update=True)
    if item.category == StockCategory.PIECE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Saida manual de pecas cortadas nao e permitida. "
                "Destine as pecas a partir da OS para preservar a rastreabilidade."
            ),
        )
    register_stock_movement(
        db,
        item,
        movement_type=StockMovementType.EXIT,
        quantity=payload.quantity,
        notes=payload.notes,
    )
    db.commit()
    return _get_stock_item_or_404(db, item.id)


@router.post("/items/{item_id}/adjust", response_model=StockItemDetail, status_code=201)
def register_adjustment(
    item_id: int,
    payload: StockAdjustmentCreate,
    db: Annotated[Session, Depends(get_db)],
) -> StockItem:
    item = _get_stock_item_or_404(db, item_id, for_update=True)
    if item.category == StockCategory.PIECE:
        _require_piece_manual_note(payload.notes)
    adjust_stock_quantity(db, item, quantity=payload.quantity, notes=payload.notes)
    db.commit()
    return _get_stock_item_or_404(db, item.id)


@router.delete("/items/{item_id}", response_model=StockItemRead | None)
def delete_item(
    item_id: int,
    db: Annotated[Session, Depends(get_db)],
) -> StockItem | Response:
    item = _get_stock_item_or_404(db, item_id, for_update=True)
    if item.movements:
        item.is_active = False
        db.commit()
        return _get_stock_item_or_404(db, item.id)

    db.delete(item)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _get_stock_item_or_404(db: Session, item_id: int, *, for_update: bool = False) -> StockItem:
    query = (
        select(StockItem)
        .where(StockItem.id == item_id)
        .options(
            selectinload(StockItem.product),
            selectinload(StockItem.size),
            selectinload(StockItem.movements),
        )
    )
    if for_update:
        query = query.with_for_update()
    item = db.scalar(query)
    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stock item not found",
        )
    return item


def _require_piece_manual_note(notes: str | None) -> None:
    if not notes or not notes.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Informe uma observacao para movimentacao manual de pecas cortadas.",
        )
