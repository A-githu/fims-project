from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime


class DepartmentCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)


class DepartmentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)


class DepartmentOut(BaseModel):
    id: UUID
    name: str
    created_at: datetime

    model_config = {"from_attributes": True}