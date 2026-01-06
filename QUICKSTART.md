# Quick Start Guide - Monitor Mamdani

Get your site running in 5 minutes!

## Step 1: Add Your Image

```bash
# Copy your image to the assets folder
cp /mnt/data/user-VxWBU8kCc3BP4OPgB1SQibU3/5a81c834823a4c4d865104d7c743c943/mnt/data/images.png assets/images.png
```

## Step 2: Local Preview

```bash
# Quick local server (no API functionality)
python -m http.server 8000

# Visit: http://localhost:8000
```

## Step 3: Deploy to Vercel (Recommended)

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
vercel

# Set API key
vercel env add VIRLO_API
# Paste your Virlo.ai API key when prompted

# Deploy to production
vercel --prod
```

## Step 4: Configure Domain

### In Vercel Dashboard:
1. Go to Settings → Domains
2. Add `monitormamdani.com`
3. Copy the DNS records shown

### At Your Domain Registrar:
1. Go to DNS settings
2. Add these records:

```
Type    Name    Value                   TTL
A       @       76.76.21.21            3600
CNAME   www     cname.vercel-dns.com.  3600
```

3. Save and wait 15-60 minutes for DNS propagation

## Done! 🎉

Your site should be live at:
- Vercel URL: `https://your-project.vercel.app`
- Custom domain: `https://monitormamdani.com` (after DNS propagation)

## Verify Everything Works

1. ✅ Ticker scrolls at top
2. ✅ Image displays in center
3. ✅ "Data by Virlo.ai" links work (top and bottom)
4. ✅ Feed shows "LIVE" status in green
5. ✅ Trend items appear in the feed
6. ✅ Auto-refreshes every 45 seconds

## Troubleshooting

**Feed shows "CONNECTING..." or "ERROR":**
- Check API key is set: `vercel env ls`
- Verify API key at https://virlo.ai/dashboard
- Check browser console for error messages

**Image not showing:**
- Verify file exists: `ls assets/images.png`
- Check file size (should be reasonable, < 2MB)
- Clear browser cache

**Domain not working:**
- Wait longer (DNS can take 24-48 hours)
- Verify DNS records at your registrar
- Check DNS propagation: https://dnschecker.org

## Need Help?

See [README.md](README.md) for full documentation.
