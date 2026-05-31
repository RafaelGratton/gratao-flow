from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.size import Size
from app.models.user import User
from app.schemas.size import SizeAdminRead, SizeCreate, SizeUpdate

router = APIRouter(dependencies=[Depends(get_current_user)])

SIZE_ORDER = ["4", "6", "8", "10", "12", "14", "16", "PP", "P", "M", "G", "GG"]


@router.post("", response_model=SizeAdminRead, status_code=201)
def create_size(
    payload: SizeCreate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
) -> Size:
    label = _normalize_label(payload.label)
    _ensure_size_label_available(db, label)

    size = Size(label=label, is_active=True)
    db.add(size)
    db.commit()
    return _get_size_or_404(db, size.id)


@router.get("", response_model=list[SizeAdminRead])
def list_sizes(db: Annotated[Session, Depends(get_db)]) -> list[Size]:
    order_case = case(
        {label: index for index, label in enumerate(SIZE_ORDER)},
        value=Size.label,
        else_=len(SIZE_ORDER),
    )
    return list(
        db.scalars(
            select(Size)
            .options(
                selectinload(Size.orders),
                selectinload(Size.order_items),
                selectinload(Size.stock_items),
            )
            .order_by(order_case, Size.id)
        )
    )


@router.put("/{size_id}", response_model=SizeAdminRead)
def update_size(
    size_id: int,
    payload: SizeUpdate,
    db: Annotated[Session, Depends(get_db)],
) -> Size:
    size = _get_size_or_404(db, size_id)
    label = _normalize_label(payload.label)
    _ensure_size_label_available(db, label, size_id)

    if label != size.label and not size.can_delete:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Size in use cannot be renamed",
        )

    size.label = label
    size.is_active = payload.is_active
    db.commit()
    return _get_size_or_404(db, size.id)


@router.delete("/{size_id}", response_model=SizeAdminRead | None)
def delete_size(
    size_id: int,
    db: Annotated[Session, Depends(get_db)],
) -> Size | Response:
    size = _get_size_or_404(db, size_id)
    if not size.can_delete:
        size.is_active = False
        db.commit()
        return _get_size_or_404(db, size.id)

    db.delete(size)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _get_size_or_404(db: Session, size_id: int) -> Size:
    size = db.scalar(
        select(Size)
        .where(Size.id == size_id)
        .options(
            selectinload(Size.orders),
            selectinload(Size.order_items),
            selectinload(Size.stock_items),
        )
    )
    if size is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Size not found")
    return size


def _normalize_label(label: str) -> str:
    normalized = " ".join(label.split())
    if not normalized:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Size label is required",
        )
    return normalized


def _ensure_size_label_available(
    db: Session,
    label: str,
    size_id: int | None = None,
) -> None:
    query = select(Size).where(func.lower(Size.label) == label.lower())
    if size_id is not None:
        query = query.where(Size.id != size_id)
    if db.scalar(query) is not None:
        raise HTTPException(status_code=400, detail="Size label already exists")
