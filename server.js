import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// App Storage JSON file path
const DATA_DIR = path.join(__dirname, 'data');
const CONTACT_FILE = path.join(DATA_DIR, 'contactReceived.json');
const MEDIA_CONFIG_FILE = path.join(DATA_DIR, 'mediaConfig.json');
const UPLOADS_DIR = path.join(__dirname, 'assets', 'images', 'uploads');

// Admin credentials
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// Active in-memory session tokens for Admin authentication
const activeAdminTokens = new Set();

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Helper: Ensure data directory, uploads directory and contactReceived.json exist
function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  if (!fs.existsSync(CONTACT_FILE)) {
    fs.writeFileSync(CONTACT_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
  if (!fs.existsSync(MEDIA_CONFIG_FILE)) {
    fs.writeFileSync(MEDIA_CONFIG_FILE, JSON.stringify({ overrides: {} }, null, 2), 'utf-8');
  }
}

// Helper: Read media configuration
function readMediaConfig() {
  try {
    ensureDataFile();
    const data = fs.readFileSync(MEDIA_CONFIG_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    return parsed && typeof parsed === 'object' ? parsed : { overrides: {} };
  } catch (err) {
    console.error('Error reading mediaConfig.json:', err);
    return { overrides: {} };
  }
}

// Helper: Write media configuration
function writeMediaConfig(config) {
  ensureDataFile();
  fs.writeFileSync(MEDIA_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

// Helper: Read submissions from data/contactReceived.json
function readSubmissions() {
  try {
    ensureDataFile();
    const data = fs.readFileSync(CONTACT_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Error reading contactReceived.json:', err);
    return [];
  }
}

// Helper: Write submissions to data/contactReceived.json
function writeSubmissions(submissions) {
  ensureDataFile();
  fs.writeFileSync(CONTACT_FILE, JSON.stringify(submissions, null, 2), 'utf-8');
}

// Admin Authentication Middleware
function requireAdminAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const tokenHeader = req.headers['x-admin-token'];
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (tokenHeader) {
    token = tokenHeader.trim();
  }

  if (token && activeAdminTokens.has(token)) {
    return next();
  }

  return res.status(401).json({
    error: 'Unauthorized. Admin password authentication required.',
  });
}

// ==========================================
// Public API Endpoints
// ==========================================

// POST /api/contact - Handle contact form submissions
app.post('/api/contact', (req, res) => {
  try {
    const { firstName, lastName, email, reason, message } = req.body;

    // Validation
    if (!firstName || typeof firstName !== 'string' || !firstName.trim()) {
      return res.status(400).json({ error: 'First Name is required.' });
    }
    if (!lastName || typeof lastName !== 'string' || !lastName.trim()) {
      return res.status(400).json({ error: 'Last Name is required.' });
    }
    if (!email || typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ error: 'A valid email address is required.' });
    }

    const validReasons = ['Comment', 'Question', 'Partnership', 'Opportunity', 'Other'];
    if (!reason || !validReasons.includes(reason.trim())) {
      return res.status(400).json({
        error: `Reason for Contact must be one of: ${validReasons.join(', ')}`,
      });
    }

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message cannot be empty.' });
    }

    // Read current submissions
    const submissions = readSubmissions();

    // Create new record
    const newSubmission = {
      id: crypto.randomUUID ? crypto.randomUUID() : 'msg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      reason: reason.trim(),
      message: message.trim(),
      submittedAt: new Date().toISOString(),
      replied: false,
      repliedAt: null,
    };

    // Append and save
    submissions.push(newSubmission);
    writeSubmissions(submissions);

    // Return saved record with HTTP 201
    return res.status(201).json(newSubmission);
  } catch (err) {
    console.error('Failed to save contact submission:', err);
    return res.status(500).json({ error: 'Internal storage error. Please try again.' });
  }
});

// ==========================================
// Admin API Endpoints
// ==========================================

// POST /api/admin/login - Authenticate with admin password
app.post('/api/admin/login', (req, res) => {
  if (!ADMIN_PASSWORD) {
    return res.status(503).json({ error: 'Admin access is not configured.' });
  }
  const { password } = req.body;
  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Password is required.' });
  }

  if (password.trim() === ADMIN_PASSWORD.trim()) {
    const token = crypto.randomBytes(32).toString('hex');
    activeAdminTokens.add(token);
    return res.status(200).json({
      success: true,
      message: 'Authentication successful.',
      token,
    });
  }

  return res.status(401).json({
    success: false,
    error: 'Incorrect admin password.',
  });
});

