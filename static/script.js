class VizzyChat {
    constructor() {
        this.currentUserType = 'home';
        this.currentTab = 'text-to-image';
        this.currentSessionId = null;
        this.user = null;
        this.init();
    }

    init() {
        // Check authentication
        if (!this.checkAuth()) {
            return;
        }

        // Update user info in header
        this.updateUserInfo();

        this.bindEvents();
        this.updateUIForUserType();
        // Disable automatic session loading to prevent auth errors
        // this.loadOrCreateSession();
    }

    updateUserInfo() {
        const userNameElement = document.getElementById('userName');
        if (userNameElement && this.user) {
            userNameElement.textContent = this.user.full_name || this.user.username;
        }
    }

    checkAuth() {
        const token = localStorage.getItem('access_token');
        const user = localStorage.getItem('user');

        if (!token || !user) {
            // Redirect to login - authentication is required for PostgreSQL setup
            window.location.href = '/login';
            return false;
        }

        this.user = JSON.parse(user);
        this.currentUserType = this.user.user_type;
        return true;
    }

    async loadOrCreateSession() {
        try {
            // Try to get existing sessions
            const sessions = await this.getChatSessions();

            if (sessions.length > 0) {
                // Load the most recent session
                this.currentSessionId = sessions[0].id;
                await this.loadChatHistory(this.currentSessionId);
            } else {
                // Create a new session
                const session = await this.createChatSession();
                this.currentSessionId = session.id;
            }
        } catch (error) {
            console.error('Error loading session:', error);
            // Create a new session as fallback
            try {
                const session = await this.createChatSession();
                this.currentSessionId = session.id;
            } catch (createError) {
                console.error('Error creating session:', createError);
                this.showError('Failed to initialize chat session');
            }
        }
    }

    async getChatSessions() {
        const token = localStorage.getItem('access_token');
        const response = await fetch('/api/chat/sessions', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to get chat sessions');
        }

        return await response.json();
    }

    async createChatSession() {
        const token = localStorage.getItem('access_token');
        const response = await fetch('/api/chat/sessions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                session_name: `Chat ${new Date().toLocaleString()}`
            })
        });

        if (!response.ok) {
            throw new Error('Failed to create chat session');
        }

        return await response.json();
    }

    async loadChatHistory(sessionId) {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`/api/chat/sessions/${sessionId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load chat history');
        }

        const session = await response.json();
        this.displayChatHistory(session.messages);
    }

    displayChatHistory(messages) {
        const chatContainer = document.getElementById('chatContainer');

        // Clear welcome message
        const welcomeMessage = chatContainer.querySelector('.welcome-message');
        if (welcomeMessage) {
            welcomeMessage.style.display = 'none';
        }

        // Display messages
        messages.forEach(message => {
            if (message.message_type === 'user') {
                this.addUserMessageToUI(message.content, message.generation_type === 'image-to-image');
            } else {
                this.addAssistantMessageToUI({
                    prompt: message.prompt,
                    style: message.style,
                    data: {
                        data: {
                            generated: message.image_url ? [message.image_url] : null
                        }
                    }
                }, message.image_url);
            }
        });
    }

    addUserMessageToUI(text, hasFile = false) {
        const chatContainer = document.getElementById('chatContainer');

        const messageDiv = document.createElement('div');
        messageDiv.className = 'message user';

        messageDiv.innerHTML = `
            <div class="message-avatar">
                <i class="fas fa-user"></i>
            </div>
            <div class="message-content">
                <p>${text}</p>
            </div>
        `;

        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    addAssistantMessageToUI(result, imageUrl = null) {
        const chatContainer = document.getElementById('chatContainer');

        const messageDiv = document.createElement('div');
        messageDiv.className = 'message assistant';

        const isTransformation = result.original_filename !== undefined;
        const actionText = isTransformation ? 'transformed your image' : 'created your visual content';

        messageDiv.innerHTML = `
            <div class="message-avatar">
                <i class="fas fa-palette"></i>
            </div>
            <div class="message-content">
                <p>I've ${actionText}!</p>
                <p style="font-size: 0.8rem; color: #666; margin-top: 0.5rem;">
                    "${result.prompt}"${result.style ? ` • ${result.style} style` : ''}
                </p>
            </div>
        `;

        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;

        // Display image in the large image area
        if (imageUrl) {
            result.data = { data: { generated: [imageUrl] } };
        }
        this.displayImageInLargeArea(result);
    }

    bindEvents() {
        // User type toggle
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchUserType(e.target.dataset.type);
            });
        });

        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Example prompts
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('example-prompt')) {
                this.useExamplePrompt(e.target.textContent);
            }
        });

        // Form submissions
        document.getElementById('textToImageForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleTextToImage();
        });

        document.getElementById('imageToImageForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleImageToImage();
        });

        // File upload
        this.setupFileUpload();

        // Enter key handling
        document.getElementById('promptInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleTextToImage();
            }
        });

        document.getElementById('transformPrompt').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleImageToImage();
            }
        });
    }

    switchUserType(type) {
        this.currentUserType = type;

        // Update toggle buttons
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === type);
        });

        this.updateUIForUserType();
    }

    updateUIForUserType() {
        const isHome = this.currentUserType === 'home';

        // Update welcome text
        document.querySelector('.home-text').style.display = isHome ? 'block' : 'none';
        document.querySelector('.business-text').style.display = isHome ? 'none' : 'block';

        // Update example prompts
        document.querySelector('.home-examples').style.display = isHome ? 'flex' : 'none';
        document.querySelector('.business-examples').style.display = isHome ? 'none' : 'flex';
    }

    switchTab(tab) {
        this.currentTab = tab;

        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });

        // Show/hide forms
        document.getElementById('textToImageForm').style.display =
            tab === 'text-to-image' ? 'block' : 'none';
        document.getElementById('imageToImageForm').style.display =
            tab === 'image-to-image' ? 'block' : 'none';
    }

    useExamplePrompt(prompt) {
        const cleanPrompt = prompt.replace(/"/g, '');
        if (this.currentTab === 'text-to-image') {
            document.getElementById('promptInput').value = cleanPrompt;
            document.getElementById('promptInput').focus();
        } else {
            document.getElementById('transformPrompt').value = cleanPrompt;
            document.getElementById('transformPrompt').focus();
        }
    }

    setupFileUpload() {
        const uploadArea = document.getElementById('fileUploadArea');
        const fileInput = document.getElementById('imageInput');

        uploadArea.addEventListener('click', () => fileInput.click());

        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');

            const files = e.dataTransfer.files;
            if (files.length > 0) {
                fileInput.files = files;
                this.updateFileUploadUI(files[0]);
            }
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.updateFileUploadUI(e.target.files[0]);
            }
        });
    }

    updateFileUploadUI(file) {
        const uploadArea = document.getElementById('fileUploadArea');
        const fileInput = document.getElementById('imageInput');

        // Detach the input first so innerHTML change doesn't destroy it
        if (fileInput && fileInput.parentNode === uploadArea) {
            uploadArea.removeChild(fileInput);
        }

        uploadArea.innerHTML = `
            <i class="fas fa-check-circle" style="color: #10b981;"></i>
            <p style="color: #10b981; font-weight: 600;">${file.name}</p>
            <p style="font-size: 0.8rem; color: #6b7280;">Click to change</p>
        `;

        // Re-attach the input so it remains in the DOM
        if (fileInput) {
            uploadArea.appendChild(fileInput);
        }
    }

    async handleTextToImage() {
        const prompt = document.getElementById('promptInput').value.trim();
        const style = document.getElementById('styleSelect').value;

        if (!prompt) {
            this.showError('Please enter a prompt');
            return;
        }

        this.showLoading();
        this.addUserMessage(prompt);

        try {
            const token = localStorage.getItem('access_token');
            const formData = new FormData();
            formData.append('prompt', prompt);
            formData.append('style', style);
            formData.append('user_type', this.currentUserType);

            // Session ID is optional - don't send if we don't have one
            // if (this.currentSessionId) {
            //     formData.append('session_id', this.currentSessionId);
            // }

            const headers = {};
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const response = await fetch('/api/generate/text-to-image', {
                method: 'POST',
                headers: headers,
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                this.addAssistantMessage(result);
                document.getElementById('promptInput').value = '';
            } else {
                this.showError(result.error || 'Failed to generate image');
            }
        } catch (error) {
            this.showError('Network error: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    async handleImageToImage() {
        try {
            // Ensure we're on the image-to-image tab
            if (this.currentTab !== 'image-to-image') {
                this.switchTab('image-to-image');
                // Wait for DOM to update
                await new Promise(resolve => setTimeout(resolve, 300));
            }

            // Use a more robust element selection approach
            const fileInput = document.querySelector('#imageInput') ||
                document.querySelector('input[type="file"]') ||
                document.querySelector('#imageToImageForm input[type="file"]');

            const promptElement = document.querySelector('#transformPrompt') ||
                document.querySelector('#imageToImageForm textarea');

            const styleElement = document.querySelector('#transformStyleSelect') ||
                document.querySelector('#imageToImageForm select');

            // Detailed error reporting
            if (!fileInput) {
                console.error('File input element not found. Available elements:');
                console.log('All inputs:', document.querySelectorAll('input'));
                console.log('File inputs:', document.querySelectorAll('input[type="file"]'));
                console.log('Image form:', document.querySelector('#imageToImageForm'));
                this.showError('File input not found. Please refresh the page and try again.');
                return;
            }

            if (!promptElement) {
                console.error('Prompt element not found. Available textareas:', document.querySelectorAll('textarea'));
                this.showError('Prompt input not found. Please refresh the page and try again.');
                return;
            }

            if (!styleElement) {
                console.error('Style element not found. Available selects:', document.querySelectorAll('select'));
                this.showError('Style selector not found. Please refresh the page and try again.');
                return;
            }

            const prompt = promptElement.value.trim();
            const style = styleElement.value;

            if (!fileInput.files || !fileInput.files.length) {
                this.showError('Please select an image first');
                return;
            }

            if (!prompt) {
                this.showError('Please enter a transformation prompt');
                return;
            }

            this.showLoading();
            this.addUserMessage(`Transform image: ${prompt}`, fileInput.files[0]);

            const token = localStorage.getItem('access_token');
            if (!token) {
                this.showError('Please log in to use image transformation');
                return;
            }

            const formData = new FormData();
            formData.append('file', fileInput.files[0]);
            formData.append('prompt', prompt);
            formData.append('style', style);
            formData.append('user_type', this.currentUserType);

            // Session ID is optional - don't send if we don't have one
            // if (this.currentSessionId) {
            //     formData.append('session_id', this.currentSessionId);
            // }

            const response = await fetch('/api/generate/image-to-image', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            const result = await response.json();

            if (response.ok && result.success) {
                this.addAssistantMessage(result);
                promptElement.value = '';
                this.resetFileUpload();
            } else {
                const errorMsg = result.error || result.detail || 'Failed to transform image';
                this.showError(errorMsg);
            }
        } catch (error) {
            console.error('Transform error:', error);
            this.showError('Network error: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    addUserMessage(text, file = null) {
        const chatContainer = document.getElementById('chatContainer');

        // Hide welcome message
        const welcomeMessage = chatContainer.querySelector('.welcome-message');
        if (welcomeMessage) {
            welcomeMessage.style.display = 'none';
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = 'message user';

        let filePreview = '';
        if (file) {
            const fileURL = URL.createObjectURL(file);
            filePreview = `<img src="${fileURL}" alt="Uploaded image" style="max-width: 200px; border-radius: 10px; margin-bottom: 0.5rem;">`;
        }

        messageDiv.innerHTML = `
            <div class="message-avatar">
                <i class="fas fa-user"></i>
            </div>
            <div class="message-content">
                ${filePreview}
                <p>${text}</p>
            </div>
        `;

        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    addAssistantMessage(result) {
        const chatContainer = document.getElementById('chatContainer');

        const messageDiv = document.createElement('div');
        messageDiv.className = 'message assistant';

        // Determine if this is a transformation or generation
        const isTransformation = result.original_filename !== undefined;
        const actionText = isTransformation ? 'transformed your image' : 'created your visual content';

        // Add text message to chat
        messageDiv.innerHTML = `
            <div class="message-avatar">
                <i class="fas fa-palette"></i>
            </div>
            <div class="message-content">
                <p>I've ${actionText}!</p>
                <p style="font-size: 0.8rem; color: #666; margin-top: 0.5rem;">
                    "${result.prompt}"${result.style ? ` • ${result.style} style` : ''}
                </p>
            </div>
        `;

        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;

        // Display image in the large image area
        this.displayImageInLargeArea(result);
    }

    displayImageInLargeArea(result) {
        const imageDisplayContent = document.getElementById('imageDisplayContent');

        // Resolve image URL
        let imageUrl = null;
        let generationType = result.original_filename !== undefined ? 'Transformed' : 'Generated';

        if (result.data && result.data.data) {
            if (result.data.data.generated && result.data.data.generated.length > 0) {
                imageUrl = result.data.data.generated[0];
            } else if (result.data.data.images && result.data.data.images.length > 0) {
                imageUrl = result.data.data.images[0];
                generationType = 'Transformed';
            } else if (result.data.data.image_url) {
                imageUrl = result.data.data.image_url;
                generationType = 'Transformed';
            }
        }

        if (!imageUrl) return;

        // Remove placeholder
        const placeholder = imageDisplayContent.querySelector('.image-placeholder');
        if (placeholder) placeholder.remove();

        // Build gallery card (NO inline onclick — avoids special char issues)
        const card = document.createElement('div');
        card.className = 'gallery-card';
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const promptText = result.prompt || '';

        card.innerHTML = `
            <div class="gallery-card-img-wrap">
                <img src="${imageUrl}" alt="${generationType} image" loading="lazy">
            </div>
            <div class="gallery-card-meta">
                <div class="gallery-card-info">
                    <div class="gallery-card-type">${generationType}</div>
                    <div class="gallery-card-prompt" title="${promptText.replace(/"/g, '&quot;')}">${promptText}</div>
                    <div class="gallery-card-style">${result.style || 'Default'} style</div>
                </div>
                <div class="gallery-card-time">${timeStr}</div>
            </div>
            <div class="gallery-card-actions">
                <button class="download-btn">
                    <i class="fas fa-download"></i> Download
                </button>
            </div>
        `;

        // Attach click-to-expand on image
        const imgEl = card.querySelector('img');
        imgEl.addEventListener('click', () => this.openLightbox(imageUrl));

        // Attach download listener directly (no inline onclick, works with any URL)
        const dlBtn = card.querySelector('.download-btn');
        dlBtn.addEventListener('click', () => this.downloadImage(imageUrl, promptText));

        // Prepend newest card
        imageDisplayContent.insertBefore(card, imageDisplayContent.firstChild);

        // Update count badge
        const total = imageDisplayContent.querySelectorAll('.gallery-card').length;
        const countEl = document.getElementById('galleryCount');
        if (countEl) countEl.textContent = `${total} image${total !== 1 ? 's' : ''}`;

        // Scroll to top to show newest
        imageDisplayContent.scrollTop = 0;
    }

    openLightbox(src) {
        const lb = document.createElement('div');
        lb.className = 'lightbox';
        lb.innerHTML = `
            <button class="lightbox-close" title="Close">&times;</button>
            <img src="${src}" alt="Full size image">
        `;
        const close = () => lb.remove();
        lb.addEventListener('click', close);
        lb.querySelector('.lightbox-close').addEventListener('click', e => { e.stopPropagation(); close(); });
        document.addEventListener('keydown', function esc(e) {
            if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
        });
        document.body.appendChild(lb);
    }

    async downloadImage(imageUrl, prompt) {
        try {
            // Show loading state
            const downloadBtn = document.querySelector('.download-btn');
            const originalContent = downloadBtn.innerHTML;
            downloadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Downloading...';
            downloadBtn.disabled = true;

            // Fetch the image
            const response = await fetch(imageUrl);
            const blob = await response.blob();

            // Create download link
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;

            // Generate filename from prompt (clean it up)
            const cleanPrompt = prompt.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').substring(0, 50);
            const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
            a.download = `vizzy_${cleanPrompt}_${timestamp}.jpg`;

            // Trigger download
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            // Reset button
            downloadBtn.innerHTML = originalContent;
            downloadBtn.disabled = false;

        } catch (error) {
            console.error('Download failed:', error);

            // Reset button and show error
            const downloadBtn = document.querySelector('.download-btn');
            downloadBtn.innerHTML = '<i class="fas fa-download"></i> Download Image';
            downloadBtn.disabled = false;

            this.showError('Failed to download image. Please try again.');
        }
    }

    resetFileUpload() {
        const uploadArea = document.getElementById('fileUploadArea');
        const fileInput = document.getElementById('imageInput');

        // Detach input before clearing innerHTML
        if (fileInput && fileInput.parentNode === uploadArea) {
            uploadArea.removeChild(fileInput);
        }

        fileInput.value = '';
        uploadArea.innerHTML = `
            <i class="fas fa-cloud-upload-alt"></i>
            <p>Drop an image here or click to upload</p>
        `;

        // Re-attach the input
        if (fileInput) {
            uploadArea.appendChild(fileInput);
        }
    }

    showLoading() {
        document.getElementById('loadingOverlay').style.display = 'flex';
    }

    hideLoading() {
        document.getElementById('loadingOverlay').style.display = 'none';
    }

    showError(message) {
        // Create a more user-friendly error display
        const chatContainer = document.getElementById('chatContainer');

        const errorDiv = document.createElement('div');
        errorDiv.className = 'message assistant';
        errorDiv.innerHTML = `
            <div class="message-avatar" style="background: linear-gradient(135deg, #ef4444, #dc2626);">
                <i class="fas fa-exclamation-triangle"></i>
            </div>
            <div class="message-content" style="background: #fef2f2; border: 1px solid #fecaca; color: #dc2626;">
                <p><strong>Oops! Something went wrong:</strong></p>
                <p style="font-size: 0.9rem; margin-top: 0.5rem;">${message}</p>
                <p style="font-size: 0.8rem; margin-top: 0.5rem; color: #991b1b;">
                    Please try again or contact support if the issue persists.
                </p>
            </div>
        `;

        chatContainer.appendChild(errorDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
}

// Auth Manager for main app
class AuthManager {
    static getToken() {
        return localStorage.getItem('access_token');
    }

    static getUser() {
        const user = localStorage.getItem('user');
        return user ? JSON.parse(user) : null;
    }

    static logout() {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user');
        window.location.href = '/login';
    }

    static isAuthenticated() {
        return !!localStorage.getItem('access_token');
    }
}

// Debug function to check element availability
window.debugElements = function () {
    console.log('🔍 Debug: Checking element availability...');

    const elements = {
        'imageInput': document.getElementById('imageInput'),
        'transformPrompt': document.getElementById('transformPrompt'),
        'transformStyleSelect': document.getElementById('transformStyleSelect'),
        'imageToImageForm': document.getElementById('imageToImageForm'),
        'textToImageForm': document.getElementById('textToImageForm')
    };

    Object.entries(elements).forEach(([name, element]) => {
        console.log(`${name}:`, element ? '✅ Found' : '❌ Not found');
        if (element) {
            console.log(`  - Tag: ${element.tagName}`);
            console.log(`  - ID: ${element.id}`);
            console.log(`  - Classes: ${element.className}`);
            console.log(`  - Visible: ${element.offsetParent !== null}`);
        }
    });

    console.log('\n🔍 All file inputs:', document.querySelectorAll('input[type="file"]'));
    console.log('🔍 All textareas:', document.querySelectorAll('textarea'));
    console.log('🔍 All selects:', document.querySelectorAll('select'));

    return elements;
};

// Fix missing elements function
window.fixMissingElements = function () {
    console.log('🔧 Attempting to fix missing elements...');

    const imageToImageForm = document.getElementById('imageToImageForm');
    if (!imageToImageForm) {
        console.error('❌ imageToImageForm not found - cannot fix elements');
        return false;
    }

    console.log('📋 Form found:', imageToImageForm);
    console.log('📋 Form HTML:', imageToImageForm.innerHTML);

    // Check and create missing imageInput
    let imageInput = document.getElementById('imageInput');
    if (!imageInput) {
        console.log('🔧 Creating missing imageInput...');
        const fileUploadArea = document.getElementById('fileUploadArea');
        if (fileUploadArea) {
            imageInput = document.createElement('input');
            imageInput.type = 'file';
            imageInput.id = 'imageInput';
            imageInput.accept = 'image/*';
            imageInput.hidden = true;
            fileUploadArea.appendChild(imageInput);
            console.log('✅ Created imageInput:', imageInput);

            // Set up file input event listener
            imageInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0 && window.vizzyChat) {
                    window.vizzyChat.updateFileUploadUI(e.target.files[0]);
                }
            });
        } else {
            console.error('❌ fileUploadArea not found');
        }
    } else {
        console.log('✅ imageInput already exists');
    }

    // Check and create missing transformPrompt
    let transformPrompt = document.getElementById('transformPrompt');
    if (!transformPrompt) {
        console.log('🔧 Creating missing transformPrompt...');
        transformPrompt = document.createElement('textarea');
        transformPrompt.id = 'transformPrompt';
        transformPrompt.placeholder = 'How would you like to transform this image?';
        transformPrompt.rows = 2;

        const inputContainer = imageToImageForm.querySelector('.input-container');
        if (inputContainer) {
            // Insert after fileUploadArea
            const fileUploadArea = document.getElementById('fileUploadArea');
            if (fileUploadArea && fileUploadArea.nextSibling) {
                inputContainer.insertBefore(transformPrompt, fileUploadArea.nextSibling);
            } else {
                inputContainer.appendChild(transformPrompt);
            }
            console.log('✅ Created transformPrompt:', transformPrompt);
        } else {
            console.error('❌ input-container not found');
        }
    } else {
        console.log('✅ transformPrompt already exists');
    }

    // Check and create missing transformStyleSelect
    let transformStyleSelect = document.getElementById('transformStyleSelect');
    if (!transformStyleSelect) {
        console.log('🔧 Creating missing transformStyleSelect...');
        transformStyleSelect = document.createElement('select');
        transformStyleSelect.id = 'transformStyleSelect';

        const options = [
            { value: 'realistic', text: 'Realistic' },
            { value: 'artistic', text: 'Artistic' },
            { value: 'cartoon', text: 'Cartoon' },
            { value: 'abstract', text: 'Abstract' },
            { value: 'vintage', text: 'Vintage' },
            { value: 'portrait', text: 'Portrait' }
        ];

        options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.text;
            transformStyleSelect.appendChild(option);
        });

        const inputControls = imageToImageForm.querySelector('.input-controls');
        if (inputControls) {
            inputControls.insertBefore(transformStyleSelect, inputControls.firstChild);
            console.log('✅ Created transformStyleSelect:', transformStyleSelect);
        } else {
            console.error('❌ input-controls not found');
        }
    } else {
        console.log('✅ transformStyleSelect already exists');
    }

    console.log('🔧 Fix attempt completed');

    // Verify all elements now exist
    const finalCheck = {
        imageInput: document.getElementById('imageInput'),
        transformPrompt: document.getElementById('transformPrompt'),
        transformStyleSelect: document.getElementById('transformStyleSelect')
    };

    console.log('🔍 Final element check:', finalCheck);

    return Object.values(finalCheck).every(el => el !== null);
};

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Wait for everything to be fully loaded
    setTimeout(() => {
        // Verify critical elements exist before initializing
        const requiredElements = [
            '#imageInput',
            '#transformPrompt',
            '#transformStyleSelect',
            '#imageToImageForm',
            '#textToImageForm'
        ];

        let allElementsFound = true;
        const missingElements = [];

        requiredElements.forEach(selector => {
            const element = document.querySelector(selector);
            if (!element) {
                console.error(`Required element not found: ${selector}`);
                allElementsFound = false;
                missingElements.push(selector);
            }
        });

        if (!allElementsFound) {
            console.log('❌ Missing elements:', missingElements);
            console.log('🔧 Attempting to fix missing elements...');

            // Try to fix missing elements
            if (window.fixMissingElements) {
                window.fixMissingElements();

                // Check again after fix attempt
                setTimeout(() => {
                    const stillMissing = [];
                    requiredElements.forEach(selector => {
                        if (!document.querySelector(selector)) {
                            stillMissing.push(selector);
                        }
                    });

                    if (stillMissing.length === 0) {
                        console.log('✅ All elements fixed, initializing VizzyChat...');
                        window.vizzyChat = new VizzyChat();
                    } else {
                        console.log('❌ Still missing elements after fix:', stillMissing);
                        console.log('🔄 Initializing anyway...');
                        window.vizzyChat = new VizzyChat();
                    }
                }, 200);
            } else {
                console.log('🔄 Fix function not available, initializing anyway...');
                window.vizzyChat = new VizzyChat();
            }
        } else {
            console.log('✅ All required elements found, initializing VizzyChat...');
            window.vizzyChat = new VizzyChat();
        }
    }, 500);
});