from pydantic import BaseModel
from typing import Generic, TypeVar, Optional, Any

T = TypeVar("T")

class StandardResponse(BaseModel, Generic[T]):
    message: str
    status: str = "success"
    data: Optional[T] = None
