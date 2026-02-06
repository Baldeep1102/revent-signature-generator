require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const cloudinary = require('cloudinary').v2;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increased limit for base64 images

// Serve static files
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

// Initialize Cloudinary (for image storage)
const cloudinaryConfigured = process.env.CLOUDINARY_CLOUD_NAME &&
                              process.env.CLOUDINARY_API_KEY &&
                              process.env.CLOUDINARY_API_SECRET;

if (cloudinaryConfigured) {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });
    console.log('Cloudinary configured for image storage');
} else {
    console.warn('Warning: Cloudinary credentials not configured. Image uploads will use base64 fallback.');
}

// In-memory fallback storage (for development without Supabase)
let inMemorySettings = {
    awards: [],
    companyTagline: '',
    logoUrl: ''
};

// Helper: Upload base64 image to Cloudinary
async function uploadImageToCloudinary(base64Data, folder = 'photos') {
    if (!cloudinaryConfigured) {
        throw new Error('Cloudinary not configured');
    }

    // Cloudinary accepts base64 data URIs directly
    const result = await cloudinary.uploader.upload(base64Data, {
        folder: `signatures/${folder}`,
        resource_type: 'image'
    });

    return result.secure_url;
}

// Helper: Delete image from Cloudinary
async function deleteImageFromCloudinary(imageUrl) {
    if (!cloudinaryConfigured || !imageUrl) {
        return;
    }

    // Extract public_id from Cloudinary URL
    // URL format: https://res.cloudinary.com/cloud_name/image/upload/v123/signatures/folder/public_id.ext
    const matches = imageUrl.match(/\/signatures\/(.+)\.[a-z]+$/i);
    if (matches) {
        const publicId = `signatures/${matches[1]}`;
        await cloudinary.uploader.destroy(publicId);
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

        if (!imageData) {
            return res.status(400).json({ error: 'No image data provided' });
        }

        if (!cloudinaryConfigured) {
            // Fallback: return the base64 as-is (will work in preview but not in emails)
            return res.json({ url: imageData, warning: 'Using base64 fallback - images may not display in emails' });
        }

        const publicUrl = await uploadImageToCloudinary(imageData, 'photos');
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

        if (!cloudinaryConfigured) {
            // Fallback: return the base64 as-is
            return res.json({ url: imageData, warning: 'Using base64 fallback - images may not display in emails' });
        }

        const publicUrl = await uploadImageToCloudinary(imageData, 'awards');
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

        if (!cloudinaryConfigured || !imageUrl) {
            return res.json({ success: true }); // Nothing to delete
        }

        await deleteImageFromCloudinary(imageUrl);
        res.json({ success: true });
    } catch (error) {
        console.error('Delete image error:', error);
        res.status(500).json({ error: error.message || 'Failed to delete image' });
    }
});

// GET /api/storage-status - Check if storage is properly configured
app.get('/api/storage-status', async (req, res) => {
    try {
        if (!cloudinaryConfigured) {
            return res.json({
                configured: false,
                message: 'Cloudinary not configured. Images will use base64 (may not work in emails).'
            });
        }

        return res.json({
            configured: true,
            message: 'Cloudinary configured. Images will be hosted with permanent public URLs.',
            provider: 'Cloudinary'
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
        console.log('Note: Supabase not configured. Settings will use in-memory storage.');
    }
    if (!cloudinaryConfigured) {
        console.log('Note: Cloudinary not configured. Images will use base64 fallback.');
    }
});
