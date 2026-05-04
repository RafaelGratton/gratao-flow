from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import case, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin
from app.db.session import get_db
from app.models.size import Size
from app.schemas.size import SizeRead

router = APIRouter(dependencies=[Depends(get_current_admin)])

SIZE_ORDER = ["4", "6", "8", "10", "12", "14", "16", "PP", "P", "M", "G", "GG"]


@router.get("", response_model=list[SizeRead])
def list_sizes(db: Annotated[Session, Depends(get_db)]) -> list[Size]:
    order_case = case(
        {label: index for index, label in enumerate(SIZE_ORDER)},
        value=Size.label,
        else_=len(SIZE_ORDER),
    )
    return list(db.scalars(select(Size).order_by(order_case, Size.id)))
