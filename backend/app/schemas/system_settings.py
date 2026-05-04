from pydantic import BaseModel, ConfigDict


class SystemSettingsUpdate(BaseModel):
    company_name: str
    company_phone: str
    company_address: str
    company_email: str | None = None


class SystemSettingsRead(SystemSettingsUpdate):
    id: int

    model_config = ConfigDict(from_attributes=True)
