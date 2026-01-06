# Monitor Mamdani - Live Terminal Feed

A 90s Bloomberg terminal-style website displaying live trend alerts from Virlo.ai API.

## Features

- **Retro Terminal Aesthetic**: Black background with neon green/cyan/yellow accents
- **Stock Ticker Marquee**: Continuous scrolling "MONITOR MAMDANI" header
- **Live Trend Feed**: Real-time alerts from Virlo.ai with severity indicators
- **Auto-refresh**: Polls API every 45 seconds for new data
- **Responsive Design**: Works on desktop and mobile devices
- **Secure API Integration**: Serverless function keeps API key secure

## Project Structure

```
monitormamdani/
├── index.html          # Main HTML page
├── styles.css          # Terminal aesthetic styles
├── app.js             # Frontend JavaScript (polling & rendering)
├── api/
│   └── trends.js      # Serverless API endpoint (Vercel/Netlify)
├── assets/
│   ├── images.png     # Hero image (you need to add this)
│   └── README.txt     # Asset instructions
└── README.md          # This file
```

## Setup Instructions

### 1. Add Your Image

Copy your hero image to `/assets/images.png`:

```bash
# Example: Copy from your source location
cp /path/to/your/image.png assets/images.png
```

The source image should be copied from:
```
/mnt/data/user-VxWBU8kCc3BP4OPgB1SQibU3/5a81c834823a4c4d865104d7c743c943/mnt/data/images.png
```

### 2. Local Development

For local testing, you can use a simple HTTP server:

```bash
# Using Python
python -m http.server 8000

# Using Node.js (http-server)
npx http-server -p 8000

# Then visit: http://localhost:8000
```

**Note:** The API endpoint will return errors locally unless you set up a local serverless environment.

### 3. Deploy to Vercel

#### Install Vercel CLI

```bash
npm install -g vercel
```

#### Set Up Environment Variable

Create a `.env` file (do NOT commit this):

```env
VIRLO_API=your_virlo_api_key_here
```

Or set it in Vercel dashboard:
1. Go to your project settings
2. Navigate to "Environment Variables"
3. Add `VIRLO_API` with your Virlo.ai API key

#### Deploy

```bash
# Login to Vercel
vercel login

# Deploy (first time)
vercel

# Deploy to production
vercel --prod
```

#### Configure Environment Variable via CLI

```bash
vercel env add VIRLO_API
# Enter your API key when prompted
# Select Production, Preview, and Development environments
```

### 4. Deploy to Netlify

#### Install Netlify CLI

```bash
npm install -g netlify-cli
```

#### Configure for Netlify

Create `netlify.toml`:

```toml
[build]
  publish = "."
  functions = "api"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200
```

#### Deploy

```bash
# Login to Netlify
netlify login

# Initialize site
netlify init

# Set environment variable
netlify env:set VIRLO_API "your_virlo_api_key_here"

# Deploy
netlify deploy --prod
```

### 5. Custom Domain Setup (monitormamdani.com)

#### For Vercel:

1. Go to your project in Vercel dashboard
2. Click "Settings" → "Domains"
3. Add `monitormamdani.com` and `www.monitormamdani.com`
4. Update your DNS records:

```
Type    Name    Value                           TTL
A       @       76.76.21.21                     3600
CNAME   www     cname.vercel-dns.com.           3600
```

#### For Netlify:

1. Go to "Site settings" → "Domain management"
2. Add custom domain: `monitormamdani.com`
3. Update your DNS records:

```
Type    Name    Value                               TTL
A       @       75.2.60.5                          3600
CNAME   www     your-site-name.netlify.app.        3600
```

#### DNS Configuration at Your Registrar:

1. Log into your domain registrar (GoDaddy, Namecheap, etc.)
2. Find DNS management/settings
3. Add the A and CNAME records shown above
4. Wait 15 minutes to 48 hours for DNS propagation

## API Integration

### Virlo.ai API Endpoint

The `/api/trends` serverless function calls:
```
GET https://api.virlo.ai/v1/trends
Authorization: Bearer YOUR_API_KEY
```

### API Response Format

The endpoint normalizes Virlo.ai data into:

```json
{
  "updatedAt": "2026-01-05T12:00:00Z",
  "items": [
    {
      "ts": "2026-01-05T11:30:00Z",
      "severity": "hot",
      "title": "Trending Topic Title",
      "metric": "Score: 1.2M | Growth: +150%",
      "source": "Virlo.ai",
      "url": "https://example.com"
    }
  ]
}
```

### Severity Levels

- **HOT** (red): High growth/volume, pulsing animation
- **SPIKE** (orange): Significant increase
- **NEW** (yellow): New trending topic
- **TRENDING** (cyan): General trending item

## Testing

### Test Local Setup

1. Start local server: `python -m http.server 8000`
2. Visit `http://localhost:8000`
3. Check browser console for errors
4. API will show connection error (expected without serverless function)

### Test API Endpoint

After deploying to Vercel/Netlify:

```bash
# Test the API endpoint
curl https://your-site.vercel.app/api/trends

# Should return JSON with updatedAt and items array
```

### Test with Real Data

1. Set `VIRLO_API` environment variable
2. Deploy to Vercel/Netlify
3. Visit your site
4. Feed should populate within 5 seconds
5. Status should show "LIVE" in green

## Customization

### Change Polling Interval

Edit `app.js`:

```javascript
const POLL_INTERVAL = 45000; // Change to desired milliseconds
```

### Change Max Items

Edit `app.js`:

```javascript
const MAX_ITEMS = 50; // Change to desired limit
```

### Modify Colors

Edit `styles.css` color variables:
- Background: `#000000`
- Primary green: `#00ff00`
- Cyan: `#00ffff`
- Yellow: `#ffff00`
- Red: `#ff0000`

## Troubleshooting

### API Not Loading

1. Check environment variable is set: `vercel env ls`
2. Verify API key is valid in Virlo.ai dashboard
3. Check browser console for errors
4. Test API endpoint directly: `/api/trends`

### Image Not Showing

1. Verify file exists at `/assets/images.png`
2. Check file permissions
3. Clear browser cache
4. Check browser console for 404 errors

### Deployment Issues

```bash
# Vercel: Check logs
vercel logs

# Netlify: Check logs
netlify logs
```

## Performance

- **Initial Load**: ~2-3 seconds
- **API Poll**: Every 45 seconds
- **Max Items**: 50 (configurable)
- **Cache**: 30 second stale-while-revalidate

## Security

- ✅ API key stored in environment variable
- ✅ No API key in frontend code
- ✅ XSS protection via HTML escaping
- ✅ HTTPS enforced on production
- ✅ Dofollow links to Virlo.ai (as requested)

## Credits

**Data powered by Virlo.ai** - Advanced trend analysis and viral content detection.

Visit: [https://virlo.ai](https://virlo.ai)

## License

© 2026 Monitor Mamdani. All rights reserved.
