from http.client import HTTPException
import sys
import io
if hasattr(sys.stdout, 'buffer'):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from sqlalchemy.sql import func
import os
from dotenv import load_dotenv

load_dotenv()

# Database configuration - PostgreSQL only
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:1234@localhost:5432/vizzy_chat")

print("🐘 Connecting to PostgreSQL database...")
print(f"📍 Database URL: {DATABASE_URL}")

try:
    # PostgreSQL engine configuration
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        pool_recycle=300,
        pool_size=10,
        max_overflow=20,
        echo=False  # Set to True for SQL debugging
    )
    
    # Test the connection
    with engine.connect() as conn:
        from sqlalchemy import text
        result = conn.execute(text("SELECT version()"))
        version = result.fetchone()[0]
        print(f"✅ PostgreSQL connected successfully!")
        print(f"📊 PostgreSQL version: {version}")
    
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    DATABASE_CONNECTED = True
    
except Exception as e:
    print(f"❌ PostgreSQL connection failed: {e}")
    print("\n🔧 Troubleshooting steps:")
    print("1. Install PostgreSQL: https://www.postgresql.org/download/")
    print("2. Start PostgreSQL service")
    print("3. Create database: CREATE DATABASE vizzy_chat;")
    print("4. Check username/password in .env file")
    print("5. Ensure PostgreSQL is running on localhost:5432")
    
    # Don't fallback - PostgreSQL only
    engine = None
    SessionLocal = None
    DATABASE_CONNECTED = False
    raise Exception(f"PostgreSQL connection required but failed: {e}")
    print(f"⚠️  PostgreSQL connection failed: {e}")
    print("📝 Please ensure PostgreSQL is running and database 'vizzy_chat' exists")
    print("📝 Default connection: postgresql://postgres:postgres@localhost:5432/vizzy_chat")
    engine = None
    SessionLocal = None
    DATABASE_CONNECTED = False
Base = declarative_base()

# Database Models
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(100))
    user_type = Column(String(20), default="home")  # "home" or "business"
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    chat_sessions = relationship("ChatSession", back_populates="user")
    messages = relationship("ChatMessage", back_populates="user")

class ChatSession(Base):
    __tablename__ = "chat_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    session_name = Column(String(200))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="chat_sessions")
    messages = relationship("ChatMessage", back_populates="session")

class ChatMessage(Base):
    __tablename__ = "chat_messages"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("chat_sessions.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    message_type = Column(String(20), nullable=False)  # "user", "assistant"
    content = Column(Text, nullable=False)
    prompt = Column(Text)  # For image generation prompts
    style = Column(String(50))  # For image generation style
    image_url = Column(String(500))  # Generated image URL
    generation_type = Column(String(20))  # "text-to-image", "image-to-image"
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    session = relationship("ChatSession", back_populates="messages")
    user = relationship("User", back_populates="messages")

# Database dependency
def get_db():
    if not DATABASE_CONNECTED or SessionLocal is None:
        raise HTTPException(
            status_code=503,
            detail="Database connection not available"
        )
    
    db = SessionLocal()
    try:
        yield db
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()

# Create tables
def create_tables():
    if DATABASE_CONNECTED and engine is not None:
        try:
            Base.metadata.create_all(bind=engine)
            print("✅ Database tables created successfully!")
        except Exception as e:
            print(f"⚠️  Failed to create tables: {e}")
    else:
        print("📝 Skipping table creation - no database connection")