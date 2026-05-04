from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.outsourcing import Outsourcer
from app.models.user import User
from app.schemas.outsourcing import OutsourcerCreate, OutsourcerRead

router = APIRouter(dependencies=[Depends(get_current_user)])


@router.post("", response_model=OutsourcerRead, status_code=201)
def create_outsourcer(
    payload: OutsourcerCreate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
) -> Outsourcer:
    outsourcer = Outsourcer(**payload.model_dump())
    db.add(outsourcer)
    db.commit()
    db.refresh(outsourcer)
    return outsourcer


@router.get("", response_model=list[OutsourcerRead])
def list_outsourcers(db: Annotated[Session, Depends(get_db)]) -> list[Outsourcer]:
    return list(db.scalars(select(Outsourcer).order_by(Outsourcer.name)))


@router.get("/{outsourcer_id}", response_model=OutsourcerRead)
def get_outsourcer(
    outsourcer_id: int,
    db: Annotated[Session, Depends(get_db)],
) -> Outsourcer:
    outsourcer = db.get(Outsourcer, outsourcer_id)
    if outsourcer is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Outsourcer not found",
        )
    return outsourcer
