const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const allowedOrigin = process.env.ALLOWED_ORIGIN || `http://localhost:${process.env.PORT || 3000}`;

const io = socketIo(server, {
  cors: {
    origin: allowedOrigin,
    methods: ["GET", "POST"]
  }
});

// Simple in-memory rate limiter
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 30;

function rateLimit(key) {
  const now = Date.now();
  const record = rateLimitStore.get(key) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
  if (now > record.resetAt) {
    record.count = 0;
    record.resetAt = now + RATE_LIMIT_WINDOW_MS;
  }
  record.count++;
  rateLimitStore.set(key, record);
  return record.count <= RATE_LIMIT_MAX_REQUESTS;
}

function getClientIp(req) {
  return req.ip || req.connection?.remoteAddress || 'unknown';
}

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "ws:", "wss:"],
      mediaSrc: ["'none'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
      workerSrc: ["'self'"],
      childSrc: ["'self'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: { policy: "same-origin" },
  crossOriginResourcePolicy: { policy: "same-origin" },
  referrerPolicy: { policy: "no-referrer" },
  frameguard: { action: "deny" },
  noSniff: true,
  xssFilter: true
}));

app.use(cors({ origin: allowedOrigin, credentials: true }));
app.use(compression());
app.use(express.json({ limit: '512kb' }));
app.use(express.urlencoded({ extended: true, limit: '512kb' }));
app.use(express.static('public'));

// Privacy headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), display-capture=()');
  res.setHeader('X-Screenshot-Protection', 'enabled');
  res.setHeader('X-Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws: wss:; media-src 'none'; object-src 'none'; frame-src 'none';");
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('X-Display-Capture', 'deny');
  res.setHeader('X-Recording', 'deny');
  next();
});

// Store active sessions (minimal data)
const activeSessions = new Map();
const chatRooms = new Map();
const userContacts = new Map();

// Security monitoring
const securityEvents = new Map();
const screenshotAttempts = new Map();

const HEARTBEAT_INTERVAL = 15000;
const HEARTBEAT_TIMEOUT = 45000;
const roomMeta = new Map();

// Security event logging
function logSecurityEvent(eventType, userId, roomId, details = {}) {
  const event = {
    type: eventType,
    userId: userId,
    roomId: roomId,
    timestamp: Date.now(),
    details: details,
    ip: details.ip || 'unknown'
  };
  
  console.log(`🚨 SECURITY EVENT: ${eventType}`, event);
  
  // Store security event
  if (!securityEvents.has(userId)) {
    securityEvents.set(userId, []);
  }
  const userEvents = securityEvents.get(userId);
  userEvents.push(event);
  
  // Clean up old events (keep last 24 hours)
  const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
  const filteredEvents = userEvents.filter(e => e.timestamp > oneDayAgo);
  securityEvents.set(userId, filteredEvents);
}

// Screenshot attempt tracking
function trackScreenshotAttempt(userId, roomId, ip) {
  if (!screenshotAttempts.has(userId)) {
    screenshotAttempts.set(userId, {
      count: 0,
      firstAttempt: Date.now(),
      lastAttempt: Date.now(),
      roomId: roomId,
      ip: ip
    });
  }
  
  const attempts = screenshotAttempts.get(userId);
  attempts.count++;
  attempts.lastAttempt = Date.now();
  
  logSecurityEvent('SCREENSHOT_ATTEMPT', userId, roomId, {
    attemptCount: attempts.count,
    ip: ip,
    timeSinceFirst: Date.now() - attempts.firstAttempt
  });
  
  // If too many attempts, log as potential security breach
  if (attempts.count > 5) {
    logSecurityEvent('SECURITY_BREACH', userId, roomId, {
      reason: 'Multiple screenshot attempts',
      totalAttempts: attempts.count,
      ip: ip
    });
  }
}

