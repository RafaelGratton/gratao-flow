from datetime import datetime

from pydantic import BaseModel, ConfigDict


class SizeCreate(BaseModel):
    label: str


class SizeUpdate(BaseModel):
    label: str
    is_active: bool = True


class SizeRead(BaseModel):
    id: int
    label: str
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SizeAdminRead(SizeRead):
    can_delete: bool = False
