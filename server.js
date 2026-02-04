require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increased limit for base64 images

// Serve static files
app.use(express.static(path.join(__dirname)));

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const adminPassword = process.env.ADMIN_PASSWORD || 'Revent123';

// Storage bucket name
const STORAGE_BUCKET = 'signature-images';

let supabase = null;

if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('Supabase client initialized');

    // Initialize storage bucket (create if not exists)
    (async () => {
        try {
            const { data: buckets } = await supabase.storage.listBuckets();
            const bucketExists = buckets?.some(b => b.name === STORAGE_BUCKET);

            if (!bucketExists) {
                const { error } = await supabase.storage.createBucket(STORAGE_BUCKET, {
                    public: true,
                    fileSizeLimit: 1024 * 1024 // 1MB limit
                });
                if (error) {
                    console.warn('Could not create storage bucket:', error.message);
                    console.log('Please create a public bucket named "signature-images" in Supabase dashboard');
                } else {
                    console.log('Storage bucket created successfully');
                }
            } else {
                console.log('Storage bucket exists');
            }
        } catch (err) {
            console.warn('Storage bucket check failed:', err.message);
        }
    })();
} else {
    console.warn('Warning: Supabase credentials not configured. Using in-memory storage.');
}

// In-memory fallback storage (for development without Supabase)
let inMemorySettings = {
    awards: [],
    companyTagline: '',
    logoUrl: ''
};

// Helper: Upload base64 image to Supabase Storage
async function uploadImageToStorage(base64Data, folder = 'photos') {
    if (!supabase) {
        throw new Error('Supabase not configured');
    }

    // Extract the base64 content and mime type
    const matches = base64Data.match(/^data:image\/(png|jpeg|jpg|gif|webp);base64,(.+)$/);
    if (!matches) {
        throw new Error('Invalid base64 image format');
    }

    const imageType = matches[1];
    const base64Content = matches[2];
    const buffer = Buffer.from(base64Content, 'base64');

    // Generate unique filename
    const filename = `${folder}/${crypto.randomUUID()}.${imageType === 'jpeg' ? 'jpg' : imageType}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(filename, buffer, {
            contentType: `image/${imageType}`,
            upsert: false
        });

    if (error) {
        throw new Error(`Upload failed: ${error.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(filename);

    return urlData.publicUrl;
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

        if (!imageData) {
            return res.status(400).json({ error: 'No image data provided' });
        }

        if (!supabase) {
            // Fallback: return the base64 as-is (will work in preview but not in emails)
            return res.json({ url: imageData, warning: 'Using base64 fallback - images may not display in emails' });
        }

        const publicUrl = await uploadImageToStorage(imageData, 'photos');
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

        // Verify admin password
        if (password !== adminPassword) {
            return res.status(401).json({ error: 'Invalid admin password' });
        }

        if (!imageData) {
            return res.status(400).json({ error: 'No image data provided' });
        }

        if (!supabase) {
            // Fallback: return the base64 as-is
            return res.json({ url: imageData, warning: 'Using base64 fallback - images may not display in emails' });
        }

        const publicUrl = await uploadImageToStorage(imageData, 'awards');
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

        // Verify admin password
        if (password !== adminPassword) {
            return res.status(401).json({ error: 'Invalid admin password' });
        }

        if (!supabase || !imageUrl) {
            return res.json({ success: true }); // Nothing to delete
        }

        // Extract file path from URL
        const urlParts = imageUrl.split(`/storage/v1/object/public/${STORAGE_BUCKET}/`);
        if (urlParts.length === 2) {
            const filePath = urlParts[1];
            await supabase.storage.from(STORAGE_BUCKET).remove([filePath]);
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Delete image error:', error);
        res.status(500).json({ error: error.message || 'Failed to delete image' });
    }
});

// GET /api/storage-status - Check if storage is properly configured
app.get('/api/storage-status', async (req, res) => {
    try {
        if (!supabase) {
            return res.json({
                configured: false,
                message: 'Supabase not configured. Images will use base64 (may not work in emails).'
            });
        }

        // Check if bucket exists and is accessible
        const { data: buckets, error } = await supabase.storage.listBuckets();

        if (error) {
            return res.json({
                configured: false,
                message: `Storage error: ${error.message}`
            });
        }

        const bucket = buckets?.find(b => b.name === STORAGE_BUCKET);

        if (!bucket) {
            return res.json({
                configured: false,
                message: `Storage bucket "${STORAGE_BUCKET}" not found. Please create it in Supabase dashboard with public access enabled.`
            });
        }

        return res.json({
            configured: true,
            message: 'Storage configured correctly. Images will be hosted with public URLs.',
            bucketName: STORAGE_BUCKET
        });
    } catch (error) {
        res.json({
            configured: false,
            message: `Storage check failed: ${error.message}`
        });
    }
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
        console.log('Note: Running with in-memory storage. Configure SUPABASE_URL and SUPABASE_ANON_KEY for persistence.');
    }
});