// Security monitoring endpoint (rate limited)
app.post('/security/event', (req, res) => {
  try {
    const ip = getClientIp(req);
    if (!rateLimit(`sec:${ip}`)) {
      res.status(429).json({ error: 'Rate limit exceeded' });
      return;
    }

    const payload = req.body;
    if (!payload || typeof payload !== 'object' || !payload.eventType || !payload.userId) {
      res.status(400).json({ error: 'Invalid request body' });
      return;
    }

    const eventType = String(payload.eventType).trim();
    const userId = String(payload.userId).trim();
    const roomId = payload.roomId ? String(payload.roomId).trim() : '';
    const details = typeof payload.details === 'object' ? payload.details : {};

    logSecurityEvent(eventType, userId, roomId, { ...details, ip });
    res.status(200).json({ status: 'logged' });
  } catch (error) {
    console.error('Error processing security event:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Security status endpoint
app.get('/security/status', (req, res) => {
  const userId = req.query.userId;
  
  if (userId && securityEvents.has(userId)) {
    const events = securityEvents.get(userId);
    const recentEvents = events.filter(e => Date.now() - e.timestamp < 60000);
    
    res.json({
      userId: String(userId),
      totalEvents: events.length,
      recentEvents: recentEvents.length,
      hasBreaches: events.some(e => e.type === 'SECURITY_BREACH'),
      lastEvent: events[events.length - 1]
    });
  } else {
    res.json({ status: 'no_data' });
  }
});

// Generate room ID
function generateRoomId() {
  return crypto.randomBytes(16).toString('hex');
}

// Generate room encryption key
function generateRoomKey() {
  return crypto.randomBytes(16).toString('hex');
}

// Generate temporary user ID
function generateUserId() {
  return crypto.randomBytes(8).toString('hex');
}

// Max message payload size in bytes (approx 512KB)
const MAX_MESSAGE_PAYLOAD = 512 * 1024;
const MAX_SOCKET_RATE = 20;

io.on('connection', (socket) => {
  console.log('New connection:', socket.id);
  
  // Generate anonymous user ID
  const userId = generateUserId();
  const ip = socket.handshake?.address || socket.conn?.remoteAddress || 'unknown';
  const roomId = null;
  activeSessions.set(socket.id, {
    userId,
    roomId,
    connectedAt: Date.now(),
    messageCount: 0,
    ip
  });

  socket.emit('user-assigned', { userId });

  socket.on('set-codename', (data) => {
    try {
      const session = activeSessions.get(socket.id);
      if (!session) return;
      const codename = typeof data === 'object' && typeof data.codename === 'string' ? data.codename.trim().slice(0, 32) : '';
      session.codename = codename || ('User-' + userId.slice(0, 6));
      if (!userContacts.has(userId)) {
        userContacts.set(userId, { codename: session.codename, roomId: session.roomId });
      } else {
        userContacts.get(userId).codename = session.codename;
      }
      socket.emit('user-assigned', { userId, codename: session.codename });
      socket.to(session.roomId).emit('contacts-update', { userId, codename: session.codename });
    } catch (error) {
      console.error('Error setting codename:', error);
    }
  });
  socket.on('join-room', (data) => {
    try {
      const session = activeSessions.get(socket.id);
      if (!session) return;

      if (!data || typeof data.roomId !== 'string') {
        socket.emit('error', { message: 'Invalid room ID' });
        return;
      }

      let roomId = data.roomId.trim();
      if (roomId.length > 64) {
        socket.emit('error', { message: 'Room ID too long' });
        return;
      }

      // Create new room if none exists
      // If caller supplied a room ID, reuse it so all parties can meet in the same room.
      if (!chatRooms.has(roomId)) {
        const roomKey = generateRoomKey();
        chatRooms.set(roomId, {
          users: new Set(),
          messages: [],
          created: Date.now(),
          encryptionKey: roomKey,
          creatorId: userId
        });
      } else {
        const existing = chatRooms.get(roomId);
        if (existing.users.size >= 50) {
          socket.emit('error', { message: 'Room is full' });
          return;
        }
      }

      session.roomId = roomId;
      socket.join(roomId);
      
      const room = chatRooms.get(roomId);
      room.users.add(userId);

      const joinPayload = { 
        roomId,
        userCount: room.users.size,
        messages: room.messages.slice(-50),
        roomKey: room.encryptionKey,
        creatorId: room.creatorId
      };
      if (session.codename) joinPayload.codename = session.codename;
      const creatorSession = [...activeSessions.entries()].find(([, s]) => s.userId === room.creatorId);
      if (creatorSession && creatorSession[1].codename) {
        joinPayload.creatorCodename = creatorSession[1].codename;
      }

      socket.emit('room-joined', joinPayload);

      const meta = roomMeta.get(roomId) || { typing: new Map(), lastRead: new Map(), heartbeats: new Map() };
      roomMeta.set(roomId, meta);
      meta.lastRead.set(userId, Date.now());

      const userJoinedPayload = { 
        userId,
        userCount: room.users.size 
      };
      if (session.codename) userJoinedPayload.codename = session.codename;

      socket.to(roomId).emit('user-joined', userJoinedPayload);
    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  // Handle encrypted messages
  socket.on('send-message', (data) => {
    try {
      const session = activeSessions.get(socket.id);
      if (!session || !session.roomId) {
        socket.emit('error', { message: 'Not in a room' });
        return;
      }

      if (!data || typeof data !== 'object' || typeof data.encryptedContent !== 'string') {
        socket.emit('error', { message: 'Invalid message payload' });
        return;
      }

      // Rate limit per socket
      session.messageCount = (session.messageCount || 0) + 1;
      const now = Date.now();
      if (!session.rateWindow || now - session.rateWindow > 10000) {
        session.rateWindow = now;
        session.messageCount = 0;
      }
      if (session.messageCount > MAX_SOCKET_RATE) {
        socket.emit('error', { message: 'Rate limit exceeded' });
        return;
      }

      const payloadSize = Buffer.byteLength(data.encryptedContent || '', 'utf8');
      if (payloadSize > MAX_MESSAGE_PAYLOAD) {
        socket.emit('error', { message: 'Message too large' });
        return;
      }

      const room = chatRooms.get(session.roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      const message = {
        id: crypto.randomBytes(16).toString('hex'),
        userId: session.userId,
        encryptedContent: String(data.encryptedContent || '').slice(0, MAX_MESSAGE_PAYLOAD),
        timestamp: typeof data.timestamp === 'number' ? data.timestamp : Date.now(),
        signature: data.signature ? String(data.signature).slice(0, 512) : '',
        digitalSignature: data.digitalSignature ? String(data.digitalSignature).slice(0, 256) : '',
        method: data.method ? String(data.method).slice(0, 32) : 'unknown',
        salt: data.salt ? String(data.salt).slice(0, 128) : '',
        sequenceNumber: typeof data.sequenceNumber === 'number' ? data.sequenceNumber : 0,
        sessionId: data.sessionId ? String(data.sessionId).slice(0, 128) : '',
        messageType: (data.messageType === 'attachment' || data.messageType === 'location') ? data.messageType : 'text'
      };

      room.messages.push(message);
      
      // Keep only last 100 messages
      if (room.messages.length > 100) {
        room.messages = room.messages.slice(-100);
      }

      socket.to(session.roomId).emit('new-message', message);
      socket.emit('message-sent', { messageId: message.id, timestamp: message.timestamp });
    } catch (error) {
      console.error('Error handling message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Handle key rotation events
  socket.on('key-rotation', (data) => {
    const session = activeSessions.get(socket.id);
    if (!session || !session.roomId) return;

    if (!data || typeof data !== 'object') return;

    // Log key rotation for security monitoring
    console.log(`Key rotation in room ${session.roomId} by user ${session.userId}`);
    
    // Notify other users in the room about key rotation
    socket.to(session.roomId).emit('key-rotated', {
      userId: session.userId,
      sessionId: String(data.sessionId || '').slice(0, 128),
      timestamp: typeof data.timestamp === 'number' ? data.timestamp : Date.now()
    });
  });

  // Handle feedback messages
  socket.on('send-feedback', (data) => {
    const session = activeSessions.get(socket.id);
    if (!session || !session.roomId) return;

    if (!data || typeof data !== 'object' || !data.messageId || !data.type) {
      socket.emit('error', { message: 'Invalid feedback payload' });
      return;
    }

    const room = chatRooms.get(session.roomId);
    if (!room) return;

    const feedback = {
      id: crypto.randomBytes(16).toString('hex'),
      messageId: String(data.messageId).slice(0, 128),
      userId: session.userId,
      type: String(data.type).slice(0, 32),
      timestamp: Date.now()
    };

    // Broadcast feedback to room
    socket.to(session.roomId).emit('new-feedback', feedback);
  });

  socket.on('typing-start', (data) => {
    const session = activeSessions.get(socket.id);
    if (!session || !session.roomId || !data || !data.userId) return;
    socket.to(session.roomId).emit('typing-start', { userId: session.userId });
  });

  socket.on('typing-stop', (data) => {
    const session = activeSessions.get(socket.id);
    if (!session || !session.roomId || !data || !data.userId) return;
    socket.to(session.roomId).emit('typing-stop', { userId: session.userId });
  });

  socket.on('read-receipt', (data) => {
    const session = activeSessions.get(socket.id);
    if (!session || !session.roomId || !data || !data.messageId) return;
    socket.to(session.roomId).emit('read-receipt', {
      messageId: String(data.messageId),
      userId: session.userId,
      timestamp: Date.now()
    });
  });

  socket.on('heartbeat', () => {
    const session = activeSessions.get(socket.id);
    if (!session) return;
    session.lastHeartbeat = Date.now();
    session.userId = session.userId;
    
    if (session.roomId) {
      const meta = roomMeta.get(session.roomId);
      if (meta) {
        meta.heartbeats.set(session.userId, Date.now());
      }
    }
  });

  socket.on('reconnect-request', (data) => {
    const session = activeSessions.get(socket.id);
    if (!session || !data || !data.roomId) return;
    const roomId = String(data.roomId).trim();
    const room = chatRooms.get(roomId);
    if (!room) return;

    session.roomId = roomId;
    socket.join(roomId);
    room.users.add(session.userId);
    
    socket.emit('room-joined', {
      roomId,
      userCount: room.users.size,
      messages: room.messages.slice(-50),
      roomKey: room.encryptionKey,
      creatorId: room.creatorId
    });
  });

  // Handle end-room event
  socket.on('end-room', (data) => {
    try {
      const session = activeSessions.get(socket.id);
      if (!session || !session.roomId) return;
      const roomId = session.roomId;
      const room = chatRooms.get(roomId);
      if (!room) return;
      // Notify all users in the room
      io.to(roomId).emit('room-ended', { roomId });
      // Remove all users from the room
      room.users.forEach(uid => {
        for (const [sid, sess] of activeSessions.entries()) {
          if (sess.userId === uid) {
            activeSessions.get(sid).roomId = null;
          }
        }
      });
      // Delete the room
      chatRooms.delete(roomId);
    } catch (error) {
      console.error('Error ending room:', error);
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const session = activeSessions.get(socket.id);
    if (session && session.roomId) {
      const room = chatRooms.get(session.roomId);
      if (room) {
        room.users.delete(session.userId);
        
        // Remove room if empty
        if (room.users.size === 0) {
          chatRooms.delete(session.roomId);
          roomMeta.delete(session.roomId);
        } else {
          socket.to(session.roomId).emit('user-left', { 
            userId: session.userId,
            userCount: room.users.size 
          });
        }
      }
    }
    
    activeSessions.delete(socket.id);
    console.log('Disconnected:', socket.id);
  });
});

// Cleanup old rooms and sessions
setInterval(() => {
  const now = Date.now();
  
  // Clean up sessions older than 24 hours
  for (const [socketId, session] of activeSessions.entries()) {
    if (now - session.connectedAt > 24 * 60 * 60 * 1000) {
      activeSessions.delete(socketId);
    }
  }
  
  // Clean up rooms older than 7 days
  for (const [roomId, room] of chatRooms.entries()) {
    if (now - room.created > 7 * 24 * 60 * 60 * 1000) {
      chatRooms.delete(roomId);
      roomMeta.delete(roomId);
    }
  }

  // Clean up stale heartbeats
  for (const [roomId, meta] of roomMeta.entries()) {
    for (const [userId, ts] of meta.heartbeats.entries()) {
      if (now - ts > HEARTBEAT_TIMEOUT) {
        meta.heartbeats.delete(userId);
        const room = chatRooms.get(roomId);
        if (room) {
          room.users.delete(userId);
          io.to(roomId).emit('user-left', {
            userId,
            userCount: room.users.size
          });
          if (room.users.size === 0) {
            chatRooms.delete(roomId);
            roomMeta.delete(roomId);
          }
        }
      }
    }
  }
  
  // Clean up stale rate-limit entries
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}, 60 * 60 * 1000); // Run every hour

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // Listen on all network interfaces
server.listen(PORT, HOST, () => {
  console.log(`Back Channel server running on http://${HOST}:${PORT}`);
  console.log(`Local access: http://localhost:${PORT}`);
  console.log('Server configured for maximum privacy and security');
}); 