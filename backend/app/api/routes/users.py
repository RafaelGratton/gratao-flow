from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin
from app.core.security import hash_password
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserPasswordChange, UserRead, UserUpdate

router = APIRouter(dependencies=[Depends(get_current_admin)])


@router.get("", response_model=list[UserRead])
def list_users(db: Annotated[Session, Depends(get_db)]) -> list[User]:
    return list(db.scalars(select(User).order_by(User.created_at.desc(), User.id.desc())))


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    db: Annotated[Session, Depends(get_db)],
) -> User:
    _ensure_email_available(db, payload.email)
    user = User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=payload.role,
        is_active=payload.is_active,
        is_admin=payload.role == "admin",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/{user_id}", response_model=UserRead)
def get_user(user_id: int, db: Annotated[Session, Depends(get_db)]) -> User:
    return _get_user_or_404(db, user_id)


@router.put("/{user_id}", response_model=UserRead)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Annotated[Session, Depends(get_db)],
) -> User:
    user = _get_user_or_404(db, user_id)
    _ensure_email_available(db, payload.email, user_id=user.id)
    _ensure_not_deactivating_last_admin(db, user, payload.role, payload.is_active)

    user.name = payload.name
    user.email = payload.email
    user.role = payload.role
    user.is_admin = payload.role == "admin"
    user.is_active = payload.is_active
    db.commit()
    db.refresh(user)
    return user


@router.post("/{user_id}/change-password", response_model=UserRead)
def change_user_password(
    user_id: int,
    payload: UserPasswordChange,
    db: Annotated[Session, Depends(get_db)],
) -> User:
    user = _get_user_or_404(db, user_id)
    user.password_hash = hash_password(payload.new_password)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", response_model=UserRead)
def deactivate_user(user_id: int, db: Annotated[Session, Depends(get_db)]) -> User:
    user = _get_user_or_404(db, user_id)
    _ensure_not_deactivating_last_admin(db, user, user.role, False)
    user.is_active = False
    db.commit()
    db.refresh(user)
    return user


def _get_user_or_404(db: Session, user_id: int) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


def _ensure_email_available(db: Session, email: str, user_id: int | None = None) -> None:
    existing = db.scalar(select(User).where(User.email == email))
    if existing is not None and existing.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )


def _ensure_not_deactivating_last_admin(
    db: Session,
    user: User,
    next_role: str,
    next_is_active: bool,
) -> None:
    is_current_admin = user.role == "admin" or user.is_admin
    is_next_active_admin = next_is_active and next_role == "admin"
    if not is_current_admin or is_next_active_admin:
        return

    active_admin_count = db.scalar(
        select(func.count(User.id)).where(
            User.is_active.is_(True),
            (User.role == "admin") | (User.is_admin.is_(True)),
        )
    )
    if active_admin_count <= 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate the last active admin",
        )
