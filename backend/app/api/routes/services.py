from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import case, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_admin
from app.db.session import get_db
from app.models.service import Service
from app.models.user import User
from app.schemas.service import ServiceCreate, ServiceRead, ServiceUpdate

router = APIRouter(dependencies=[Depends(get_current_admin)])

SERVICE_ORDER = [
    "Corte",
    "Confecção",
    "Serigrafia frente",
    "Serigrafia frente e costas",
]


@router.post("", response_model=ServiceRead, status_code=201)
def create_service(
    payload: ServiceCreate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_current_admin)],
) -> Service:
    service = Service(**payload.model_dump())
    db.add(service)
    db.commit()
    db.refresh(service)
    return service


@router.get("", response_model=list[ServiceRead])
def list_services(db: Annotated[Session, Depends(get_db)]) -> list[Service]:
    order_case = case(
        {name: index for index, name in enumerate(SERVICE_ORDER)},
        value=Service.name,
        else_=len(SERVICE_ORDER),
    )
    return list(
        db.scalars(
            select(Service)
            .options(selectinload(Service.order_services))
            .order_by(order_case, Service.id)
        )
    )


@router.put("/{service_id}", response_model=ServiceRead)
def update_service(
    service_id: int,
    payload: ServiceUpdate,
    db: Annotated[Session, Depends(get_db)],
) -> Service:
    service = db.get(Service, service_id)
    if service is None:
        raise HTTPException(status_code=404, detail="Service not found")

    if payload.name:
        existing = db.scalar(
            select(Service).where(Service.name == payload.name, Service.id != service_id)
        )
        if existing is not None:
            raise HTTPException(status_code=400, detail="Service name already exists")
        service.name = payload.name

    if payload.type is not None:
        service.type = payload.type
    service.price_per_unit = payload.price_per_unit
    service.is_active = payload.is_active
    db.commit()
    db.refresh(service)
    return service


@router.delete("/{service_id}", response_model=ServiceRead | None)
def delete_service(
    service_id: int,
    db: Annotated[Session, Depends(get_db)],
) -> Service | Response:
    service = db.scalar(
        select(Service)
        .where(Service.id == service_id)
        .options(selectinload(Service.order_services))
    )
    if service is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Service not found")

    if service.order_services:
        service.is_active = False
        db.commit()
        db.refresh(service)
        return service

    db.delete(service)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
