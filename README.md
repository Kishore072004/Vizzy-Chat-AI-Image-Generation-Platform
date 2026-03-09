# 🎨 Vizzy Chat - Visual Content Creation Platform

A conversational AI-powered platform for creating and transforming visual content using advanced AI APIs.

## 🚀 Features Overview

### 🎯 Core Functionality
- **Text-to-Image Generation**: Create images from text descriptions using Freepik API
- **Image-to-Image Transformation**: Transform existing images using Stability AI
- **Conversational Interface**: ChatGPT-style UI for natural interaction
- **Multi-Style Support**: 6 different artistic styles (Realistic, Artistic, Cartoon, Abstract, Vintage, Portrait)
- **Dual User Types**: Home and Business modes with tailored experiences

### 🔐 Authentication System
- **User Registration**: Secure account creation with email validation
- **Login System**: JWT-based authentication with session management
- **Password Security**: Advanced bcrypt hashing with SHA-256 pre-hashing for long passwords
- **Session Management**: Persistent login with token-based authentication

### 🗄️ Database Integration
- **PostgreSQL Backend**: Robust database with connection pooling
- **User Management**: Complete user profiles and preferences
- **Chat History**: Persistent conversation and generation history
- **Session Tracking**: Organized chat sessions with timestamps

### 🎨 AI-Powered Generation

#### Text-to-Image (Freepik API)
- **Multiple Models**: Realism, Fluid, Zen, Flexible, Super Real, Editorial Portraits
- **Style Mapping**: User-friendly style names mapped to API models
- **High Quality**: Professional-grade image generation
- **Fast Processing**: Optimized API calls with polling mechanism

#### Image-to-Image (Stability AI)
- **Advanced Transformation**: Powered by Stable Diffusion XL
- **Style Transfer**: Transform images while maintaining structure
- **Quality Control**: 1024x1024 high-resolution output
- **Flexible Prompting**: Natural language transformation descriptions

### 🖥️ User Interface

#### Modern Design
- **Split Layout**: Chat sidebar (400px) + Large image display area
- **Responsive Design**: Works on desktop and mobile devices
- **Dark/Light Themes**: Professional color scheme
- **Intuitive Controls**: Drag-and-drop file upload, style selectors

#### Interactive Elements
- **File Upload**: Drag-and-drop or click-to-upload functionality
- **Real-time Preview**: Immediate feedback on file selection
- **Download Feature**: One-click download of generated images
- **Loading States**: Visual feedback during AI processing

### 📱 User Experience

#### Home Users
- **Personal Creation**: "Paint how my last year felt", "Renaissance-style artwork"
- **Memory Visualization**: Transform photos into artistic representations
- **Creative Expression**: Vision boards, dream visualization, mood art
- **Simple Interface**: Easy-to-use controls for non-technical users

#### Business Users
- **Marketing Materials**: Professional visuals for campaigns
- **Brand Content**: Consistent brand-themed artwork
- **Product Visuals**: Enhanced product photography and styling
- **Commercial Quality**: High-resolution outputs suitable for print/digital

### 🔧 Technical Architecture

#### Backend (FastAPI)
- **Modern Framework**: FastAPI with automatic API documentation
- **Async Processing**: Non-blocking AI API calls
- **Error Handling**: Comprehensive error management and logging
- **CORS Support**: Cross-origin resource sharing enabled
- **Health Checks**: System monitoring endpoints

#### Database Schema
```sql
Users: id, username, email, full_name, user_type, hashed_password, created_at
ChatSessions: id, user_id, session_name, created_at, updated_at
ChatMessages: id, session_id, user_id, message_type, content, prompt, style, image_url, generation_type, created_at
```

#### API Integration
- **Freepik API**: Text-to-image generation with 6 model types
- **Stability AI**: Image-to-image transformation with Stable Diffusion XL
- **Rate Limiting**: Proper API usage with respect to service limits
- **Error Recovery**: Graceful handling of API failures

### 🛡️ Security Features
- **Input Validation**: Comprehensive data validation using Pydantic schemas
- **SQL Injection Protection**: SQLAlchemy ORM with parameterized queries
- **Password Security**: Bcrypt hashing with salt rounds
- **JWT Tokens**: Secure authentication with expiration
- **File Upload Security**: Type validation and size limits

### 📊 Performance Optimizations
- **Database Pooling**: Efficient connection management
- **Async Operations**: Non-blocking AI API calls
- **Image Optimization**: Efficient base64 encoding/decoding
- **Caching**: Static file serving with proper headers
- **Error Boundaries**: Graceful degradation on failures

## 🗂️ File Structure

