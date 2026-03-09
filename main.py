from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Depends, status
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.requests import Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import timedelta, datetime
import requests
import base64
import os
from typing import Optional, List
import asyncio
import time

# Import our modules
from database import get_db, create_tables, User, ChatSession, ChatMessage, DATABASE_CONNECTED
from auth import (
    authenticate_user, create_access_token, get_password_hash, 
    get_current_active_user, ACCESS_TOKEN_EXPIRE_MINUTES
)
from schemas import (
    UserCreate, UserLogin, Token, ChatSessionCreate, ChatMessageCreate,
    ChatSession as ChatSessionSchema, ChatMessage as ChatMessageSchema,
    ChatSessionWithMessages, UserResponse
)

app = FastAPI(title="Vizzy Chat", description="Conversational Visual Content Creation")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create database tables on startup
@app.on_event("startup")
def startup_event():
    create_tables()
    if DATABASE_CONNECTED:
        print("🚀 Vizzy Chat started with database support")
    else:
        print("🚀 Vizzy Chat started in demo mode (no database)")

# Mount static files and templates
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# Freepik API configuration
FREEPIK_API_KEY = "FPSXb733db6c5ff17734f65a87daa3b5c570"
FREEPIK_BASE_URL = "https://api.freepik.com/v1"

# Stability AI configuration
STABILITY_API_KEY = "sk-xyRbXjVi10Po2f8qfkAf9omP1pV7S8KcTQyP18dkfYUXspEL"
STABILITY_BASE_URL = "https://api.stability.ai"

