# Monitor Mamdani - Complete Deployment Summary

## What This Site Does

Monitors **Zohran Mamdani** across social media platforms (TikTok, YouTube, Instagram, Twitter, Facebook) using Virlo's Comet API to track:

- Campaign mentions
- Policy discussions (rent freeze, affordable housing, etc.)
- Viral content
- Public engagement

## Project Structure

```
monitormamdani/
├── index.html                      # Main page
├── styles.css                      # Bloomberg terminal aesthetic (50% larger)
├── app.js                          # Frontend (polls Comet every 60s)
├── api/
│   ├── comet/
│   │   └── mamdani.js             # Virlo Comet endpoint (NEW!)
│   └── trends.js                  # Legacy trends endpoint (not used)
├── assets/
│   └── images.png                 # Hero image (you need to add this)
├── netlify.toml                   # Netlify config
├── vercel.json                    # Vercel config
└── Documentation files
```

## Environment Variables Required

**On Netlify:**

Only **ONE** variable needed:

- `VIRLO_API` - Your Virlo.ai API key

### How to Set

**Via Netlify Dashboard:**
1. Site settings → Environment variables
2. Add: `VIRLO_API` = your key
3. Scopes: Production, Deploy Previews, Branch deploys
4. Save & redeploy

**Via CLI:**
```bash
netlify env:set VIRLO_API "your_key_here"
```

## Deployment Steps

### 1. Add Your Image

```bash
# Copy your image
cp /path/to/your/image.png c:\Users\nicol\OneDrive\Desktop\monitormamdani\assets\images.png
```

### 2. Deploy to Netlify

**Option A: Drag & Drop**
1. Go to https://app.netlify.com
2. Drag `monitormamdani` folder onto dashboard
3. Wait for deployment
4. Set `VIRLO_API` in environment variables
5. Trigger redeploy

**Option B: CLI**
```bash
cd c:\Users\nicol\OneDrive\Desktop\monitormamdani

# Login
netlify login

# Deploy
netlify init
netlify env:set VIRLO_API "your_key"
netlify deploy --prod
```

### 3. Connect Domain

1. Netlify dashboard → Domain settings
2. Add custom domain: `monitormamdani.com`
3. If DNS already on Netlify, it connects automatically
4. Wait 15-60 minutes for SSL certificate

## API Endpoints

### Comet Endpoint (Active)

**POST /api/comet/mamdani**

Monitors Zohran Mamdani across social media:

**Request:**
```json
{
  "minViews": 10000,
  "timeWindow": 7,
  "platforms": ["tiktok", "youtube", "instagram", "twitter", "facebook"]
}
```

**Response:**
```json
{
  "updatedAt": "2026-01-05T12:00:00Z",
  "items": [{
    "ts": "2026-01-05T11:30:00Z",
    "severity": "hot",
    "title": "Video title",
    "metric": "Views: 1.2M | Likes: 85K",
    "source": "TikTok",
    "url": "https://..."
  }]
}
```

**Keywords Monitored (20 total):**
1. zohran mamdani
2. mayor zohran mamdani
3. mamdani mayor
4. rent freeze NYC
5. freeze the rent NYC
6. affordable housing NYC
7. fare free buses NYC
8. free bus NYC
9. department of community safety NYC
10. city-owned grocery stores NYC
11. bad landlords NYC
12. office of mass engagement
13. Zohran Office
14. zohran for mayor
15. mamdani for mayor
16. NYC mayor race
17. queens politician
18. astoria representative
19. NYC progressive
20. socialist mayor NYC

### Legacy Endpoint (Not Used)

**GET /api/trends** - Still exists but frontend doesn't call it

## Frontend Behavior

### Polling

- Calls `/api/comet/mamdani` every **60 seconds**
- Shows newest content first
- Displays up to 50 items
- Auto-refreshes status indicator

### Display

**Feed Table Columns:**
- TIME - When posted
- TYPE - Severity tag (HOT, SPIKE, NEW, TRENDING)
- TREND - Video/post title
- METRIC - Views, likes, engagement stats
- SOURCE - Platform (TikTok, YouTube, etc.)
- LINK - Arrow icon to view original

### Status Indicator

