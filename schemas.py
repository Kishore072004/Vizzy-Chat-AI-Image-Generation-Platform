from pydantic import BaseModel, EmailStr, validator
from typing import Optional, List
from datetime import datetime

# User schemas
class UserBase(BaseModel):
    username: str
    email: EmailStr
    full_name: Optional[str] = None
    user_type: str = "home"

class UserCreate(UserBase):
    password: str
    
    @validator('password')
    def validate_password(cls, v):
        if len(v) < 6:
            raise ValueError('Password must be at least 6 characters long')
        if len(v) > 128:
            raise ValueError('Password cannot be longer than 128 characters')
        return v
    
    @validator('username')
    def validate_username(cls, v):
        if len(v) < 3:
            raise ValueError('Username must be at least 3 characters long')
        if len(v) > 50:
            raise ValueError('Username cannot be longer than 50 characters')
        return v

class UserLogin(BaseModel):
    username: str
    password: str

class User(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    full_name: Optional[str]
    user_type: str
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

# Token schemas
class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class TokenData(BaseModel):
    username: Optional[str] = None

# Chat schemas
class ChatSessionCreate(BaseModel):
    session_name: Optional[str] = None

class ChatSession(BaseModel):
    id: int
    session_name: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True

class ChatMessageCreate(BaseModel):
    content: str
    message_type: str
    prompt: Optional[str] = None
    style: Optional[str] = None
    image_url: Optional[str] = None
    generation_type: Optional[str] = None

class ChatMessage(BaseModel):
    id: int
    content: str
    message_type: str
    prompt: Optional[str]
    style: Optional[str]
    image_url: Optional[str]
    generation_type: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True

class ChatSessionWithMessages(ChatSession):
    messages: List[ChatMessage] = []
    
    class Config:
        from_attributes = True