class FreepikAPI:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.headers = {
            "x-freepik-api-key": api_key,
            "Content-Type": "application/json"
        }
    
    async def text_to_image(self, prompt: str, style: str = "realistic"):
        """Generate image from text prompt using Freepik Mystic API"""
        url = f"{FREEPIK_BASE_URL}/ai/mystic"
        
        # Map our simple styles to valid Freepik model types
        model_mapping = {
            "realistic": "realism",
            "artistic": "fluid", 
            "cartoon": "zen",
            "abstract": "flexible",
            "vintage": "super_real",
            "portrait": "editorial_portraits"
        }
        
        payload = {
            "prompt": prompt,
            "resolution": "1k",
            "aspect_ratio": "square_1_1", 
            "model": model_mapping.get(style, "realism"),
            "filter_nsfw": True
        }
        
        try:
            print(f"🎨 Making request to Freepik Mystic API")
            print(f"📍 URL: {url}")
            print(f"📝 Payload: {payload}")
            print(f"🔑 API Key: {self.api_key[:10]}...")
            
            # Step 1: Submit the generation request
            response = requests.post(url, headers=self.headers, json=payload, timeout=30)
            print(f"📊 Response status: {response.status_code}")
            print(f"📄 Response headers: {dict(response.headers)}")
            print(f"📝 Response content: {response.text}")
            
            if response.status_code != 200:
                error_detail = f"Freepik API error {response.status_code}: {response.text}"
                print(f"❌ {error_detail}")
                raise HTTPException(status_code=500, detail=error_detail)
            
            task_data = response.json()
            print(f"📦 Task data: {task_data}")
            
            task_id = task_data.get("data", {}).get("task_id")
            
            if not task_id:
                print(f"❌ No task ID in response: {task_data}")
                raise HTTPException(status_code=500, detail="No task ID received from Freepik API")
            
            print(f"✅ Got task ID: {task_id}")
            
            # Step 2: Poll for completion
            return await self.wait_for_completion(task_id)
            
        except requests.exceptions.Timeout:
            error_msg = "Freepik API request timed out"
            print(f"❌ {error_msg}")
            raise HTTPException(status_code=500, detail=error_msg)
        except requests.exceptions.RequestException as e:
            error_msg = f"Freepik API request failed: {str(e)}"
            print(f"❌ {error_msg}")
            raise HTTPException(status_code=500, detail=error_msg)
        except Exception as e:
            error_msg = f"Unexpected error in image generation: {str(e)}"
            print(f"❌ {error_msg}")
            raise HTTPException(status_code=500, detail=error_msg)
            
            # Step 2: Poll for completion
            return await self.wait_for_completion(task_id)
            
        except requests.exceptions.RequestException as e:
            print(f"Freepik API error: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Freepik API error: {str(e)}")
    
    async def wait_for_completion(self, task_id: str, max_wait_time: int = 60):
        """Wait for the Mystic task to complete"""
        url = f"{FREEPIK_BASE_URL}/ai/mystic/{task_id}"
        
        print(f"⏳ Polling for task completion: {task_id}")
        start_time = time.time()
        poll_count = 0
        
        while time.time() - start_time < max_wait_time:
            poll_count += 1
            try:
                print(f"📊 Poll #{poll_count} - Checking task status...")
                response = requests.get(url, headers=self.headers, timeout=10)
                print(f"📊 Status check response: {response.status_code}")
                
                if response.status_code != 200:
                    print(f"⚠️ Status check failed: {response.status_code} - {response.text}")
                    await asyncio.sleep(2)
                    continue
                
                result = response.json()
                status = result.get("data", {}).get("status")
                
                print(f"📊 Task status: {status}")
                
                if status == "COMPLETED":
                    print(f"✅ Task completed successfully!")
                    print(f"📦 Result: {result}")
                    return result
                elif status == "FAILED":
                    error_msg = f"Image generation failed: {result.get('data', {}).get('error', 'Unknown error')}"
                    print(f"❌ {error_msg}")
                    raise HTTPException(status_code=500, detail=error_msg)
                elif status in ["PENDING", "PROCESSING"]:
                    print(f"⏳ Task still {status.lower()}...")
                else:
                    print(f"⚠️ Unknown status: {status}")
                
                # Wait 2 seconds before checking again
                await asyncio.sleep(2)
                
            except requests.exceptions.RequestException as e:
                print(f"⚠️ Error checking task status: {str(e)}")
                await asyncio.sleep(2)
            except Exception as e:
                print(f"❌ Unexpected error during polling: {str(e)}")
                await asyncio.sleep(2)
        
        error_msg = f"Image generation timed out after {max_wait_time} seconds"
        print(f"❌ {error_msg}")
        raise HTTPException(status_code=408, detail=error_msg)
    
    async def image_to_image(self, image_data: bytes, prompt: str, style: str = "realistic"):
        """Transform existing image based on prompt using Freepik Mystic API"""
        url = f"{FREEPIK_BASE_URL}/ai/mystic"
        
        # Convert image to base64
        image_b64 = base64.b64encode(image_data).decode('utf-8')
        
        # Map our simple styles to valid Freepik model types (same as text-to-image)
        model_mapping = {
            "realistic": "realism",
            "artistic": "fluid", 
            "cartoon": "zen",
            "abstract": "flexible",
            "vintage": "super_real",
            "portrait": "editorial_portraits"
        }
        
        payload = {
            "prompt": prompt,
            "resolution": "1k",
            "aspect_ratio": "square_1_1", 
            "model": model_mapping.get(style, "realism"),
            "filter_nsfw": True,
            "structure_reference": image_b64
        }
        
        try:
            print(f"🎨 Making image-to-image request to Freepik Mystic API")
            print(f"📍 URL: {url}")
            print(f"📝 Payload keys: {list(payload.keys())}")
            print(f"🔑 API Key: {self.api_key[:10]}...")
            print(f"🖼️ Image size: {len(image_data)} bytes")
            
            # Step 1: Submit the transformation request
            response = requests.post(url, headers=self.headers, json=payload, timeout=30)
            print(f"📊 Response status: {response.status_code}")
            print(f"📄 Response headers: {dict(response.headers)}")
            print(f"📝 Response content: {response.text}")
            
            if response.status_code != 200:
                error_detail = f"Freepik API error {response.status_code}: {response.text}"
                print(f"❌ {error_detail}")
                raise HTTPException(status_code=500, detail=error_detail)
            
            task_data = response.json()
            print(f"📦 Task data: {task_data}")
            
            task_id = task_data.get("data", {}).get("task_id")
            
            if not task_id:
                print(f"❌ No task ID in response: {task_data}")
                raise HTTPException(status_code=500, detail="No task ID received from Freepik API")
            
            print(f"✅ Got task ID: {task_id}")
            
            # Step 2: Poll for completion (same as text-to-image)
            return await self.wait_for_completion(task_id)
            
        except requests.exceptions.Timeout:
            error_msg = "Freepik API request timed out"
            print(f"❌ {error_msg}")
            raise HTTPException(status_code=500, detail=error_msg)
        except requests.exceptions.RequestException as e:
            error_msg = f"Freepik API request failed: {str(e)}"
            print(f"❌ {error_msg}")
            raise HTTPException(status_code=500, detail=error_msg)
        except Exception as e:
            error_msg = f"Unexpected error in image transformation: {str(e)}"
            print(f"❌ {error_msg}")
            raise HTTPException(status_code=500, detail=error_msg)
    
