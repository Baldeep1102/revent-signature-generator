# Revent Email Signature Generator - Setup Guide

## Local Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and fill in your values:
```bash
cp .env.example .env
```

### 3. Set Up Supabase Database

1. Create a free account at [supabase.com](https://supabase.com)
2. Create a new project
3. Go to SQL Editor and run this query to create the settings table:

```sql
CREATE TABLE settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(50) UNIQUE NOT NULL,
    value JSONB,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert initial rows
INSERT INTO settings (key, value) VALUES ('awards', '[]');
INSERT INTO settings (key, value) VALUES ('companyTagline', '""');
```

4. Go to Settings > API and copy:
   - Project URL → `SUPABASE_URL`
   - anon/public key → `SUPABASE_ANON_KEY`

5. Update your `.env` file with these values

### 4. Run the Server
```bash
npm start
```

Visit:
- Generator: http://localhost:3000
- Admin Panel: http://localhost:3000/admin.html

## Deployment to Render.com

### 1. Push to GitHub
Make sure your code is pushed to a GitHub repository.

### 2. Create Render Web Service
1. Go to [render.com](https://render.com) and sign in
2. Click "New" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`

### 3. Add Environment Variables
In Render dashboard, add these environment variables:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Your Supabase anon key
- `ADMIN_PASSWORD` - Your admin password (e.g., `Revent123`)

### 4. Deploy
Render will automatically deploy when you push to your main branch.

## Testing

1. Open the main generator page
2. Fill in details and verify preview works
3. Open admin panel (`/admin.html`) in a different browser/incognito window
4. Log in and add an award or tagline
5. Refresh the main generator - settings should appear
6. Open in another device - settings should be visible globally
