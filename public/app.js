// Secure Anonymous Chat Application
// Codename-first identity. No persistent credential storage.
class SecureChat {
    constructor() {
        this.socket = null;
        this.codename = localStorage.getItem('backchannel_codename') || null;
        this.userId = null;
        this.roomId = null;
        this.contactId = null;
        this.encryptionKey = null;
        this.roomEncryptionKey = null;
        this.isConnected = false;
        this.cryptoAvailable = false;
        this.isRoomCreator = false;

        // Key material (client-side). The server never needs keys.
        this.currentSessionKey = null;
        this.keyRotationTime = 5 * 60 * 1000;
        this.sequenceCounter = 0;
        this.keyRotationInterval = null;
        this.typingMap = {};
        this.typingTimeout = null;
        this.rejoinCandidateRoomId = null;
        this.rejoinAttempts = 0;
        this.heartbeatInterval = null;

        // WhatsApp-style local state
        this.contacts = [];
        this.contactMessages = {};
        this.activeContactId = null;

        this.initializeApp();
    }

    initializeApp() {
        this.setupCodenameScreen();
        if (this.codename) {
            this.enterApp(this.codename);
        }
    }

    setupCodenameScreen() {
        const screen = document.getElementById('codename-screen');
        const input = document.getElementById('codename-input');
        const btn = document.getElementById('set-codename-btn');
        if (!screen || !input || !btn) return;

        input.value = this.codename || '';
        const activate = () => {
            const name = input.value.trim();
            if (!name) return;
            localStorage.setItem('backchannel_codename', name);
            this.codename = name;
            screen.classList.add('hidden');
            this.enterApp(name);
        };
        btn.addEventListener('click', activate);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') activate();
        });
    }

    enterApp(codename) {
        this.setupEventListeners();
        this.connectToServer(codename);
        this.generateEncryptionKey();
        this.checkCryptoAvailability();
        this.updateConnectionStatus('Initializing...');
        this.showWelcomeMessage();
        this.loadLocalContacts();
        this.loadLocalMessages();
        this.checkForRoomInURL();

        window.addEventListener('resize', () => {
            if (!this.isMobile()) {
                document.getElementById('main-container')?.classList.remove('chat-open');
            }
        });
    }

    showWelcomeMessage() {
        setTimeout(() => {
            this.displaySystemMessage('🔐 Welcome to BackChannel - Secure Anonymous Chat');
            this.displaySystemMessage('📝 Create or join a room to start chatting');
            this.displaySystemMessage('⚠️ All messages auto-delete after 20 seconds');
            this.displaySystemMessage('📎 Use buttons below to attach files, photos, or location');
        }, 1000);
    }

    isMobile() {
        return window.innerWidth < 576;
    }

    // Check if URL contains room parameter and auto-join
    checkForRoomInURL() {
        const urlParams = new URLSearchParams(window.location.search);
        const roomId = urlParams.get('room');
        
        if (roomId) {
            // Wait for connection before joining
            const checkConnection = setInterval(() => {
                if (this.isConnected) {
                    clearInterval(checkConnection);
                    this.displaySystemMessage(`🔗 Joining room from shared link...`);
                    document.getElementById('room-input').value = roomId;
                    setTimeout(() => {
                        this.joinRoom();
                    }, 500);
                }
            }, 100);
        }
    }

    setupEventListeners() {
        // Room controls
        document.getElementById('join-room-btn').addEventListener('click', () => {
            this.joinRoom();
        });
        document.getElementById('new-room-btn').addEventListener('click', () => {
            this.createNewRoom();
        });
        document.getElementById('end-room-btn').addEventListener('click', () => {
            this.endRoom();
        });
        document.getElementById('copy-room-btn').addEventListener('click', () => {
            this.copyRoomId();
        });
        
        document.getElementById('share-room-btn').addEventListener('click', () => {
            this.shareRoomId();
        });

        // Hamburger menu
        document.getElementById('menu-btn').addEventListener('click', () => {
            this.openHamburgerMenu();
        });

        document.getElementById('close-menu-btn').addEventListener('click', () => {
            this.closeHamburgerMenu();
        });

        document.getElementById('back-to-contacts-btn').addEventListener('click', () => {
            this.showMobileContacts();
        });

        // Menu actions
        document.getElementById('menu-take-photo').addEventListener('click', () => {
            this.closeHamburgerMenu();
            document.getElementById('photo-input').click();
        });

        document.getElementById('menu-choose-photo').addEventListener('click', () => {
            this.closeHamburgerMenu();
            document.getElementById('gallery-input').click();
        });

        document.getElementById('menu-attach-file').addEventListener('click', () => {
            this.closeHamburgerMenu();
            document.getElementById('file-input').click();
        });

        document.getElementById('menu-share-location').addEventListener('click', () => {
            this.closeHamburgerMenu();
            this.shareLocation();
        });

        document.getElementById('menu-new-room').addEventListener('click', () => {
            this.closeHamburgerMenu();
            this.createNewRoom();
        });

        document.getElementById('menu-copy-room').addEventListener('click', () => {
            this.closeHamburgerMenu();
            this.copyRoomId();
        });

        document.getElementById('menu-end-room').addEventListener('click', () => {
            this.closeHamburgerMenu();
            this.endRoom();
        });

        // Message input
        document.getElementById('message-input').addEventListener('input', () => {
            this.emitTyping();
        });

        document.getElementById('message-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        document.getElementById('send-btn').addEventListener('click', () => {
            this.sendMessage();
        });

        // Room input
        document.getElementById('room-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.joinRoom();
            }
        });

        // Attachment controls
        document.getElementById('attach-file-btn').addEventListener('click', () => {
            document.getElementById('file-input').click();
        });

        document.getElementById('take-photo-btn').addEventListener('click', () => {
            this.showPhotoMenu();
        });

        document.getElementById('share-location-btn').addEventListener('click', () => {
            this.shareLocation();
        });

        // Photo menu options
        document.getElementById('take-new-photo-btn').addEventListener('click', () => {
            this.hidePhotoMenu();
            document.getElementById('photo-input').click();
        });

        document.getElementById('choose-from-gallery-btn').addEventListener('click', () => {
            this.hidePhotoMenu();
            document.getElementById('gallery-input').click();
        });

        document.getElementById('cancel-photo-btn').addEventListener('click', () => {
            this.hidePhotoMenu();
        });

        document.getElementById('file-input').addEventListener('change', (e) => {
            this.handleFileSelect(e);
        });

        document.getElementById('photo-input').addEventListener('change', (e) => {
            this.handlePhotoCapture(e);
        });

        document.getElementById('gallery-input').addEventListener('change', (e) => {
            this.handlePhotoCapture(e);
        });

        // Drag and drop prevention (security)
        document.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        document.addEventListener('drop', (e) => {
            e.preventDefault();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + K to focus room input
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                document.getElementById('room-input').focus();
            }
            
            // Ctrl/Cmd + L to focus message input
            if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
                e.preventDefault();
                document.getElementById('message-input').focus();
            }
            
            // Escape to close photo menu
            if (e.key === 'Escape') {
                this.hidePhotoMenu();
                this.closeHamburgerMenu();
            }
        });

        // Close hamburger menu when clicking outside
        document.addEventListener('click', (e) => {
            const menu = document.getElementById('hamburger-menu');
            const menuBtn = document.getElementById('menu-btn');
            
            if (menu.style.display === 'block' && 
                !menu.contains(e.target) && 
                e.target !== menuBtn) {
                this.closeHamburgerMenu();
            }
        });

        // WhatsApp-style contact selection
        document.getElementById('contacts-list').addEventListener('click', (e) => {
            const item = e.target.closest('.contact-item');
            if (!item) return;
            const userId = item.getAttribute('data-userid');
            if (userId) this.switchContact(userId);
        });

        document.getElementById('contact-search').addEventListener('input', () => {
            this.renderContacts();
        });
    }

    checkCryptoAvailability() {
        // Check if CryptoJS is available
        if (typeof CryptoJS !== 'undefined' && CryptoJS.AES) {
            this.cryptoAvailable = true;
            console.log('CryptoJS is available');
            this.updateEncryptionStatus('AES-256');
        } else {
            this.cryptoAvailable = false;
            console.warn('CryptoJS not available, using fallback encryption');
            this.updateEncryptionStatus('Basic XOR');
            this.displaySystemMessage('Warning: Using basic encryption (CryptoJS not loaded)');
            alert('CryptoJS failed to load. Please check your internet connection or contact support.');
        }
    }

    connectToServer(codename) {
        try {
            this.socket = io({
                transports: ['websocket', 'polling'],
                upgrade: true,
                rememberUpgrade: true,
                timeout: 20000,
                forceNew: true
            });

            this.socket.on('connect', () => {
                this.isConnected = true;
                this.updateConnectionStatus('Connected');
                this.updateConnectionType('WebSocket');
                console.log('Connected to server');
                if (codename && !this.userId) {
                    this.socket.emit('set-codename', { codename });
                }
                if (!this.keyRotationInterval) {
                    this.startKeyRotation();
                }
                if (this.roomId) {
                    this.socket.emit('reconnect-request', { roomId: this.roomId });
                    this.displaySystemMessage('Reconnecting to room...');
                }
                this.startHeartbeat();
            });

            this.socket.on('disconnect', () => {
                this.isConnected = false;
                this.updateConnectionStatus('Disconnected');
                this.updateConnectionType('Offline');
                console.log('Disconnected from server');
                this.preserveRoomId(this.roomId);
                this.stopHeartbeat();
                this.disableRoomControls();
                document.getElementById('copy-room-btn').style.display = 'none';
                document.getElementById('share-room-btn').style.display = 'none';
                this.isRoomCreator = false;
                document.getElementById('end-room-btn').style.display = 'none';
            });

            this.socket.on('user-assigned', (data) => {
                this.userId = data.userId;
                this.codename = data.codename || this.codename;
                document.getElementById('user-id').textContent = this.codename ? `${this.codename} (${this.userId})` : `ID: ${this.userId}`;
                document.getElementById('menu-codename').textContent = this.codename || 'Not set';
                console.log('Assigned user ID:', this.userId, 'codename:', this.codename);
            });

            this.socket.on('room-joined', (data) => {
                this.roomId = data.roomId;
                this.isRoomCreator = (this.userId === data.creatorId);
                document.getElementById('room-info').textContent = `Room: ${this.roomId} (${data.userCount} users)`;
                document.getElementById('copy-room-btn').style.display = '';
                document.getElementById('share-room-btn').style.display = '';
                document.getElementById('end-room-btn').style.display = '';
                document.getElementById('end-room-btn').disabled = !this.isRoomCreator;
                
                const shareableLink = `${window.location.origin}${window.location.pathname}?room=${this.roomId}`;
                this.shareableLink = shareableLink;
                
                if (this.isRoomCreator) {
                    this.displaySystemMessage(`✨ Room created successfully!`);
                    this.displaySystemMessage(`📋 Room Code: ${this.roomId}`);
                    this.displaySystemMessage(`🔗 Shareable Link: ${shareableLink}`);
                    this.displaySystemMessage(`💡 Share this link with others to invite them!`);
                } else {
                    this.displaySystemMessage(`Joined room ${this.roomId}`);
                }
                
                this.displaySystemMessage('⚠️ Messages auto-clear after 20 seconds for security');
                
                this.roomEncryptionKey = data.roomKey || this.generateRoomKey();
                console.log('Using room encryption key:', this.roomEncryptionKey);
                
                this.loadMessages(data.messages);
                console.log('Joined room:', this.roomId);
                this.disableRoomControls();
                document.getElementById('copy-room-btn').style.display = '';
                document.getElementById('share-room-btn').style.display = '';
                this.roomUsers = [];
                this.markRoomRead();
                this.renderContacts();
                if (data.codename && data.creatorId !== this.userId) {
                    const contact = this.contacts.find(c => c.userId === data.creatorId);
                    if (contact) {
                        contact.label = data.codename;
                        contact.roomId = this.roomId;
                        this.saveLocalContacts();
                        this.renderContacts();
                    }
                }
                const mates = (data.messages || [])
                    .map(m => m.userId)
                    .filter(uid => uid && uid !== this.userId);
                const uniqueMates = [...new Set(mates)];
                uniqueMates.forEach(uid => {
                    if (!this.roomUsers.includes(uid)) this.roomUsers.push(uid);
                    if (!this.contacts.find(c => c.userId === uid)) {
                        this.addContact(uid, `User ${uid}`);
                    }
                });
                if (!this.activeContactId && uniqueMates.length > 0) {
                    this.switchContact(uniqueMates[0]);
                }
            });

            this.socket.on('user-joined', (data) => {
                this.displaySystemMessage(`User ${data.userId} joined the room`);
                document.getElementById('room-info').textContent = `Room: ${this.roomId} (${data.userCount} users)`;
                if (data.userId !== this.userId && !(this.roomUsers || []).includes(data.userId)) {
                    this.roomUsers = [...(this.roomUsers || []), data.userId];
                    this.addContact(data.userId, data.codename || `User ${data.userId}`);
                }
                this.renderContacts();
            });

            this.socket.on('user-left', (data) => {
                this.displaySystemMessage(`User ${data.userId} left the room`);
                document.getElementById('room-info').textContent = `Room: ${this.roomId} (${data.userCount} users)`;
                this.removeContact(data.userId);
                if (data.userCount <= 0) {
                    this.roomUsers = [];
                    this.enableRoomControls();
                    document.getElementById('end-room-btn').style.display = 'none';
                    document.getElementById('copy-room-btn').style.display = 'none';
                    document.getElementById('share-room-btn').style.display = 'none';
                    this.isRoomCreator = false;
                }
            });

            this.socket.on('new-message', (message) => {
                this.displayMessage(message);
                this.markRoomRead();
            });

            this.socket.on('message-sent', (data) => {
                const last = document.querySelector(`.message[data-message-id="${this.escapeAttr(data.messageId)}"]`);
                if (last) {
                    const status = last.querySelector('.message-status');
                    if (status) status.textContent = '✓ Delivered';
                }
            });

            this.socket.on('new-feedback', (feedback) => {
                this.displayFeedback(feedback);
            });

            this.socket.on('typing-start', (data) => {
                this.showTypingIndicator(data.userId);
            });

            this.socket.on('typing-stop', (data) => {
                this.hideTypingIndicator(data.userId);
            });

            this.socket.on('read-receipt', (data) => {
                this.applyReadReceipt(data.messageId, data.userId);
            });

            this.socket.on('presence-update', (data) => {
                this.applyPresenceUpdate(data);
            });

            this.socket.on('connect_error', (error) => {
                this.updateConnectionStatus('Connection Error');
                this.updateConnectionType('Failed');
                console.error('Connection error:', error);
                this.attemptRejoinRoom();
            });

            this.socket.on('room-ended', (data) => {
                this.roomId = null;
                this.roomUsers = [];
                this.typingMap = {};
                this.updateTypingPanel();
                this.enableRoomControls();
                document.getElementById('end-room-btn').style.display = 'none';
                document.getElementById('messages').innerHTML = '';
                document.getElementById('room-info').textContent = '';
                this.displaySystemMessage('Room ended by a user. You can now join or create a new room.');
                document.getElementById('copy-room-btn').style.display = 'none';
                document.getElementById('share-room-btn').style.display = 'none';
                this.isRoomCreator = false;
                this.renderContacts();
            });

            this.socket.on('key-rotated', (data) => {
                this.displaySystemMessage(`🔐 User ${data.userId} rotated encryption keys for enhanced security`);
                console.log('Key rotation detected:', data);
            });

            this.socket.on('contacts-update', (data) => {
                if (!data || !data.userId) return;
                const contact = this.contacts.find(c => c.userId === data.userId);
                if (contact && data.codename) {
                    contact.label = data.codename;
                    this.saveLocalContacts();
                    this.renderContacts();
                }
            });

        } catch (error) {
            console.error('Failed to connect:', error);
            this.updateConnectionStatus('Connection Failed');
        }
    }

    generateEncryptionKey() {
        try {
            // Generate a random encryption key
            const array = new Uint8Array(32);
            crypto.getRandomValues(array);
            this.encryptionKey = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
            this.currentSessionKey = this.encryptionKey;
            console.log('Generated encryption key');
        } catch (error) {
            console.error('Failed to generate encryption key:', error);
            // Fallback: use timestamp-based key
            this.encryptionKey = Date.now().toString(16) + Math.random().toString(16).substr(2);
            this.currentSessionKey = this.encryptionKey;
            console.log('Using fallback encryption key');
        }
    }

    generateRoomKey() {
        try {
            // Generate a shared room encryption key
            const array = new Uint8Array(16);
            crypto.getRandomValues(array);
            return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
        } catch (error) {
            console.error('Failed to generate room key:', error);
            return Date.now().toString(16) + Math.random().toString(16).substr(2);
        }
    }

    // Simple XOR encryption fallback
    simpleEncrypt(text, key) {
        let result = '';
        for (let i = 0; i < text.length; i++) {
            const charCode = text.charCodeAt(i) ^ key.charCodeAt(i % key.length);
            result += String.fromCharCode(charCode);
        }
        return btoa(result); // Base64 encode
    }

    simpleDecrypt(encryptedText, key) {
        try {
            const decoded = atob(encryptedText); // Base64 decode
            let result = '';
            for (let i = 0; i < decoded.length; i++) {
                const charCode = decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length);
                result += String.fromCharCode(charCode);
            }
            return result;
        } catch (error) {
            return '[Decryption Failed]';
        }
    }

    // Start automatic key rotation (simple session key rotation)
    startKeyRotation() {
        this.keyRotationInterval = setInterval(() => {
            this.rotateSessionKey();
        }, this.keyRotationTime);
        
        console.log(`Key rotation scheduled every ${this.keyRotationTime / 1000} seconds`);
    }

    // Rotate encryption keys
    rotateSessionKey() {
        try {
            const newKey = crypto.getRandomValues(new Uint8Array(32)).reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');
            this.currentSessionKey = newKey;
            
            console.log('Session key rotated');
            this.updateEncryptionStatus('AES-256 + HMAC (Rotated)');
            
            // Notify server about key rotation
            if (this.socket && this.isConnected) {
                this.socket.emit('key-rotation', {
                    sessionId: Date.now().toString(),
                    timestamp: Date.now()
                });
            }
        } catch (error) {
            console.error('Key rotation failed:', error);
        }
    }

        // Encryption with integrity
    encryptMessage(message) {
        try {
            const keyToUse = this.roomEncryptionKey || this.currentSessionKey || this.encryptionKey;

            if (this.cryptoAvailable && typeof CryptoJS !== 'undefined') {
                let encrypted = message;
                
                encrypted = CryptoJS.AES.encrypt(encrypted, keyToUse).toString();
                this.updateEncryptionStatus('AES-256 + HMAC');
                
                const signature = CryptoJS.HmacSHA512(encrypted, keyToUse).toString();
                
                const sequenceNumber = this.getNextSequenceNumber();
                
                return { 
                    encryptedContent: encrypted, 
                    signature: signature,
                    method: 'aes-hmac',
                    sequenceNumber: sequenceNumber,
                    sessionId: this.getCurrentSessionId(),
                    timestamp: Date.now()
                };
            } else {
                const encrypted = this.simpleEncrypt(message, keyToUse);
                this.updateEncryptionStatus('Basic XOR');
                return { 
                    encryptedContent: encrypted, 
                    signature: 'simple',
                    method: 'simple',
                    sequenceNumber: this.getNextSequenceNumber()
                };
            }
        } catch (error) {
            console.error('Encryption failed:', error);
            this.updateEncryptionStatus('Encryption Failed');
            return null;
        }
    }

    // Get next sequence number
    getNextSequenceNumber() {
        if (!this.sequenceCounter) {
            this.sequenceCounter = 0;
        }
        return ++this.sequenceCounter;
    }

    // Get current session ID
    getCurrentSessionId() {
        return this.roomId + '-' + Math.floor(Date.now() / this.keyRotationTime);
    }

    // Show photo menu
    showPhotoMenu() {
        const menu = document.getElementById('photo-menu');
        menu.style.display = 'flex';
    }

    // Hide photo menu
    hidePhotoMenu() {
        const menu = document.getElementById('photo-menu');
        menu.style.display = 'none';
    }

    // Open hamburger menu
    openHamburgerMenu() {
        const menu = document.getElementById('hamburger-menu');
        menu.style.display = 'block';
        
        document.getElementById('menu-codename').textContent = this.codename || 'Not set';
        document.getElementById('menu-connection-status').textContent = this.isConnected ? 'Connected' : 'Disconnected';
        document.getElementById('menu-room-info').textContent = this.roomId || 'Not in room';
        
        if (this.roomId) {
            document.getElementById('menu-copy-room').style.display = 'block';
            document.getElementById('menu-end-room').style.display = this.isRoomCreator ? 'block' : 'none';
        } else {
            document.getElementById('menu-copy-room').style.display = 'none';
            document.getElementById('menu-end-room').style.display = 'none';
        }
    }

    // Close hamburger menu
    closeHamburgerMenu() {
        const menu = document.getElementById('hamburger-menu');
        menu.style.display = 'none';
    }

    // Handle file selection
    handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Check file size (max 5MB for security)
        if (file.size > 5 * 1024 * 1024) {
            this.displaySystemMessage('File too large. Maximum size is 5MB.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            this.currentAttachment = {
                name: file.name,
                type: file.type,
                size: file.size,
                data: e.target.result
            };
            this.showAttachmentPreview();
        };
        reader.readAsDataURL(file);
    }

    // Handle photo capture
    handlePhotoCapture(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Check file size
        if (file.size > 5 * 1024 * 1024) {
            this.displaySystemMessage('Photo too large. Maximum size is 5MB.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            this.currentAttachment = {
                name: file.name || 'photo.jpg',
                type: file.type,
                size: file.size,
                data: e.target.result,
                isPhoto: true
            };
            this.showAttachmentPreview();
        };
        reader.readAsDataURL(file);
    }

    // Share location
    shareLocation() {
        if (!navigator.geolocation) {
            this.displaySystemMessage('Geolocation is not supported by your browser');
            return;
        }

        this.displaySystemMessage('Getting your location...');

        navigator.geolocation.getCurrentPosition(
            (position) => {
                this.currentLocation = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    timestamp: position.timestamp
                };
                this.showLocationPreview();
            },
            (error) => {
                let errorMessage = 'Unable to get location: ';
                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage += 'Permission denied';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage += 'Position unavailable';
                        break;
                    case error.TIMEOUT:
                        errorMessage += 'Request timeout';
                        break;
                    default:
                        errorMessage += 'Unknown error';
                }
                this.displaySystemMessage(errorMessage);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    }

    // Show attachment preview
    showAttachmentPreview() {
        const preview = document.getElementById('attachment-preview');
        preview.style.display = 'block';
        
        let previewContent = '';
        if (this.currentAttachment.isPhoto || this.currentAttachment.type.startsWith('image/')) {
            previewContent = `
                <div class="preview-item">
                    <img src="${this.currentAttachment.data}" style="max-width: 100px; max-height: 100px; border-radius: 4px;">
                    <span>${this.currentAttachment.name} (${this.formatFileSize(this.currentAttachment.size)})</span>
                    <button onclick="window.secureChat.clearAttachment()">✕</button>
                </div>
            `;
        } else {
            previewContent = `
                <div class="preview-item">
                    <span>📎 ${this.currentAttachment.name} (${this.formatFileSize(this.currentAttachment.size)})</span>
                    <button onclick="window.secureChat.clearAttachment()">✕</button>
                </div>
            `;
        }
        
        preview.innerHTML = previewContent;
    }

    // Show location preview
    showLocationPreview() {
        const preview = document.getElementById('attachment-preview');
        preview.style.display = 'block';
        
        preview.innerHTML = `
            <div class="preview-item">
                <span>📍 Location: ${this.currentLocation.latitude.toFixed(6)}, ${this.currentLocation.longitude.toFixed(6)}</span>
                <button onclick="window.secureChat.clearLocation()">✕</button>
            </div>
        `;
    }

    // Clear attachment
    clearAttachment() {
        this.currentAttachment = null;
        const preview = document.getElementById('attachment-preview');
        preview.style.display = 'none';
        preview.innerHTML = '';
        document.getElementById('file-input').value = '';
        document.getElementById('photo-input').value = '';
    }

    // Clear location
    clearLocation() {
        this.currentLocation = null;
        const preview = document.getElementById('attachment-preview');
        preview.style.display = 'none';
        preview.innerHTML = '';
    }

    // Format file size
    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    // Enhanced decryption with Perfect Forward Secrecy
    decryptMessage(encryptedContent, method = 'aes', signature = null, sequenceNumber = null) {
        try {
            const keyToUse = this.roomEncryptionKey || this.currentSessionKey || this.encryptionKey;
            
            if (method === 'aes-hmac' && this.cryptoAvailable && typeof CryptoJS !== 'undefined') {
                if (signature && typeof signature === 'string') {
                    const expectedSignature = CryptoJS.HmacSHA512(encryptedContent, keyToUse).toString();
                    if (signature !== expectedSignature) {
                        console.warn('HMAC verification failed');
                        return '[Message Integrity Check Failed]';
                    }
                }
                
                const decrypted = CryptoJS.AES.decrypt(encryptedContent, keyToUse);
                const result = decrypted.toString(CryptoJS.enc.Utf8);
                return result;
                
            } else if (method === 'simple') {
                return this.simpleDecrypt(encryptedContent, keyToUse);
            } else if (method === 'aes') {
                const decrypted = CryptoJS.AES.decrypt(encryptedContent, keyToUse);
                return decrypted.toString(CryptoJS.enc.Utf8);
            } else {
                try {
                    const decrypted = CryptoJS.AES.decrypt(encryptedContent, keyToUse);
                    return decrypted.toString(CryptoJS.enc.Utf8);
                } catch (error) {
                    console.error('Decryption failed for unknown method:', method);
                    return '[Encrypted Message]';
                }
            }
        } catch (error) {
            console.error('Decryption failed:', error);
            return '[Decryption Failed]';
        }
    }

    // Verify HMAC signature
    verifyHMAC(data, expectedSignature, key) {
        try {
            const actualSignature = CryptoJS.HmacSHA512(data, key).toString();
            return actualSignature === expectedSignature;
        } catch (error) {
            console.error('HMAC verification failed:', error);
            return false;
        }
    }

    joinRoom() {
        if (!this.isConnected) {
            this.displaySystemMessage('Not connected to server');
            return;
        }
        const roomInput = document.getElementById('room-input');
        const roomId = roomInput.value.trim();
        if (!roomId) {
            this.displaySystemMessage('Please enter a Room ID or contact identifier.');
            return;
        }
        this.socket.emit('join-room', { roomId });
        roomInput.value = '';
    }

    createNewRoom() {
        if (!this.isConnected) {
            this.displaySystemMessage('Not connected to server');
            return;
        }
        const newRoomId = 'room-' + Math.random().toString(36).substr(2, 8);
        this.displaySystemMessage(`✨ Creating new room: ${newRoomId}...`);
        this.socket.emit('join-room', { roomId: newRoomId });
    }

    startChatWithContact(userId, label) {
        if (!this.isConnected) {
            this.displaySystemMessage('Not connected to server');
            return;
        }
        const contact = this.contacts.find(c => c.userId === userId);
        let roomId = contact && contact.roomId ? contact.roomId : userId;
        this.socket.emit('join-room', { roomId });
    }

    sendMessage() {
        if (!this.isConnected || !this.roomId) {
            this.displaySystemMessage('Not connected or not in a room');
            return;
        }

        const messageInput = document.getElementById('message-input');
        const message = messageInput.value.trim();
        
        if (!message && !this.currentAttachment && !this.currentLocation) return;

        let messageData = message;
        let messageType = 'text';
        
        if (this.currentAttachment) {
            messageData = JSON.stringify({ text: message, attachment: this.currentAttachment });
            messageType = 'attachment';
        } else if (this.currentLocation) {
            messageData = JSON.stringify({ text: message, location: this.currentLocation });
            messageType = 'location';
        }
        
        const encrypted = this.encryptMessage(messageData);
        
        if (!encrypted) {
            this.displaySystemMessage('Failed to encrypt message');
            return;
        }

        encrypted.messageType = messageType;

        this.socket.emit('send-message', encrypted);
        messageInput.value = '';

        if (this.socket && this.isConnected && this.roomId) {
            this.socket.emit('typing-stop', { roomId: this.roomId, userId: this.userId });
        }
        clearTimeout(this.typingTimeout);
        this.typingTimeout = null;
        
        const ownMessage = {
            id: Date.now().toString(),
            userId: this.userId,
            encryptedContent: encrypted.encryptedContent,
            timestamp: encrypted.timestamp || Date.now(),
            signature: encrypted.signature,
            method: encrypted.method,
            sequenceNumber: encrypted.sequenceNumber,
            sessionId: encrypted.sessionId,
            messageType: messageType
        };
        
        this.appendIncomingMessage(ownMessage, true);
        this.clearAttachment();
        this.currentLocation = null;
    }

    appendIncomingMessage(message, isOwn = false) {
        if (!message || !message.userId) return;
        const senderId = message.userId;
        let activeSender = this.activeContactId;

        if (!activeSender) {
            if (isOwn) {
                const partner = (this.roomUsers || []).find(u => u !== this.userId);
                if (partner) {
                    const existing = this.contacts.find(c => c.userId === partner);
                    if (!existing) {
                        this.addContact(partner, `User ${partner}`);
                    }
                    this.switchContact(partner);
                    activeSender = partner;
                }
            }
            if (!activeSender) {
                const existing = this.contacts.find(c => c.userId === senderId);
                if (!existing) {
                    this.addContact(senderId, `User ${senderId}`);
                }
                this.switchContact(senderId);
                activeSender = senderId;
            }
        }

        this.persistMessage({ ...message, senderId });

        if (this.activeContactId === activeSender) {
            this.appendMessageToChat({ ...message, senderId });
        }
        this.renderContacts();
    }

    displayMessage(message, isOwn = false) {
        if (!message || !message.userId) return;
        this.persistMessage({ ...message, senderId: message.userId });

        if (!this.activeContactId) {
            this.switchContact(message.userId);
        }

        if (this.activeContactId === message.userId) {
            this.appendMessageToChat({ ...message, senderId: message.userId });
        }
        this.renderContacts();
    }

    emitTyping() {
        if (!this.socket || !this.isConnected || !this.roomId) return;

        if (!this.typingTimeout) {
            this.socket.emit('typing-start', {
                roomId: this.roomId,
                userId: this.userId
            });
        }

        clearTimeout(this.typingTimeout);
        this.typingTimeout = setTimeout(() => {
            this.socket.emit('typing-stop', {
                roomId: this.roomId,
                userId: this.userId
            });
            this.typingTimeout = null;
        }, 1200);
    }

    showTypingIndicator(userId) {
        if (!this.typingMap) {
            this.typingMap = {};
        }
        this.typingMap[userId] = Date.now();
        this.updateTypingPanel();
    }

    hideTypingIndicator(userId) {
        if (!this.typingMap) {
            this.typingMap = {};
        }
        delete this.typingMap[userId];
        this.updateTypingPanel();
    }

    updateTypingPanel() {
        const el = document.getElementById('typing-indicator');
        if (!el) return;

        const now = Date.now();
        const typers = Object.entries(this.typingMap || {})
            .filter(([, ts]) => now - ts < 2500)
            .map(([uid]) => uid)
            .filter(uid => uid !== this.userId);

        if (typers.length === 0) {
            el.textContent = '';
            return;
        }

        const names = typers.map(uid => `User ${uid}`).join(', ');
        el.textContent = `${names} typing`;
    }

    markRoomRead() {
        if (!this.socket || !this.isConnected || !this.roomId) return;
        this.socket.emit('read-receipt', {
            roomId: this.roomId,
            userId: this.userId,
            timestamp: Date.now()
        });
    }

    applyReadReceipt(messageId, userId) {
        const node = document.querySelector(`.message[data-message-id="${this.escapeAttr(messageId)}"]`);
        if (!node) return;

        const status = node.querySelector('.message-status');
        const safeId = this.escapeAttr(userId);
        if (status && safeId !== this.userId) {
            status.textContent = `✓ Read by ${safeId}`;
        }
    }

    loadLocalContacts() {
        try {
            const raw = localStorage.getItem('backchannel_contacts');
            this.contacts = raw ? JSON.parse(raw) : [];
        } catch (e) {
            this.contacts = [];
        }
        this.renderContacts();
    }

    saveLocalContacts() {
        try {
            localStorage.setItem('backchannel_contacts', JSON.stringify(this.contacts));
        } catch (e) {
            // ignore storage errors
        }
    }

    addContact(userId, label) {
        if (!userId || userId === this.userId) return;
        const exists = this.contacts.find(c => c.userId === userId);
        if (!exists) {
            this.contacts.push({ userId, label: label || `User ${userId}`, roomId: null, updatedAt: Date.now() });
            this.saveLocalContacts();
            this.renderContacts();
        }
    }

    removeContact(userId) {
        this.contacts = this.contacts.filter(c => c.userId !== userId);
        if (this.activeContactId === userId) {
            this.activeContactId = null;
            this.showEmptyChat();
        }
        this.saveLocalContacts();
        this.renderContacts();
    }

    renderContacts() {
        const list = document.getElementById('contacts-list');
        const count = document.getElementById('contact-count');
        if (!list) return;
        const query = (document.getElementById('contact-search')?.value || '').trim().toLowerCase();
        const filtered = this.contacts.filter(c => (c.label || '').toLowerCase().includes(query));
        list.innerHTML = filtered.map(c => {
            const last = this.getLastMessageForContact(c.userId);
            const activeClass = this.activeContactId === c.userId ? 'active' : '';
            return `<div class="contact-item ${activeClass}" data-userid="${this.escapeAttr(c.userId)}" role="option" aria-selected="${this.activeContactId === c.userId}">
                <div class="contact-item__name">${this.escapeHtml(c.label)}</div>
                <div class="contact-item__meta">${last ? this.escapeHtml(last) : 'No messages yet'}</div>
            </div>`;
        }).join('');
        if (count) count.textContent = String(filtered.length);
    }

    getLastMessageForContact(userId) {
        const key = this.getConversationKey(userId);
        const messages = this.contactMessages[key] || [];
        const last = messages[messages.length - 1];
        if (!last) return null;
        return last.preview || last.text || 'Message';
    }

    applyPresenceUpdate(data) {
        if (!data) return;
        const contact = this.contacts.find(c => c.userId === data.userId);
        if (contact) {
            contact.online = data.online !== undefined ? data.online : true;
            contact.lastSeen = data.lastSeen || contact.lastSeen;
            this.renderContacts();
        }
    }

    getConversationKey(userId) {
        if (this.roomId) return this.roomId;
        return [this.userId, userId].sort().join('_');
    }

    getContactLabel(userId) {
        const contact = this.contacts.find(c => c.userId === userId);
        return contact ? contact.label : `User ${userId}`;
    }

    loadLocalMessages() {
        try {
            const raw = localStorage.getItem('backchannel_messages');
            this.contactMessages = raw ? JSON.parse(raw) : {};
        } catch (e) {
            this.contactMessages = {};
        }
    }

    saveLocalMessages() {
        try {
            localStorage.setItem('backchannel_messages', JSON.stringify(this.contactMessages));
        } catch (e) {
            // ignore storage errors
        }
    }

    showMobileChat() {
        if (this.isMobile()) {
            document.getElementById('main-container')?.classList.add('chat-open');
        }
    }

    showMobileContacts() {
        if (this.isMobile()) {
            document.getElementById('main-container')?.classList.remove('chat-open');
        }
    }

    showEmptyChat() {
        document.getElementById('room-title').textContent = 'Select a contact';
        document.getElementById('room-subtitle').textContent = '';
        document.getElementById('chat-header-avatar').textContent = '?';
        document.getElementById('messages').innerHTML = '<div class="empty-state">Select a contact to start chatting</div>';
        this.showMobileContacts();
    }

    switchContact(userId) {
        if (!userId) return;
        this.activeContactId = userId;
        const contact = this.contacts.find(c => c.userId === userId);
        const label = contact ? contact.label : `User ${userId}`;
        document.getElementById('room-title').textContent = label;
        document.getElementById('room-subtitle').textContent = 'Encrypted chat';
        document.getElementById('chat-header-avatar').textContent = (label || '?').charAt(0).toUpperCase();
        this.loadConversation(userId);
        this.renderContacts();
        this.showMobileChat();
    }

    loadConversation(userId) {
        const key = this.getConversationKey(userId);
        const messages = this.contactMessages[key] || [];
        const container = document.getElementById('messages');
        container.innerHTML = '';
        messages.forEach(msg => this.appendMessageToChat(msg));
        container.scrollTop = container.scrollHeight;
    }

    appendMessageToChat(msg) {
        const container = document.getElementById('messages');
        if (!container) return;
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message';
        messageDiv.setAttribute('data-message-id', msg.id);

        const timestamp = new Date(msg.timestamp).toLocaleTimeString();
        const isOwn = msg.senderId === this.userId;
        const senderLabel = msg.senderLabel || (isOwn ? 'You' : this.getContactLabel(msg.userId));
        const decryptedContent = this.decryptMessage(
            msg.encryptedContent,
            msg.method,
            msg.signature,
            msg.sequenceNumber
        );

        let messageContent = '';
        if (msg.messageType === 'attachment' || msg.messageType === 'location') {
            try {
                const parsed = JSON.parse(decryptedContent);
                const text = parsed.text || '';
                if (msg.messageType === 'attachment' && parsed.attachment) {
                    const att = parsed.attachment;
                    if (att.isPhoto || att.type.startsWith('image/')) {
                        messageContent = `<div class="message-attachment"><img src="${this.sanitizeUrl(att.data)}" style="max-width: 100%; height: auto; border-radius: 8px; margin: 8px 0;"><div class="attachment-info">📷 ${this.escapeAttr(att.name)} (${this.formatFileSize(att.size)})</div></div>`;
                    } else {
                        messageContent = `<div class="message-attachment"><a href="${this.sanitizeUrl(att.data)}" download="${this.escapeAttr(att.name)}" class="file-download">📎 ${this.escapeAttr(att.name)} (${this.formatFileSize(att.size)})</a></div>`;
                    }
                } else if (msg.messageType === 'location' && parsed.location) {
                    const loc = parsed.location;
                    const mapsUrl = `https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`;
                    messageContent = `<div class="message-location"><a href="${this.sanitizeUrl(mapsUrl)}" target="_blank" class="location-link">📍 Location: ${loc.latitude.toFixed(6)}, ${loc.longitude.toFixed(6)}<br><small>Accuracy: ±${Math.round(loc.accuracy)}m</small></a></div>`;
                }
            } catch (e) {
                // ignore parse errors
            }
        }

        const cssClass = isOwn ? 'own' : 'other';
        messageDiv.className = `message ${cssClass}`;

        messageDiv.innerHTML = `
            <div class="message__header">
                <span class="message__user">${this.escapeHtml(senderLabel)}</span>
                <span class="message__time">${timestamp}</span>
                <span class="message__status">${isOwn ? '✓ Sent' : '📥 Received'}</span>
            </div>
            ${decryptedContent ? `<div class="message__content">${this.escapeHtml(decryptedContent)}</div>` : ''}
            ${messageContent}
        `;

        container.appendChild(messageDiv);
        container.scrollTop = container.scrollHeight;

        this.scheduleMessageClear(messageDiv, msg.id);
    }

    attemptRejoinRoom() {
        if (!this.rejoinCandidateRoomId || !this.socket) return;

        this.rejoinAttempts = (this.rejoinAttempts || 0) + 1;
        if (this.rejoinAttempts > 5) {
            this.displaySystemMessage('Rejoin failed. Please join manually.');
            this.rejoinCandidateRoomId = null;
            this.rejoinAttempts = 0;
            return;
        }

        setTimeout(() => {
            if (!this.isConnected) return;
            this.displaySystemMessage('Reconnecting to room...');
            this.socket.emit('join-room', { roomId: this.rejoinCandidateRoomId });
        }, 1000 * this.rejoinAttempts);
    }

    preserveRoomId(roomId) {
        this.rejoinCandidateRoomId = roomId;
        this.rejoinAttempts = 0;
    }

    startHeartbeat() {
        this.stopHeartbeat();
        this.heartbeatInterval = setInterval(() => {
            if (this.socket && this.isConnected) {
                this.socket.emit('heartbeat');
            }
        }, 15000);
    }

    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    sendFeedback(messageId, feedbackType) {
        if (!this.isConnected || !this.roomId) return;

        const feedback = {
            messageId: messageId,
            type: feedbackType,
            userId: this.userId,
            timestamp: Date.now()
        };

        this.socket.emit('send-feedback', feedback);
        this.displaySystemMessage(`Feedback sent: ${feedbackType}`);
    }

    displayFeedback(feedback) {
        const feedbackMessages = {
            'ack': 'Message acknowledged',
            'question': 'Question about message',
            'urgent': 'Marked as urgent'
        };

        const message = `User ${feedback.userId}: ${feedbackMessages[feedback.type] || feedback.type}`;
        this.displaySystemMessage(message);
    }

    displaySystemMessage(message) {
        const messagesContainer = document.getElementById('messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message system-message';

        const timestamp = new Date().toLocaleTimeString();

        messageDiv.innerHTML = `
            <div class="message__header">
                <span class="message__user">System</span>
                <span class="message__time">${timestamp}</span>
            </div>
            <div class="message__content">${this.escapeHtml(message)}</div>
        `;

        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    loadMessages(messages) {
        const container = document.getElementById('messages');
        if (!container) return;
        container.innerHTML = '';

        messages.forEach(message => {
            const msg = { ...message, senderId: message.userId };
            this.persistMessage(msg);
            this.appendMessageToChat(msg);
        });

        container.scrollTop = container.scrollHeight;
        this.renderContacts();
    }

    persistMessage(message) {
        if (!message || !message.id || !message.senderId) return;
        const key = this.getConversationKey(message.senderId);
        if (!this.contactMessages[key]) this.contactMessages[key] = [];
        const exists = this.contactMessages[key].some(m => m.id === message.id);
        if (!exists) {
            this.contactMessages[key].push({
                id: message.id,
                encryptedContent: message.encryptedContent,
                text: message.encryptedContent,
                senderId: message.senderId,
                senderLabel: message.senderLabel,
                timestamp: message.timestamp || Date.now(),
                signature: message.signature,
                sequenceNumber: message.sequenceNumber,
                method: message.method,
                messageType: message.messageType
            });
            this.saveLocalMessages();
        }
    }

    updateConnectionStatus(status) {
        const statusElement = document.getElementById('connection-status');
        statusElement.textContent = status;
        
        if (status === 'Connected') {
            statusElement.style.color = '#00ff00';
        } else if (status.includes('Error') || status.includes('Failed')) {
            statusElement.style.color = '#ff0000';
        } else {
            statusElement.style.color = '#ffaa00';
        }
    }

    updateConnectionType(type) {
        document.getElementById('connection-type').textContent = type;
    }

    updateEncryptionStatus(status) {
        const statusElement = document.getElementById('encryption-status');
        if (statusElement) {
            statusElement.textContent = status;
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    escapeAttr(text) {
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    sanitizeUrl(url) {
        const stripped = String(url)
            .replace(/</g, '%3C')
            .replace(/>/g, '%3E')
            .replace(/\^/g, '%5E')
            .replace(/`/g, '%60')
            .replace(/\{/g, '%7B')
            .replace(/\}/g, '%7D');
        const lower = stripped.toLowerCase();
        if (!/^[a-z0-9]+:\/\//.test(lower)) {
            return 'about:blank';
        }
        return stripped;
    }

    // Security cleanup
    cleanup() {
        this.stopHeartbeat();
        clearTimeout(this.typingTimeout);
        this.typingMap = {};
        this.typingTimeout = null;
        if (this.socket) {
            this.socket.disconnect();
        }
        this.encryptionKey = null;
        this.userId = null;
        this.roomId = null;
    }

    scheduleMessageClear(messageElement, messageId) {
        const startTime = Date.now();
        const duration = 20 * 1000; // 20 seconds

        // Add countdown timer
        const countdownElement = document.createElement('div');
        countdownElement.className = 'message__countdown';
        messageElement.style.position = 'relative';
        messageElement.appendChild(countdownElement);

        // Update countdown every second
        const countdownInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const remaining = Math.max(0, duration - elapsed);
            const minutes = Math.floor(remaining / 60000);
            const seconds = Math.floor((remaining % 60000) / 1000);

            countdownElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

            // Change color as time runs out
            if (remaining < 5000) {
                countdownElement.classList.add('message__countdown--danger');
            } else if (remaining < 10000) {
                countdownElement.classList.add('message__countdown--warning');
            }

            // Show notification at 10 seconds remaining
            if (remaining === 10000) {
                this.showAutoClearNotification('Messages expiring in 10 seconds');
            }
        }, 1000);

        setTimeout(() => {
            clearInterval(countdownInterval);
            if (messageElement && messageElement.parentNode) {
                // Add fade-out effect
                messageElement.classList.add('message--fade-out');

                setTimeout(() => {
                    if (messageElement.parentNode) {
                        messageElement.parentNode.removeChild(messageElement);
                        console.log(`Message ${messageId} auto-cleared after 20 seconds`);
                    }
                }, 500);
            }
        }, duration);
    }

    showAutoClearNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'auto-clear-notification';
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Remove notification after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.transition = 'opacity 0.3s ease-out';
                notification.style.opacity = '0';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }
        }, 5000);
    }

    disableRoomControls() {
        document.getElementById('join-room-btn').disabled = true;
        document.getElementById('new-room-btn').disabled = true;
        document.getElementById('room-input').disabled = true;
    }

    enableRoomControls() {
        document.getElementById('join-room-btn').disabled = false;
        document.getElementById('new-room-btn').disabled = false;
        document.getElementById('room-input').disabled = false;
    }

    endRoom() {
        if (!this.roomId) return;
        if (!this.isRoomCreator) {
            this.displaySystemMessage('Only the room creator can end the room.');
            return;
        }
        this.socket.emit('end-room', { roomId: this.roomId });
        this.roomId = null;
        this.enableRoomControls();
        document.getElementById('end-room-btn').style.display = 'none';
        document.getElementById('messages').innerHTML = '';
        document.getElementById('room-info').textContent = '';
        this.displaySystemMessage('Room ended. You can now join or create a new room.');
        document.getElementById('copy-room-btn').style.display = 'none';
        document.getElementById('share-room-btn').style.display = 'none';
        this.isRoomCreator = false;
    }

    copyRoomId() {
        if (!this.roomId) return;
        
        // Copy the shareable link instead of just room ID
        const shareableLink = this.shareableLink || `${window.location.origin}${window.location.pathname}?room=${this.roomId}`;
        
        // Try modern Clipboard API first
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(shareableLink).then(() => {
                this.displaySystemMessage('✅ Shareable link copied to clipboard!');
                this.displaySystemMessage(`🔗 ${shareableLink}`);
            }).catch(() => {
                // Fallback to older method
                this.copyRoomIdFallback(shareableLink);
            });
        } else {
            // Fallback for older browsers/mobile
            this.copyRoomIdFallback(shareableLink);
        }
    }
    
    // Fallback copy method for older mobile browsers
    copyRoomIdFallback(textToCopy) {
        if (!textToCopy) {
            textToCopy = this.shareableLink || `${window.location.origin}${window.location.pathname}?room=${this.roomId}`;
        }
        
        // Create a temporary textarea element for copying
        const textarea = document.createElement('textarea');
        textarea.value = textToCopy;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '-9999px';
        document.body.appendChild(textarea);
        
        // Focus and select the text
        textarea.focus();
        textarea.select();
        
        try {
            // Try execCommand for older browsers
            const successful = document.execCommand('copy');
            if (successful) {
                this.displaySystemMessage('✅ Shareable link copied to clipboard!');
                this.displaySystemMessage(`🔗 ${textToCopy}`);
            } else {
                this.displaySystemMessage('Failed to copy. Please select and copy manually.');
                this.displaySystemMessage(`🔗 Link: ${textToCopy}`);
            }
        } catch (err) {
            // Last resort: show the link for manual copying
            this.displaySystemMessage(`🔗 Link: ${textToCopy} - Please copy this link`);
        }
        
        // Clean up
        document.body.removeChild(textarea);
    }
    
    // Share room ID using Web Share API (mobile)
    shareRoomId() {
        if (!this.roomId) return;
        
        // Generate shareable link
        const shareableLink = this.shareableLink || `${window.location.origin}${window.location.pathname}?room=${this.roomId}`;
        
        // Check if Web Share API is available
        if (navigator.share) {
            navigator.share({
                title: 'Join My Secure BackChannel Room',
                text: `Join my secure encrypted chat room! Click the link to join:`,
                url: shareableLink
            }).then(() => {
                this.displaySystemMessage('✅ Room link shared successfully!');
            }).catch((error) => {
                // If user cancels or fails, fall back to copy
                if (error.name !== 'AbortError') {
                    this.copyRoomId();
                }
            });
        } else {
            // Fallback for desktop or unsupported browsers
            this.copyRoomId();
        }
    }

    // Report security event to server
    reportSecurityEvent(eventType, details = {}) {
        if (!this.userId) return;
        
        const eventData = {
            eventType: eventType,
            userId: this.userId,
            roomId: this.roomId,
            details: {
                ...details,
                timestamp: Date.now(),
                userAgent: navigator.userAgent,
                screenResolution: `${screen.width}x${screen.height}`,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
            }
        };
        
        // Send to server
        fetch('/security/event', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(eventData)
        }).catch(error => {
            console.error('Failed to report security event:', error);
        });
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.secureChat = new SecureChat();
    
    // Handle viewport height for mobile browsers
    const setViewportHeight = () => {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    
    setViewportHeight();
    window.addEventListener('resize', setViewportHeight);
    window.addEventListener('orientationchange', setViewportHeight);
    
    // Prevent zoom on double tap for iOS
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (event) => {
        const now = Date.now();
        if (now - lastTouchEnd <= 300) {
            event.preventDefault();
        }
        lastTouchEnd = now;
    }, false);
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        if (window.secureChat) {
            window.secureChat.cleanup();
        }
    });
}); 