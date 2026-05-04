from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_admin
from app.db.session import get_db
from app.models.client import Client
from app.models.user import User
from app.schemas.client import ClientCreate, ClientRead, ClientUpdate

router = APIRouter(dependencies=[Depends(get_current_admin)])


@router.post("", response_model=ClientRead, status_code=201)
def create_client(
    payload: ClientCreate,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_current_admin)],
) -> Client:
    client = Client(**payload.model_dump())
    db.add(client)
    db.commit()
    db.refresh(client)
    return client


@router.get("", response_model=list[ClientRead])
def list_clients(db: Annotated[Session, Depends(get_db)]) -> list[Client]:
    return list(db.scalars(select(Client).options(selectinload(Client.orders)).order_by(Client.name)))


@router.put("/{client_id}", response_model=ClientRead)
def update_client(
    client_id: int,
    payload: ClientUpdate,
    db: Annotated[Session, Depends(get_db)],
) -> Client:
    client = _get_client_or_404(db, client_id)
    client.name = payload.name
    client.phone = payload.phone
    client.type = payload.type
    client.notes = payload.notes
    client.is_active = payload.is_active
    db.commit()
    return _get_client_or_404(db, client.id)


@router.delete("/{client_id}", response_model=ClientRead | None)
def delete_client(
    client_id: int,
    db: Annotated[Session, Depends(get_db)],
) -> Client | Response:
    client = _get_client_or_404(db, client_id)
    if client.orders:
        client.is_active = False
        db.commit()
        return _get_client_or_404(db, client.id)

    db.delete(client)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _get_client_or_404(db: Session, client_id: int) -> Client:
    client = db.scalar(
        select(Client).where(Client.id == client_id).options(selectinload(Client.orders))
    )
    if client is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
    return client
