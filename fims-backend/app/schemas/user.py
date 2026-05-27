from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from uuid import UUID
from datetime import datetime
from app.models.user import UserRole


class UserCreate(BaseModel):
    """Utilisé par l'admin pour créer un compte utilisateur"""
    full_name: str = Field(..., min_length=2, max_length=150)
    email: EmailStr
    password: str = Field(..., min_length=8)
    role: UserRole
    department_id: Optional[UUID] = None


class UserUpdate(BaseModel):
    """Modification partielle d'un utilisateur"""
    full_name: Optional[str] = Field(None, min_length=2, max_length=150)
    email: Optional[EmailStr] = None
    role: Optional[UserRole] = None
    department_id: Optional[UUID] = None
    is_active: Optional[bool] = None


class UserOut(BaseModel):
    """Ce qui est renvoyé au client — jamais le password_hash"""
    id: UUID
    full_name: str
    email: str
    role: UserRole
    department_id: Optional[UUID]
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class UserOutMinimal(BaseModel):
    """Version réduite pour les listes ou les relations"""
    id: UUID
    full_name: str
    email: str
    role: UserRole

    model_config = {"from_attributes": True}