from pydantic import BaseModel, EmailStr, Field

class LoginRequest(BaseModel):
    email: EmailStr = Field(..., example="admin@fims.cm")
    password: str = Field(..., example="password123")

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    role: str

class RefreshRequest(BaseModel):
    refresh_token: str = Field(..., example="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...")

class ChangePasswordRequest(BaseModel):
    old_password: str = Field(..., example="password123")
    new_password: str = Field(..., min_length=8, example="nouveauMotDePasse456")