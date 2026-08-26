# BackChannel - Complete User Guide

## 🚀 Getting Started

### Access the App
- **Local**: http://localhost:3000
- **Network**: http://10.45.2.145:3000

### First Time Setup
1. Open the app in your browser
2. You'll be assigned a random anonymous User ID
3. Create a new room or join an existing one

---

## 💬 Basic Chat Features

### Creating a Room
1. Click **"New Room"** button
2. A random room code is generated (e.g., room-abc123)
3. Share this code with others to invite them
4. You become the room creator

### Joining a Room
1. Enter the room code in the input field
2. Click **"Join Room"**
3. You'll see existing messages (last 50)
4. Start chatting!

### Sending Messages
1. Type your message in the text area
2. Press **Enter** or click **"Send"**
3. Messages are encrypted before sending
4. They auto-delete after 20 seconds

### Leaving a Room
- Simply close the browser tab
- Or click **"End Room"** (only room creator can do this)

---

## 📎 File Attachments

### How to Attach Files
1. Click the **📎 Attach File** button
2. Select any file from your device (max 5MB)
3. See preview of the file
4. Add optional text message
5. Click **Send**

### Supported File Types
- Documents (PDF, DOC, TXT, etc.)
- Images (JPG, PNG, GIF, etc.)
- Archives (ZIP, RAR, etc.)
- Any file type up to 5MB

### Receiving Files
- Files appear in messages with download link
- Click to download
- Images display inline
- Files auto-delete after 20 seconds

---

## 📷 Camera & Photos

### Take a Photo
1. Click the **📷 Camera** button
2. Choose **"📸 Take Photo"**
3. Camera opens (mobile) or file picker (desktop)
4. Take/select photo
5. Preview appears
6. Click **Send**

### Choose from Gallery
1. Click the **📷 Camera** button
2. Choose **"🖼️ Choose from Gallery"**
3. Browse your photo library
4. Select image
5. Preview appears
6. Click **Send**

### Photo Features
- Max size: 5MB
- Formats: JPG, PNG, GIF, WEBP
- Photos display inline in chat
- Encrypted before sending
- Auto-delete after 20 seconds

---

## 📍 Location Sharing

### Share Your Location
1. Click the **📍 Share Location** button
2. Browser asks for permission (allow it)
3. GPS coordinates are captured
4. Preview shows latitude/longitude
5. Click **Send**

### Location Features
- Shows exact coordinates
- Displays accuracy (±meters)
- Creates clickable Google Maps link
- Recipients can click to view on map
- Encrypted before sending

### Privacy Note
- Location is only shared when you click the button
- Not tracked continuously
- Only sent to current room members
- Auto-deletes after 20 seconds

---

## 🔐 Security Features

### Encryption
- **AES-256 encryption** for all messages
- **HMAC-SHA512** for message integrity
- **Perfect Forward Secrecy** (keys rotate every 5 minutes)
- End-to-end encrypted

### Auto-Delete
- All messages auto-delete after **20 seconds**
- Countdown timer shows remaining time
- Applies to text, files, photos, and locations
- Cannot be recovered after deletion

### Anti-Screenshot Protection
- Multiple layers of screenshot prevention
- Visual interference patterns
- Detection of screenshot attempts
- Alerts on suspicious activity

### Anonymous
- No registration required
- Random user IDs assigned
- No personal data stored
- No message history kept

---

## 🎨 Room Management

### Copy Room Code
1. Click **"📋 Copy Code"** button
2. Room code copied to clipboard
3. Share with others via any app

### Share Room
1. Click **"📤 Share"** button
2. Native share menu opens (mobile)
3. Choose app to share with
4. Or falls back to copy on desktop

### End Room (Creator Only)
1. Click **"End Room"** button
2. All users are disconnected
3. All messages are deleted
4. Room is permanently closed

---

## 📱 Device Compatibility

### Smartphones
- ✅ iPhone (all models)
- ✅ Android phones
- ✅ Portrait and landscape modes
- ✅ Touch-optimized interface

### Tablets
- ✅ iPad (all models)
- ✅ Android tablets
- ✅ Surface tablets
- ✅ Optimized layouts

### Computers
- ✅ Windows laptops/desktops
- ✅ Mac (MacBook, iMac)
- ✅ Linux desktops
- ✅ Chromebooks

### Browsers
- ✅ Chrome
- ✅ Safari
- ✅ Firefox
- ✅ Edge
- ✅ Samsung Internet

---

## 🎯 Tips & Tricks

### Quick Send
- Press **Enter** to send message
- Press **Shift+Enter** for new line

### Preview Before Sending
- All attachments show preview
- Remove by clicking **✕** button
- Can add text with attachments

### Multiple Users
- Up to 100 users per room
- See user count in status bar
- Get notified when users join/leave

### Connection Status
- Green = Connected
- Yellow = Connecting
- Red = Disconnected

### Security Indicators
- 🔐🔐 = AES-256 + HMAC (highest security)
- 🔐 = Basic encryption
- ⚠️ = Plain text (fallback)

---

## ⚠️ Troubleshooting

### Can't Connect
- Check internet connection
- Refresh the page
- Clear browser cache
- Try different browser

### Camera Not Working
- Allow camera permission in browser
- Check if camera is being used by another app
- Try "Choose from Gallery" instead
- Restart browser

### Location Not Working
- Allow location permission
- Enable GPS on device
- Check if location services are on
- Try again in a few seconds

### File Upload Failed
- Check file size (max 5MB)
- Try smaller file
- Check internet connection
- Refresh and try again

### Messages Not Sending
- Check connection status
- Make sure you're in a room
- Refresh the page
- Check internet connection

---

## 🔒 Privacy & Security Best Practices

### Do's ✅
- Use for temporary, sensitive communications
- Share room codes securely
- End rooms when done
- Use on trusted devices
- Keep browser updated

### Don'ts ❌
- Don't share room codes publicly
- Don't use on public/shared computers
- Don't screenshot messages (detected)
- Don't share sensitive data if connection is weak
- Don't keep rooms open indefinitely

---

## 📊 Technical Specifications

### Encryption
- Algorithm: AES-256-CBC
- Key Size: 256 bits
- HMAC: SHA-512
- Key Rotation: Every 5 minutes

### Message Limits
- Text: 1000 characters
- Files: 5MB max
- Room ID: 32 characters
- Message History: Last 100 messages

### Auto-Delete
- Timer: 20 seconds
- Countdown: Visible on each message
- Warning: At 10 seconds remaining
- Permanent: Cannot be recovered

### Performance
- WebSocket for real-time communication
- Fallback to polling if needed
- Optimized for mobile networks
- Low bandwidth usage

---

## 🆘 Support

### Common Issues
1. **Page won't load**: Check server is running
2. **Features not working**: Hard refresh (Ctrl+F5)
3. **Camera issues**: Check browser permissions
4. **Slow performance**: Close other tabs

### Browser Permissions Needed
- Camera (for taking photos)
- Location (for GPS sharing)
- Clipboard (for copy/paste)

### System Requirements
- Modern browser (last 2 years)
- JavaScript enabled
- Internet connection
- 1MB free RAM

---

## 🎉 Enjoy Secure, Anonymous Communication!

BackChannel provides military-grade encryption for your private conversations. All messages are temporary, encrypted, and anonymous. Perfect for sensitive discussions that need to stay private.

**Remember**: Messages auto-delete after 20 seconds. There's no undo!
