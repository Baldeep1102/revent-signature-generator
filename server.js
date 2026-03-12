require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || 'https://ailab.revent.store/signature-generator';

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
['photos', 'awards'].forEach(f => {
    const d = path.join(uploadsDir, f);
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static files (including uploads/)
app.use(express.static(path.join(__dirname)));

// Initialize Supabase client (for settings storage)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const adminPassword = process.env.ADMIN_PASSWORD || 'Revent123';

let supabase = null;

if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('Supabase client initialized (for settings)');
} else {
    console.warn('Warning: Supabase credentials not configured. Using in-memory storage for settings.');
}

// In-memory fallback storage (for development without Supabase)
let inMemorySettings = {
    awards: [],
    companyTagline: '',
    logoUrl: ''
};

// Helper: Save base64 image to local disk, return public URL
async function saveImageLocally(base64Data, folder = 'photos') {
    const match = base64Data.match(/^data:image\/(\w+);base64,/);
    const ext = match ? match[1] : 'jpg';
    const filename = `${Date.now()}_${Math.random().toString(36).substr(2, 8)}.${ext}`;
    const filePath = path.join(uploadsDir, folder, filename);
    const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, '');
    fs.writeFileSync(filePath, Buffer.from(base64Content, 'base64'));
    return `${BASE_URL}/uploads/${folder}/${filename}`;
}

// Helper: Delete locally stored image
async function deleteImageLocally(imageUrl) {
    if (!imageUrl || imageUrl.startsWith('data:')) return;
    try {
        const urlPath = imageUrl.replace(`${BASE_URL}/`, '');
        const filePath = path.join(__dirname, urlPath);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (e) {
        console.warn('Could not delete image:', e.message);
    }
}

// GET /api/settings - Fetch current settings
app.get('/api/settings', async (req, res) => {
    try {
        if (supabase) {
            // Fetch from Supabase
            const { data, error } = await supabase
                .from('settings')
                .select('key, value');

            if (error) {
                console.error('Supabase fetch error:', error);
                throw error;
            }

            // Convert array of {key, value} to object
            const settings = {
                awards: [],
                companyTagline: '',
                logoUrl: ''
            };

            if (data) {
                data.forEach(row => {
                    if (row.key === 'awards') {
                        settings.awards = row.value || [];
                    } else if (row.key === 'companyTagline') {
                        settings.companyTagline = row.value || '';
                    } else if (row.key === 'logoUrl') {
                        settings.logoUrl = row.value || '';
                    }
                });
            }

            res.json(settings);
        } else {
            // Fallback to in-memory storage
            res.json(inMemorySettings);
        }
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

// POST /api/settings - Update settings (requires admin password)
app.post('/api/settings', async (req, res) => {
    try {
        const { password, awards, companyTagline, logoUrl } = req.body;

        // Verify admin password
        if (password !== adminPassword) {
            return res.status(401).json({ error: 'Invalid admin password' });
        }

        if (supabase) {
            // Update awards in Supabase
            if (awards !== undefined) {
                const { error: awardsError } = await supabase
                    .from('settings')
                    .upsert(
                        { key: 'awards', value: awards, updated_at: new Date().toISOString() },
                        { onConflict: 'key' }
                    );

                if (awardsError) {
                    console.error('Supabase awards update error:', awardsError);
                    throw awardsError;
                }
            }

            // Update tagline in Supabase
            if (companyTagline !== undefined) {
                const { error: taglineError } = await supabase
                    .from('settings')
                    .upsert(
                        { key: 'companyTagline', value: companyTagline, updated_at: new Date().toISOString() },
                        { onConflict: 'key' }
                    );

                if (taglineError) {
                    console.error('Supabase tagline update error:', taglineError);
                    throw taglineError;
                }
            }

            // Update logo URL in Supabase
            if (logoUrl !== undefined) {
                const { error: logoError } = await supabase
                    .from('settings')
                    .upsert(
                        { key: 'logoUrl', value: logoUrl, updated_at: new Date().toISOString() },
                        { onConflict: 'key' }
                    );

                if (logoError) {
                    console.error('Supabase logo URL update error:', logoError);
                    throw logoError;
                }
            }
        } else {
            // Fallback to in-memory storage
            if (awards !== undefined) {
                inMemorySettings.awards = awards;
            }
            if (companyTagline !== undefined) {
                inMemorySettings.companyTagline = companyTagline;
            }
            if (logoUrl !== undefined) {
                inMemorySettings.logoUrl = logoUrl;
            }
        }

        res.json({ success: true, message: 'Settings updated successfully' });
    } catch (error) {
        console.error('Error updating settings:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

// POST /api/verify-password - Verify admin password
app.post('/api/verify-password', (req, res) => {
    const { password } = req.body;

    if (password === adminPassword) {
        res.json({ valid: true });
    } else {
        res.status(401).json({ valid: false, error: 'Invalid password' });
    }
});

// POST /api/upload-photo - Upload profile photo and get public URL
app.post('/api/upload-photo', async (req, res) => {
    try {
        const { imageData } = req.body;
        if (!imageData) return res.status(400).json({ error: 'No image data provided' });
        const publicUrl = await saveImageLocally(imageData, 'photos');
        res.json({ url: publicUrl });
    } catch (error) {
        console.error('Photo upload error:', error);
        res.status(500).json({ error: error.message || 'Failed to upload photo' });
    }
});

// POST /api/upload-award - Upload award image and get public URL (requires admin password)
app.post('/api/upload-award', async (req, res) => {
    try {
        const { password, imageData } = req.body;
        if (password !== adminPassword) return res.status(401).json({ error: 'Invalid admin password' });
        if (!imageData) return res.status(400).json({ error: 'No image data provided' });
        const publicUrl = await saveImageLocally(imageData, 'awards');
        res.json({ url: publicUrl });
    } catch (error) {
        console.error('Award upload error:', error);
        res.status(500).json({ error: error.message || 'Failed to upload award' });
    }
});

// DELETE /api/delete-image - Delete image from storage (requires admin password)
app.delete('/api/delete-image', async (req, res) => {
    try {
        const { password, imageUrl } = req.body;
        if (password !== adminPassword) return res.status(401).json({ error: 'Invalid admin password' });
        await deleteImageLocally(imageUrl);
        res.json({ success: true });
    } catch (error) {
        console.error('Delete image error:', error);
        res.status(500).json({ error: error.message || 'Failed to delete image' });
    }
});

// GET /api/storage-status - Check if storage is properly configured
app.get('/api/storage-status', (req, res) => {
    res.json({
        configured: true,
        message: 'Local VPS storage active. Images served from this server with permanent public URLs.',
        provider: 'Local'
    });
});

// Serve index.html for root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve admin.html
app.get('/admin.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Admin panel: http://localhost:${PORT}/admin.html`);
    if (!supabase) {
        console.log('Note: Supabase not configured. Settings will use in-memory storage.');
    }
    console.log('Note: Using local VPS file storage for images.');
});
