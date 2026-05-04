from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_serializer

MoneyDecimal = Annotated[
    Decimal,
    Field(
        ge=Decimal("0"),
        max_digits=10,
        decimal_places=2,
        examples=[1.50],
        json_schema_extra={"example": 1.50},
    ),
]


ServiceType = Literal["corte", "serigrafia", "confeccao", "terceirizacao", "extra"]


class ServiceCreate(BaseModel):
    name: str
    type: ServiceType
    price_per_unit: MoneyDecimal
    is_active: bool = True


class ServiceUpdate(BaseModel):
    name: str | None = None
    type: ServiceType | None = None
    price_per_unit: MoneyDecimal
    is_active: bool = True


class ServiceRead(BaseModel):
    id: int
    name: str
    type: str
    price_per_unit: MoneyDecimal
    is_active: bool
    can_delete: bool = False

    model_config = ConfigDict(from_attributes=True)

    @field_serializer("price_per_unit")
    def serialize_price_per_unit(self, value: Decimal) -> str:
        return f"{value:.2f}"