freepik_api = FreepikAPI(FREEPIK_API_KEY)

class StabilityAPI:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Accept": "application/json"
        }
    
    async def image_to_image(self, image_data: bytes, prompt: str, style: str = "realistic"):
        """Transform existing image using Stability AI"""
        url = f"{STABILITY_BASE_URL}/v1/generation/stable-diffusion-xl-1024-v1-0/image-to-image"
        
        try:
            print(f"🎨 Making image-to-image request to Stability AI")
            print(f"📍 URL: {url}")
            print(f"📝 Prompt: {prompt}")
            print(f"🎨 Style: {style}")
            print(f"🖼️ Image size: {len(image_data)} bytes")
            
            # Prepare the multipart form data
            files = {
                'init_image': ('image.png', image_data, 'image/png'),
            }
            
            # Style-enhanced prompt
            style_prompts = {
                "realistic": "photorealistic, high quality, detailed",
                "artistic": "artistic, painterly, creative, expressive",
                "cartoon": "cartoon style, animated, colorful, stylized",
                "abstract": "abstract art, modern, geometric, artistic",
                "vintage": "vintage style, retro, classic, aged",
                "portrait": "portrait style, professional, detailed face"
            }
            
            enhanced_prompt = f"{prompt}, {style_prompts.get(style, 'high quality')}"
            
            data = {
                'text_prompts[0][text]': enhanced_prompt,
                'text_prompts[0][weight]': 1,
                'cfg_scale': 7,
                'image_strength': 0.35,  # How much to transform (0.0 = no change, 1.0 = complete change)
                'steps': 30,
                'samples': 1
            }
            
            # Make the request
            response = requests.post(
                url, 
                headers=self.headers, 
                files=files, 
                data=data,
                timeout=60
            )
            
            print(f"📊 Response status: {response.status_code}")
            print(f"📄 Response headers: {dict(response.headers)}")
            
            if response.status_code == 200:
                result = response.json()
                print(f"📦 Response data keys: {result.keys()}")
                
                # Extract the generated image
                if 'artifacts' in result and len(result['artifacts']) > 0:
                    image_b64 = result['artifacts'][0]['base64']
                    image_url = f"data:image/png;base64,{image_b64}"
                    
                    print(f"✅ Image transformation successful!")
                    
                    # Return in a format similar to Freepik API
                    return {
                        "data": {
                            "generated": [image_url],
                            "status": "COMPLETED"
                        }
                    }
                else:
                    error_msg = "No artifacts in Stability AI response"
                    print(f"❌ {error_msg}")
                    raise HTTPException(status_code=500, detail=error_msg)
            else:
                error_detail = f"Stability AI error {response.status_code}: {response.text}"
                print(f"❌ {error_detail}")
                raise HTTPException(status_code=500, detail=error_detail)
                
        except requests.exceptions.Timeout:
            error_msg = "Stability AI request timed out"
            print(f"❌ {error_msg}")
            raise HTTPException(status_code=500, detail=error_msg)
        except requests.exceptions.RequestException as e:
            error_msg = f"Stability AI request failed: {str(e)}"
            print(f"❌ {error_msg}")
            raise HTTPException(status_code=500, detail=error_msg)
        except Exception as e:
            error_msg = f"Unexpected error in Stability AI transformation: {str(e)}"
            print(f"❌ {error_msg}")
            raise HTTPException(status_code=500, detail=error_msg)

stability_api = StabilityAPI(STABILITY_API_KEY)

@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    """Main chat interface"""
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    """Login page"""
    return templates.TemplateResponse("login.html", {"request": request})

@app.get("/register", response_class=HTMLResponse)
async def register_page(request: Request):
    """Registration page"""
    return templates.TemplateResponse("register.html", {"request": request})

