from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

VALID_ROLES = {"admin", "operator"}


class UserCreate(BaseModel):
    name: str
    email: str
    password: str = Field(min_length=8)
    role: str
    is_active: bool = True

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Name is required")
        return value

    @field_validator("role")
    @classmethod
    def validate_role(cls, value: str) -> str:
        if value not in VALID_ROLES:
            raise ValueError("Role must be admin or operator")
        return value

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        value = value.strip().lower()
        if "@" not in value:
            raise ValueError("Email is required")
        return value


class UserUpdate(BaseModel):
    name: str
    email: str
    role: str
    is_active: bool = True

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Name is required")
        return value

    @field_validator("role")
    @classmethod
    def validate_role(cls, value: str) -> str:
        if value not in VALID_ROLES:
            raise ValueError("Role must be admin or operator")
        return value

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        value = value.strip().lower()
        if "@" not in value:
            raise ValueError("Email is required")
        return value


class UserPasswordChange(BaseModel):
    new_password: str = Field(min_length=8)


class UserRead(BaseModel):
    id: int
    name: str
    email: str
    role: str
    is_active: bool
    is_admin: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
