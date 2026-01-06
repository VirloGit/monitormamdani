# Virlo Comet Endpoint - Monitor Zohran Mamdani

## Overview

The site now uses Virlo's **Comet** feature to monitor social media content about Zohran Mamdani across multiple platforms.

## Backend Endpoint

**Path:** `POST /api/comet/mamdani`

**Security:**
- ✅ API key stored in `process.env.VIRLO_API`
- ✅ Not exposed in frontend
- ✅ All Virlo calls happen server-side

### Request Body (Optional)

All parameters have sensible defaults:

```json
{
  "minViews": 10000,
  "timeWindow": 7,
  "platforms": ["tiktok", "youtube", "instagram", "twitter", "facebook"]
}
```

### Monitored Keywords (Priority Order)

The endpoint monitors these keywords (max 20):

1. "zohran mamdani"
2. "mayor zohran mamdani"
3. "mamdani mayor"
4. "rent freeze NYC"
5. "freeze the rent NYC"
6. "affordable housing NYC"
7. "fare free buses NYC"
8. "free bus NYC"
9. "department of community safety NYC"
10. "city-owned grocery stores NYC"
11. "bad landlords NYC"
12. "office of mass engagement"
13. "Zohran Office"
14. "zohran for mayor"
15. "mamdani for mayor"
16. "NYC mayor race"
17. "queens politician"
18. "astoria representative"
19. "NYC progressive"
20. "socialist mayor NYC"

### Platforms Monitored

- TikTok
- YouTube
- Instagram
- Twitter
- Facebook

### Response Format

Returns normalized data:

```json
{
  "updatedAt": "2026-01-05T12:00:00Z",
  "items": [
    {
      "ts": "2026-01-05T11:30:00Z",
      "severity": "hot",
      "title": "Zohran Mamdani announces rent freeze plan",
      "metric": "Views: 1.2M | Likes: 85K | Comments: 12K",
      "source": "TikTok",
      "url": "https://tiktok.com/@example/video/123"
    }
  ]
}
```

### Severity Levels

Determined by engagement metrics:

- **HOT**: Views > 1M OR Engagement > 100K OR ER > 10%
- **SPIKE**: Views > 500K OR Engagement > 50K OR ER > 5%
- **NEW**: Published < 24 hours ago
- **TRENDING**: Everything else

## Frontend Integration

### Polling

The frontend polls the endpoint every **60 seconds**:

```javascript
// app.js
const POLL_INTERVAL = 60000; // 60 seconds

fetch('/api/comet/mamdani', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    minViews: 10000,
    timeWindow: 7,
    platforms: ['tiktok', 'youtube', 'instagram', 'twitter', 'facebook']
  })
})
```

### Display

Results are shown in the LIVE FEED panel with:
- Timestamp
- Severity tag
- Title/caption
- Engagement metrics
- Platform source
- Link to original content

## Configuration

### Adjust Minimum Views

```javascript
// In frontend (app.js)
body: JSON.stringify({
  minViews: 5000  // Lower threshold for more results
})
```

### Adjust Time Window

```javascript
body: JSON.stringify({
  timeWindow: 14  // Last 14 days instead of 7
})
```

### Platform Selection

```javascript
body: JSON.stringify({
  platforms: ['tiktok', 'youtube']  // Only TikTok and YouTube
})
```

## API Implementation

The endpoint calls Virlo Comet API:

```javascript
POST https://api.virlo.ai/v1/comet

Headers:
  Authorization: Bearer YOUR_API_KEY
  Content-Type: application/json

Body:
{
  "topic": "Zohran Mamdani",
  "keywords": [...],
  "platforms": [...],
  "timeWindow": 7,
  "minViews": 10000,
  "sortBy": "engagement",
  "limit": 50
}
```

## Caching

- Server-side cache: 45 seconds (`s-maxage=45`)
- Stale-while-revalidate enabled
- Frontend poll: 60 seconds

This means:
- CDN serves cached data for 45s
- After 45s, CDN fetches fresh data
- Frontend checks every 60s for updates

## Error Handling

The endpoint handles:
- Missing API key → 500 error
- Virlo API errors → Logged and returned with empty items
- Network errors → Caught and returned with error message

Example error response:

```json
{
  "error": "Failed to fetch Comet data",
  "message": "Virlo Comet API error: 401 Unauthorized",
  "updatedAt": "2026-01-05T12:00:00Z",
  "items": []
}
```

## Testing

### Local Test

The endpoint requires the Virlo API to work, so local testing needs:

1. Set `VIRLO_API` in environment
2. Deploy to Netlify or use `netlify dev`

```bash
# Using Netlify dev
netlify dev

# Visit: http://localhost:8888
```

### Test on Netlify

After deploying:

```bash
# Test the endpoint
curl -X POST https://monitormamdani.com/api/comet/mamdani \
  -H "Content-Type: application/json" \
  -d '{"minViews": 5000, "timeWindow": 7}'
```

## Monitoring

Track performance in:
- Netlify Functions logs
- Browser DevTools Network tab
- Virlo.ai API dashboard (usage metrics)

## Files Modified

1. **[api/comet/mamdani.js](api/comet/mamdani.js)** - New Comet endpoint
2. **[app.js](app.js)** - Updated to call Comet endpoint (60s polling)
3. **[index.html](index.html)** - Updated titles and refresh interval

## Migration Notes

### From General Trends to Comet

**Before:**
- Endpoint: `GET /api/trends`
- Generic trend data
- 45 second polling

**After:**
- Endpoint: `POST /api/comet/mamdani`
- Zohran Mamdani-specific monitoring
- 60 second polling
- Configurable parameters

The old `/api/trends` endpoint still exists but is no longer used by the frontend.

## Next Steps

Potential enhancements:

1. **Add more keywords** as campaign evolves
2. **Adjust minViews threshold** based on typical engagement
3. **Add sentiment analysis** if Virlo Comet supports it
4. **Filter by creator type** (news, influencers, voters, etc.)
5. **Add trending hashtags** related to campaign
6. **Geographic filtering** (NYC-specific content)

## Support

- Virlo Comet API: https://virlo.ai/docs/comet
- Questions: Contact Virlo.ai support

---

**Updated:** 2026-01-05
**Status:** ✅ Production ready
**Monitoring:** Zohran Mamdani campaign content