# Authentication endpoints
@app.post("/api/register", response_model=Token)
async def register(user: UserCreate, db: Session = Depends(get_db)):
    """Register a new user"""
    try:
        print(f"🔐 Registration attempt for user: {user.username}")
        print(f"🔐 Password length: {len(user.password)} characters, {len(user.password.encode('utf-8'))} bytes")
        
        # Check if user already exists
        db_user = db.query(User).filter(
            (User.username == user.username) | (User.email == user.email)
        ).first()
        
        if db_user:
            raise HTTPException(
                status_code=400,
                detail="Username or email already registered"
            )
        
        # Create new user
        print(f"🔐 Hashing password...")
        hashed_password = get_password_hash(user.password)
        print(f"✅ Password hashed successfully")
        
        db_user = User(
            username=user.username,
            email=user.email,
            full_name=user.full_name,
            user_type=user.user_type,
            hashed_password=hashed_password
        )
        
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        
        # Create access token
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": db_user.username}, expires_delta=access_token_expires
        )
        
        print(f"✅ User {user.username} registered successfully")
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": UserResponse.from_orm(db_user)
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Registration error: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")

@app.post("/api/login", response_model=Token)
async def login(user_credentials: UserLogin, db: Session = Depends(get_db)):
    """Login user"""
    try:
        user = authenticate_user(db, user_credentials.username, user_credentials.password)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.username}, expires_delta=access_token_expires
        )
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": UserResponse.from_orm(user)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Login failed: {str(e)}")

@app.get("/api/me", response_model=UserResponse)
async def read_users_me(current_user: User = Depends(get_current_active_user)):
    """Get current user info"""
    return UserResponse.from_orm(current_user)