// POST /api/admin/logout - Invalidate admin session token
app.post('/api/admin/logout', requireAdminAuth, (req, res) => {
  const authHeader = req.headers['authorization'];
  const tokenHeader = req.headers['x-admin-token'];
  const token = (authHeader && authHeader.startsWith('Bearer '))
    ? authHeader.substring(7).trim()
    : tokenHeader?.trim();

  if (token) {
    activeAdminTokens.delete(token);
  }
  return res.status(200).json({ success: true, message: 'Logged out successfully.' });
});

// GET /api/admin/messages - Retrieve contact messages (newest first)
app.get('/api/admin/messages', requireAdminAuth, (req, res) => {
  try {
    const submissions = readSubmissions();
    // Sort newest first based on submittedAt
    const sorted = [...submissions].sort((a, b) => {
      return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
    });
    return res.status(200).json(sorted);
  } catch (err) {
    console.error('Failed to retrieve messages:', err);
    return res.status(500).json({ error: 'Failed to retrieve messages.' });
  }
});

// PATCH /api/admin/messages/:id/replied - Mark message as replied
app.patch('/api/admin/messages/:id/replied', requireAdminAuth, (req, res) => {
  try {
    const { id } = req.params;
    const submissions = readSubmissions();
    const index = submissions.findIndex((m) => m.id === id);

    if (index === -1) {
      return res.status(404).json({ error: 'Message not found.' });
    }

    submissions[index].replied = true;
    submissions[index].repliedAt = new Date().toISOString();

    writeSubmissions(submissions);

    return res.status(200).json(submissions[index]);
  } catch (err) {
    console.error('Failed to update message:', err);
    return res.status(500).json({ error: 'Failed to update message.' });
  }
});

// POST /api/upload-portrait - Upload exact original portrait image
app.post('/api/upload-portrait', requireAdminAuth, (req, res) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'Image data is required.' });
    }

    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const targetPath = path.join(__dirname, 'assets', 'images', 'student-portrait.jpg');

    fs.writeFileSync(targetPath, buffer);
    console.log(`Updated student-portrait.jpg successfully (${buffer.length} bytes)`);

    return res.status(200).json({
      success: true,
      message: 'Photo updated successfully.',
      imageUrl: `/assets/images/student-portrait.jpg?t=${Date.now()}`
    });
  } catch (err) {
    console.error('Failed to upload portrait:', err);
    return res.status(500).json({ error: 'Failed to save uploaded image.' });
  }
});

// GET /api/media - Get current custom media gallery overrides
app.get('/api/media', (req, res) => {
  try {
    const config = readMediaConfig();
    return res.status(200).json(config);
  } catch (err) {
    console.error('Failed to get media config:', err);
    return res.status(500).json({ error: 'Failed to get media configuration.' });
  }
});

