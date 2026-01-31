require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

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

let supabase = null;

if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('Supabase client initialized');
} else {
    console.warn('Warning: Supabase credentials not configured. Using in-memory storage.');
}

// In-memory fallback storage (for development without Supabase)
let inMemorySettings = {
    awards: [],
    companyTagline: '',
    logoUrl: ''
};

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
