from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin
from app.db.session import get_db
from app.models.system_settings import SystemSettings
from app.schemas.system_settings import SystemSettingsRead, SystemSettingsUpdate

router = APIRouter(dependencies=[Depends(get_current_admin)])

SETTINGS_ID = 1


@router.get("", response_model=SystemSettingsRead)
def get_settings(db: Annotated[Session, Depends(get_db)]) -> SystemSettings:
    return _get_or_create_settings(db)


@router.put("", response_model=SystemSettingsRead)
def update_settings(
    payload: SystemSettingsUpdate,
    db: Annotated[Session, Depends(get_db)],
) -> SystemSettings:
    settings = _get_or_create_settings(db)
    settings.company_name = payload.company_name.strip()
    settings.company_phone = payload.company_phone.strip()
    settings.company_address = payload.company_address.strip()
    settings.company_email = payload.company_email.strip() if payload.company_email else None
    db.commit()
    db.refresh(settings)
    return settings


def _get_or_create_settings(db: Session) -> SystemSettings:
    settings = db.get(SystemSettings, SETTINGS_ID)
    if settings is not None:
        return settings

    settings = SystemSettings(
        id=SETTINGS_ID,
        company_name="Gratão Uniformes",
        company_phone="",
        company_address="",
        company_email=None,
    )
    db.add(settings)
    db.commit()
    db.refresh(settings)
    return settings
