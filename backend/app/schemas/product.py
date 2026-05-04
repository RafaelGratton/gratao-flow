from pydantic import BaseModel, ConfigDict


class ProductRead(BaseModel):
    id: int
    name: str
    is_active: bool

    model_config = ConfigDict(from_attributes=True)
