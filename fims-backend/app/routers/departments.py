import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
import uuid

from app.database import get_db
from app.models.department import Department
from app.core.dependencies import get_current_user
from app.models.user import User

logger = logging.getLogger("fims")
router = APIRouter(prefix="/api/departments", tags=["Départements"])

class DepartmentOut(BaseModel):
    id: uuid.UUID
    name: str

    model_config = {"from_attributes": True}

@router.get(
    "/",
    response_model=List[DepartmentOut],
    summary="Lister tous les départements",
    description="Retourne tous les départements de la base de données."
)
async def list_departments(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        result = await db.execute(select(Department).order_by(Department.name))
        return result.scalars().all()
    except Exception as e:
        logger.error(f"[DEPARTMENTS][LIST] {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
