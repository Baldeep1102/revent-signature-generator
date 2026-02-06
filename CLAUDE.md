# Revent Email Signature Generator

## Overview
A web app that generates professional email signatures for Revent employees. Users fill in their details (name, title, email, phone, etc.) and get a formatted HTML signature they can paste into Gmail or other email clients.

## Tech Stack
- **Backend:** Node.js + Express
- **Frontend:** Vanilla HTML/CSS/JavaScript (no build step)
- **Settings Storage:** Supabase (PostgreSQL) - stores awards, tagline, logo URL
- **Image Storage:** Cloudinary - hosts profile photos and award images with permanent URLs
- **Deployment:** Railway (auto-deploys from GitHub)

## Key Architecture Decisions

### Why Cloudinary for Images?
- Email signatures need permanently accessible image URLs
- Supabase Storage free tier pauses after inactivity, breaking image links
- Railway/Render free tiers don't guarantee uptime
- Cloudinary provides reliable, permanent URLs (e.g., `https://res.cloudinary.com/...`)

### Why Supabase for Settings?
- Lightweight key-value storage for admin settings
- Settings data is small and doesn't have the same uptime requirements as images
- Free tier is sufficient for this use case

## Environment Variables (Railway)
```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=xxx
ADMIN_PASSWORD=xxx
CLOUDINARY_CLOUD_NAME=xxx
CLOUDINARY_API_KEY=xxx
CLOUDINARY_API_SECRET=xxx
```

## Project Structure
```
├── server.js          # Express backend with API routes
├── index.html         # Main signature generator page
├── admin.html         # Admin panel for awards/settings
├── app.js             # Frontend JavaScript
├── styles.css         # Styling
├── package.json       # Dependencies (Node >= 20 required)
└── CLAUDE.md          # This file
```

## API Endpoints
- `GET /api/settings` - Fetch awards, tagline, logo URL
- `POST /api/settings` - Update settings (requires admin password)
- `POST /api/verify-password` - Verify admin password
- `POST /api/upload-photo` - Upload profile photo to Cloudinary
- `POST /api/upload-award` - Upload award image to Cloudinary (admin only)
- `DELETE /api/delete-image` - Delete image from Cloudinary (admin only)
- `GET /api/storage-status` - Check if Cloudinary is configured

## Deployment
- **Hosted on:** Railway
- **GitHub repo:** https://github.com/Baldeep1102/revent-signature-generator
- Push to `main` branch triggers auto-deploy

## Features
- Profile photo upload with circular crop
- Live signature preview
- Copy signature to clipboard (works with Gmail paste)
- Admin panel for managing company awards and tagline
- Gmail setup guide for non-technical users

## Dark Mode Note
For the company logo to display correctly in Gmail dark mode, use a PNG/JPG with a white background baked in (not transparent).
