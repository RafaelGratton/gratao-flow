from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ClientCreate(BaseModel):
    name: str
    phone: str
    type: str
    notes: str | None = None
    is_active: bool = True


class ClientRead(BaseModel):
    id: int
    name: str
    phone: str
    type: str
    notes: str | None
    is_active: bool
    can_delete: bool = False
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ClientUpdate(BaseModel):
    name: str
    phone: str
    type: str
    notes: str | None = None
    is_active: bool = True