// POST /api/media/update - Update an image or metadata on the media page
app.post('/api/media/update', requireAdminAuth, (req, res) => {
  try {
    const { cardId, imageSrc, title, caption, badge } = req.body;
    if (!cardId || typeof cardId !== 'string') {
      return res.status(400).json({ error: 'Card identifier is required.' });
    }

    ensureDataFile();
    const config = readMediaConfig();
    if (!config.overrides) {
      config.overrides = {};
    }

    let finalSrc = imageSrc;

    // Check if imageSrc is a base64 data URI
    if (imageSrc && typeof imageSrc === 'string' && imageSrc.startsWith('data:')) {
      const matches = imageSrc.match(/^data:([A-Za-z0-9-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const mimeType = matches[1].toLowerCase();
        const base64Data = matches[2];
        const buffer = Buffer.from(base64Data, 'base64');

        // Determine extension
        let ext = 'jpg';
        if (mimeType.includes('png')) ext = 'png';
        else if (mimeType.includes('webp')) ext = 'webp';
        else if (mimeType.includes('gif')) ext = 'gif';
        else if (mimeType.includes('svg')) ext = 'svg';
        else if (mimeType.includes('mp4') || mimeType.includes('video')) ext = 'mp4';

        const safeCardId = cardId.replace(/[^a-zA-Z0-9_-]/g, '');
        const filename = `${safeCardId}-${Date.now()}.${ext}`;
        const filePath = path.join(UPLOADS_DIR, filename);
        fs.writeFileSync(filePath, buffer);

        finalSrc = `assets/images/uploads/${filename}`;
      }
    }

    // Update config entry
    const existing = config.overrides[cardId] || {};
    config.overrides[cardId] = {
      ...existing,
      ...(finalSrc ? { src: finalSrc } : {}),
      ...(title !== undefined && title !== null ? { title: title.trim() } : {}),
      ...(caption !== undefined && caption !== null ? { caption: caption.trim() } : {}),
      ...(badge !== undefined && badge !== null ? { badge: badge.trim() } : {}),
      updatedAt: new Date().toISOString(),
    };

    writeMediaConfig(config);

    return res.status(200).json({
      success: true,
      message: 'Media image updated successfully.',
      item: config.overrides[cardId],
      overrides: config.overrides,
    });
  } catch (err) {
    console.error('Failed to update media item:', err);
    return res.status(500).json({ error: 'Failed to update media item.' });
  }
});

// POST /api/media/reset - Reset a card or all cards back to defaults
app.post('/api/media/reset', requireAdminAuth, (req, res) => {
  try {
    const { cardId, all } = req.body;
    ensureDataFile();
    const config = readMediaConfig();
    if (!config.overrides) config.overrides = {};

    if (all) {
      config.overrides = {};
    } else if (cardId && config.overrides[cardId]) {
      delete config.overrides[cardId];
    }

    writeMediaConfig(config);

    return res.status(200).json({
      success: true,
      message: all ? 'All media images reset to defaults.' : 'Media image reset to default.',
      overrides: config.overrides,
    });
  } catch (err) {
    console.error('Failed to reset media config:', err);
    return res.status(500).json({ error: 'Failed to reset media configuration.' });
  }
});

// ==========================================
// Static File Serving & Page Routing
// ==========================================

// Serve only public files. The project root also contains private contact data
// and server configuration, so it must not be exposed as a static directory.
app.use('/assets', express.static(path.join(__dirname, 'assets')));
const PUBLIC_FILES = new Set([
  'index.html', 'media.html', 'future.html', 'projects.html',
  'hobbies.html', 'community.html', 'athletics.html', 'admin.html',
  'styles.css', 'script.js', 'admin.js',
]);
app.get('/:file', (req, res, next) => {
  if (!PUBLIC_FILES.has(req.params.file)) return next();
  res.sendFile(path.join(__dirname, req.params.file));
});

// Explicit route fallbacks for clean navigation
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});
app.get('/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});
app.get('/media.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'media.html'));
});
app.get('/future.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'future.html'));
});
app.get('/projects.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'projects.html'));
});
app.get(['/hobbies.html', '/hobbies'], (req, res) => {
  res.sendFile(path.join(__dirname, 'hobbies.html'));
});
app.get(['/community.html', '/community'], (req, res) => {
  res.redirect(301, '/hobbies.html');
});
app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Initialize App Storage and start server
ensureDataFile();

app.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
  console.log(`Contact data storage: ${CONTACT_FILE}`);
});
