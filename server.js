require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || 'https://ailab.revent.store/signature-generator';
const adminPassword = process.env.ADMIN_PASSWORD || 'Revent123';

// Ensure uploads directories exist
const uploadsDir = path.join(__dirname, 'uploads');
['photos', 'awards', 'logos'].forEach(f => {
    const d = path.join(uploadsDir, f);
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// Settings stored in local JSON file
const SETTINGS_FILE = path.join(__dirname, 'settings.json');
function readSettings() {
    if (!fs.existsSync(SETTINGS_FILE)) {
        return { awards: [], companyTagline: '', logoUrl: '' };
    }
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
}
function writeSettings(data) {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

// Helper: Save base64 image to local disk, return public URL
function saveImageLocally(base64Data, folder = 'photos') {
    const match = base64Data.match(/^data:image\/(\w+);base64,/);
    const ext = match ? match[1] : 'jpg';
    const filename = `${Date.now()}_${Math.random().toString(36).substr(2, 8)}.${ext}`;
    const filePath = path.join(uploadsDir, folder, filename);
    const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, '');
    fs.writeFileSync(filePath, Buffer.from(base64Content, 'base64'));
    return `${BASE_URL}/uploads/${folder}/${filename}`;
}

// Helper: Delete locally stored image
function deleteImageLocally(imageUrl) {
    if (!imageUrl || imageUrl.startsWith('data:')) return;
    try {
        const urlPath = imageUrl.replace(`${BASE_URL}/`, '');
        const filePath = path.join(__dirname, urlPath);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (e) {
        console.warn('Could not delete image:', e.message);
    }
}

// GET /api/settings
app.get('/api/settings', (req, res) => {
    try {
        res.json(readSettings());
    } catch (err) {
        res.status(500).json({ error: 'Failed to read settings' });
    }
});

// POST /api/settings
app.post('/api/settings', (req, res) => {
    try {
        const { password, awards, companyTagline, logoUrl } = req.body;
        if (password !== adminPassword) return res.status(401).json({ error: 'Invalid admin password' });
        const current = readSettings();
        const updated = {
            awards: awards !== undefined ? awards : current.awards,
            companyTagline: companyTagline !== undefined ? companyTagline : current.companyTagline,
            logoUrl: logoUrl !== undefined ? logoUrl : current.logoUrl,
        };
        writeSettings(updated);
        res.json({ success: true, message: 'Settings updated successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to save settings' });
    }
});

// POST /api/verify-password
app.post('/api/verify-password', (req, res) => {
    const { password } = req.body;
    if (password === adminPassword) {
        res.json({ valid: true });
    } else {
        res.status(401).json({ valid: false, error: 'Invalid password' });
    }
});

// POST /api/upload-photo
app.post('/api/upload-photo', (req, res) => {
    try {
        const { imageData } = req.body;
        if (!imageData) return res.status(400).json({ error: 'No image data provided' });
        const publicUrl = saveImageLocally(imageData, 'photos');
        res.json({ url: publicUrl });
    } catch (err) {
        res.status(500).json({ error: err.message || 'Failed to upload photo' });
    }
});

// POST /api/upload-award
app.post('/api/upload-award', (req, res) => {
    try {
        const { password, imageData } = req.body;
        if (password !== adminPassword) return res.status(401).json({ error: 'Invalid admin password' });
        if (!imageData) return res.status(400).json({ error: 'No image data provided' });
        const publicUrl = saveImageLocally(imageData, 'awards');
        res.json({ url: publicUrl });
    } catch (err) {
        res.status(500).json({ error: err.message || 'Failed to upload award' });
    }
});

// POST /api/upload-logo
app.post('/api/upload-logo', (req, res) => {
    try {
        const { password, imageData } = req.body;
        if (password !== adminPassword) return res.status(401).json({ error: 'Invalid admin password' });
        if (!imageData) return res.status(400).json({ error: 'No image data provided' });
        const publicUrl = saveImageLocally(imageData, 'logos');
        res.json({ url: publicUrl });
    } catch (err) {
        res.status(500).json({ error: err.message || 'Failed to upload logo' });
    }
});

// DELETE /api/delete-image
app.delete('/api/delete-image', (req, res) => {
    try {
        const { password, imageUrl } = req.body;
        if (password !== adminPassword) return res.status(401).json({ error: 'Invalid admin password' });
        deleteImageLocally(imageUrl);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message || 'Failed to delete image' });
    }
});

// GET /api/storage-status
app.get('/api/storage-status', (req, res) => {
    res.json({
        configured: true,
        message: 'Local VPS storage active. Images served with permanent public URLs.',
        provider: 'Local'
    });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/admin.html', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('Storage: local VPS file system');
});