```
vizzy_chat/
├── main.py                 # FastAPI application and API routes
├── auth.py                 # Authentication logic and JWT handling
├── database.py             # Database models and connection
├── schemas.py              # Pydantic data validation schemas
├── .env                    # Environment variables and API keys
├── static/
│   ├── script.js          # Frontend JavaScript logic
│   ├── style.css          # UI styling and responsive design
│   ├── auth.js            # Authentication frontend logic
│   └── auth.css           # Authentication page styling
├── templates/
│   ├── index.html         # Main application interface
│   ├── login.html         # Login page
│   └── register.html      # Registration page
└── README.md              # This documentation
```

## 🔑 API Keys Configuration

### Required Services
1. **Freepik API**: Text-to-image generation
   - Key: `FPSXb733db6c5ff17734f65a87daa3b5c570`
   - Usage: Text-to-image with multiple style models

2. **Stability AI**: Image-to-image transformation
   - Key: `sk-xyRbXjVi10Po2f8qfkAf9omP1pV7S8KcTQyP18dkfYUXspEL`
   - Usage: High-quality image transformations

3. **PostgreSQL Database**
   - Host: localhost:5432
   - Database: vizzy_chat
   - Credentials: postgres/1234

## 🚀 Getting Started

### Prerequisites
- Python 3.8+
- PostgreSQL 12+
- Virtual environment (recommended)

### Installation
1. **Clone and setup**:
   ```bash
   git clone <repository>
   cd vizzy_chat
   python -m venv venv
   venv\Scripts\activate  # Windows
   pip install -r requirements.txt
   ```

2. **Database setup**:
   ```bash
   # Create PostgreSQL database 'vizzy_chat'
   # Update .env with your database credentials
   ```

3. **Run application**:
   ```bash
   uvicorn main:app --reload
   ```

4. **Access application**:
   - Main app: `http://127.0.0.1:8000`
   - Login: `http://127.0.0.1:8000/login`
   - Register: `http://127.0.0.1:8000/register`

## 📋 Usage Guide

### Text-to-Image Generation
1. Click "Text to Image" tab
2. Enter descriptive prompt (e.g., "a beautiful sunset over mountains")
3. Select style (Realistic, Artistic, Cartoon, etc.)
4. Click send button
5. Wait for generation (~3-5 seconds)
6. Download or save generated image

### Image-to-Image Transformation
1. Click "Image to Image" tab
2. Upload image (drag-and-drop or click)
3. Enter transformation prompt (e.g., "make it look like a cartoon")
4. Select desired style
5. Click "Transform" button
6. Wait for processing (~2-3 seconds)
7. Download transformed image

## 🎯 Supported Styles

| Style | Description | Best For |
|-------|-------------|----------|
| **Realistic** | Photorealistic images | Portraits, landscapes, products |
| **Artistic** | Painterly, expressive style | Creative artwork, mood pieces |
| **Cartoon** | Animated, stylized look | Fun illustrations, characters |
| **Abstract** | Modern, geometric art | Conceptual designs, backgrounds |
| **Vintage** | Classic, retro aesthetic | Historical themes, nostalgia |
| **Portrait** | Professional portrait style | Headshots, formal images |

## 🔧 Technical Specifications

### Performance Metrics
- **Text-to-Image**: 3-5 seconds average generation time
- **Image-to-Image**: 2-3 seconds average transformation time
- **Image Quality**: Up to 1024x1024 pixels
- **File Formats**: PNG, JPEG input/output
- **Max File Size**: 10MB upload limit

### Browser Compatibility
- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

### System Requirements
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 1GB for application, additional for generated images
- **Network**: Stable internet connection for AI API calls

## 🛠️ Troubleshooting

### Common Issues
1. **"File input not found"**: Refresh page, ensure JavaScript is enabled
2. **Authentication errors**: Clear browser cache, re-login
3. **Image generation fails**: Check API keys, internet connection
4. **Database connection**: Verify PostgreSQL is running, check credentials

### Debug Mode
- Check browser console for detailed error messages
- Server logs show API call status and errors
- Database connection status displayed on startup

## 🔮 Future Enhancements

### Planned Features
- **Video Generation**: Text-to-video and video transformation
- **Batch Processing**: Multiple image generation/transformation
- **Advanced Editing**: In-browser image editing tools
- **Social Sharing**: Direct sharing to social platforms
- **API Access**: RESTful API for third-party integrations
- **Mobile App**: Native iOS/Android applications

### Technical Improvements
- **Caching System**: Redis for improved performance
- **CDN Integration**: Faster image delivery
- **Advanced Analytics**: Usage tracking and insights
- **Multi-language**: Internationalization support

## 📄 License

This project is proprietary software. All rights reserved.

## 🤝 Support

For technical support or feature requests, please contact the development team.

---

**Vizzy Chat** - Transforming ideas into visual reality through conversational AI.#   V i z z y - C h a t - A I - I m a g e - G e n e r a t i o n - P l a t f o r m  
 