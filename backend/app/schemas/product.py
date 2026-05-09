from pydantic import BaseModel, ConfigDict


class ProductCreate(BaseModel):
    name: str
    is_active: bool = True


class ProductUpdate(BaseModel):
    name: str
    is_active: bool = True


class ProductRead(BaseModel):
    id: int
    name: str
    is_active: bool
    can_delete: bool = False

    model_config = ConfigDict(from_attributes=True)