# Chat session endpoints
@app.post("/api/chat/sessions", response_model=ChatSessionSchema)
async def create_chat_session(
    session_data: ChatSessionCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new chat session"""
    try:
        db_session = ChatSession(
            user_id=current_user.id,
            session_name=session_data.session_name or f"Chat {datetime.now().strftime('%Y-%m-%d %H:%M')}"
        )
        
        db.add(db_session)
        db.commit()
        db.refresh(db_session)
        
        return ChatSessionSchema.from_orm(db_session)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create session: {str(e)}")

@app.get("/api/chat/sessions", response_model=List[ChatSessionSchema])
async def get_chat_sessions(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all chat sessions for current user"""
    try:
        sessions = db.query(ChatSession).filter(
            ChatSession.user_id == current_user.id
        ).order_by(ChatSession.updated_at.desc()).all()
        
        return [ChatSessionSchema.from_orm(session) for session in sessions]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get sessions: {str(e)}")

@app.get("/api/chat/sessions/{session_id}", response_model=ChatSessionWithMessages)
async def get_chat_session(
    session_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get a specific chat session with messages"""
    try:
        session = db.query(ChatSession).filter(
            ChatSession.id == session_id,
            ChatSession.user_id == current_user.id
        ).first()
        
        if not session:
            raise HTTPException(status_code=404, detail="Chat session not found")
        
        return ChatSessionWithMessages.from_orm(session)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get session: {str(e)}")

@app.post("/api/chat/sessions/{session_id}/messages", response_model=ChatMessageSchema)
async def add_chat_message(
    session_id: int,
    message_data: ChatMessageCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Add a message to a chat session"""
    try:
        # Verify session belongs to user
        session = db.query(ChatSession).filter(
            ChatSession.id == session_id,
            ChatSession.user_id == current_user.id
        ).first()
        
        if not session:
            raise HTTPException(status_code=404, detail="Chat session not found")
        
        # Create message
        db_message = ChatMessage(
            session_id=session_id,
            user_id=current_user.id,
            message_type=message_data.message_type,
            content=message_data.content,
            prompt=message_data.prompt,
            style=message_data.style,
            image_url=message_data.image_url,
            generation_type=message_data.generation_type
        )
        
        db.add(db_message)
        db.commit()
        db.refresh(db_message)
        
        # Update session timestamp
        session.updated_at = datetime.now()
        db.commit()
        
        return ChatMessageSchema.from_orm(db_message)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to add message: {str(e)}")

@app.post("/api/generate/text-to-image")
async def generate_text_to_image(
    prompt: str = Form(...),
    style: str = Form(default="realistic"),
    user_type: str = Form(default="home"),
    session_id: int = Form(None),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Generate image from text prompt"""
    try:
        # Verify session belongs to user if session_id provided
        session = None
        if session_id:
            session = db.query(ChatSession).filter(
                ChatSession.id == session_id,
                ChatSession.user_id == current_user.id
            ).first()
            
            if not session:
                raise HTTPException(status_code=404, detail="Chat session not found")
        else:
            # Create a new session if none provided
            session = ChatSession(
                user_id=current_user.id,
                session_name=f"Chat {datetime.now().strftime('%Y-%m-%d %H:%M')}"
            )
            db.add(session)
            db.commit()
            db.refresh(session)
        
        # Save user message
        user_message = ChatMessage(
            session_id=session.id,
            user_id=current_user.id,
            message_type="user",
            content=prompt,
            prompt=prompt,
            style=style,
            generation_type="text-to-image"
        )
        db.add(user_message)
        db.commit()
        
        # Generate image
        result = await freepik_api.text_to_image(prompt, style)
        
        # Extract image URL from result
        image_url = None
        if result and result.get("data", {}).get("generated"):
            image_url = result["data"]["generated"][0]
        
        # Save assistant message
        assistant_message = ChatMessage(
            session_id=session.id,
            user_id=current_user.id,
            message_type="assistant",
            content="I've created your visual content!",
            prompt=prompt,
            style=style,
            image_url=image_url,
            generation_type="text-to-image"
        )
        db.add(assistant_message)
        
        # Update session timestamp
        session.updated_at = datetime.now()
        db.commit()
        
        return JSONResponse(content={
            "success": True,
            "data": result,
            "prompt": prompt,
            "style": style,
            "user_type": user_type,
            "session_id": session.id
        })
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(e)}
        )

@app.post("/api/generate/image-to-image")
async def generate_image_to_image(
    file: UploadFile = File(...),
    prompt: str = Form(...),
    style: str = Form(default="realistic"),
    user_type: str = Form(default="home"),
    session_id: int = Form(None),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Transform existing image based on prompt"""
    try:
        print(f"🖼️ Image-to-image request: {prompt} ({style})")
        
        # Sessions are optional - only use if provided and valid
        session = None
        if session_id:
            try:
                session = db.query(ChatSession).filter(
                    ChatSession.id == session_id,
                    ChatSession.user_id == current_user.id
                ).first()
                
                if not session:
                    print(f"⚠️ Session {session_id} not found, proceeding without session")
            except Exception as e:
                print(f"⚠️ Session query failed: {e}, proceeding without session")
        
        # Transform image using Freepik Mystic API (with reference_images)
        image_data = await file.read()
        result = await freepik_api.image_to_image(image_data, prompt, style)
        
        # Extract image URL from result
        image_url = None
        if result and result.get("data", {}).get("generated"):
            image_url = result["data"]["generated"][0]
        elif result and result.get("data", {}).get("images"):
            image_url = result["data"]["images"][0]
        
        # Only save to database if we have a session
        if session:
            try:
                # Save user message
                user_message = ChatMessage(
                    session_id=session.id,
                    user_id=current_user.id,
                    message_type="user",
                    content=f"Transform image: {prompt}",
                    prompt=prompt,
                    style=style,
                    generation_type="image-to-image"
                )
                db.add(user_message)
                
                # Save assistant message
                assistant_message = ChatMessage(
                    session_id=session.id,
                    user_id=current_user.id,
                    message_type="assistant",
                    content="I've transformed your image!",
                    prompt=prompt,
                    style=style,
                    image_url=image_url,
                    generation_type="image-to-image"
                )
                db.add(assistant_message)
                
                # Update session timestamp
                session.updated_at = datetime.now()
                db.commit()
                print(f"✅ Saved to session {session.id}")
            except Exception as e:
                print(f"⚠️ Failed to save to session: {e}")
                db.rollback()
        else:
            print(f"ℹ️ No session - transformation completed without saving to database")
        
        return JSONResponse(content={
            "success": True,
            "data": result,
            "prompt": prompt,
            "style": style,
            "user_type": user_type,
            "session_id": session.id if session else None,
            "original_filename": file.filename
        })
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": str(e)}
        )

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "Vizzy Chat"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)