- **CONNECTING...** - Initial load
- **FETCHING...** - Updating data
- **LIVE** - Active and working (green dot blinking)
- **ERROR** - Connection failed

## Design

### 90s Bloomberg Terminal Aesthetic

- Near-black background (#050607)
- Restrained amber accents (#ffb000)
- Monospace fonts
- Subtle CRT scanlines
- Table-style data feed
- Sharp corners, no gradients

### Size

All components scaled **50% larger** to fill modern screens:
- Base font: 19.5px
- Container: 1560px max-width
- Feed: 600-1200px height

## Testing

### Local Preview

Open [index.local.html](index.local.html) for mock data preview (no API needed)

### Test Comet Endpoint

After deploying:

```bash
# Test the API
curl -X POST https://monitormamdani.com/api/comet/mamdani \
  -H "Content-Type: application/json" \
  -d '{"minViews": 5000}'

# Should return JSON with items array
```

### Verify Feed

1. Visit https://monitormamdani.com
2. Check status shows "LIVE" in green
3. Verify feed populates within 5 seconds
4. Wait 60 seconds, verify it auto-refreshes
5. Test on mobile

## Troubleshooting

### Feed shows "ERROR"

```bash
# Check environment variable
netlify env:list

# Should show VIRLO_API

# Check function logs
netlify functions:log comet/mamdani
```

### No Results in Feed

Possible causes:
1. **No matching content** - Try lowering `minViews` threshold
2. **Time window too narrow** - Increase `timeWindow` to 14 days
3. **API key invalid** - Verify at https://virlo.ai/dashboard

### Image Not Loading

```bash
# Verify image exists
ls assets/images.png

# Redeploy
netlify deploy --prod
```

## Performance

- **Polling frequency:** 60 seconds
- **Server cache:** 45 seconds
- **Max items:** 50
- **Platforms:** 5 (TikTok, YouTube, Instagram, Twitter, Facebook)
- **Keywords:** 20

## Security

✅ **API Key Protection:**
- Stored in `process.env.VIRLO_API`
- Never exposed to frontend
- All Virlo calls server-side only

✅ **Other Security:**
- HTTPS enforced
- XSS protection via HTML escaping
- CORS headers properly set
- No inline scripts

## Customization

### Adjust Polling Interval

Edit [app.js](app.js):
```javascript
const POLL_INTERVAL = 120000; // 2 minutes
```

### Change Minimum Views

Edit [app.js](app.js):
```javascript
body: JSON.stringify({
  minViews: 5000  // Lower threshold
})
```

### Add/Remove Keywords

Edit [api/comet/mamdani.js](api/comet/mamdani.js):
```javascript
const keywords = [
  'zohran mamdani',
  // Add your keywords here
];
```

### Platform Selection

Edit [app.js](app.js):
```javascript
platforms: ['tiktok', 'youtube']  // Only these platforms
```

## Documentation

- **[COMET_ENDPOINT.md](COMET_ENDPOINT.md)** - Detailed Comet API docs
- **[README.md](README.md)** - General project overview
- **[NETLIFY_DEPLOY.md](NETLIFY_DEPLOY.md)** - Netlify deployment guide
- **[QUICKSTART.md](QUICKSTART.md)** - 5-minute quick start

## What's Next

After deployment:

1. ✅ Monitor feed for relevant content
2. ✅ Adjust `minViews` if too many/few results
3. ✅ Add more keywords as campaign evolves
4. ✅ Consider adding alerts for viral content
5. ✅ Track API usage in Virlo dashboard

## Success Checklist

- [ ] Image added to `/assets/images.png`
- [ ] `VIRLO_API` set on Netlify
- [ ] Deployed to production
- [ ] Domain `monitormamdani.com` connected
- [ ] Feed loads and shows "LIVE"
- [ ] Results appear (or empty if no matching content)
- [ ] Auto-refresh works (60s)
- [ ] Mobile responsive
- [ ] No console errors

## Support

- **Netlify:** https://docs.netlify.com
- **Virlo Comet:** https://virlo.ai/docs/comet
- **This project:** See documentation files above

---

**Project:** Monitor Mamdani
**Purpose:** Track Zohran Mamdani social media presence
**Tech:** Virlo Comet + Netlify Functions
**Status:** ✅ Ready for deployment
**Updated:** 2026-01-05
