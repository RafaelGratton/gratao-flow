from pydantic import BaseModel, ConfigDict


class SizeRead(BaseModel):
    id: int
    label: str

    model_config = ConfigDict(from_attributes=True)
