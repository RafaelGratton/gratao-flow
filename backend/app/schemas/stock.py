from datetime import datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, field_serializer, model_validator

from app.models.enums import StockCategory, StockMovementType
from app.schemas.product import ProductRead
from app.schemas.size import SizeRead

StockDecimal = Annotated[
    Decimal,
    Field(ge=Decimal("0"), max_digits=10, decimal_places=2),
]

PositiveStockDecimal = Annotated[
    Decimal,
    Field(gt=Decimal("0"), max_digits=10, decimal_places=2),
]


class StockItemCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    category: StockCategory
    product_id: int | None = None
    size_id: int | None = None
    color: str | None = Field(default=None, max_length=100)
    unit: str = Field(min_length=1, max_length=30)
    quantity: StockDecimal = Decimal("0.00")
    notes: str | None = None
    is_active: bool = True

    @model_validator(mode="after")
    def validate_piece_references(self) -> "StockItemCreate":
        if self.category == StockCategory.PIECE and (
            self.product_id is None or self.size_id is None
        ):
            raise ValueError("product_id and size_id are required for piece stock items")
        return self


class StockMovementCreate(BaseModel):
    quantity: PositiveStockDecimal
    notes: str | None = None


class StockAdjustmentCreate(BaseModel):
    quantity: StockDecimal
    notes: str | None = None


class StockMovementRead(BaseModel):
    id: int
    movement_type: StockMovementType
    quantity: StockDecimal
    previous_quantity: StockDecimal
    new_quantity: StockDecimal
    reference_type: str | None
    reference_id: int | None
    notes: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @field_serializer("quantity", "previous_quantity", "new_quantity")
    def serialize_quantity(self, value: Decimal) -> str:
        return f"{value:.2f}"


class StockItemRead(BaseModel):
    id: int
    name: str
    category: StockCategory
    product_id: int | None
    product: ProductRead | None = None
    size_id: int | None
    size: SizeRead | None = None
    color: str | None
    unit: str
    quantity: StockDecimal
    notes: str | None
    is_active: bool
    can_delete: bool = False
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @field_serializer("quantity")
    def serialize_quantity(self, value: Decimal) -> str:
        return f"{value:.2f}"


class StockItemDetail(StockItemRead):
    movements: list[StockMovementRead]
