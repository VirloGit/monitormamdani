# Netlify Deployment Guide - Monitor Mamdani

Since you already own monitormamdani.com on Netlify, deployment is straightforward!

## Quick Deploy (3 Steps)

### Step 1: Add Your Image (1 minute)

Copy your image to the assets folder:

```bash
# From your current location
cp /mnt/data/user-VxWBU8kCc3BP4OPgB1SQibU3/5a81c834823a4c4d865104d7c743c943/mnt/data/images.png assets/images.png
```

### Step 2: Deploy via Netlify CLI (2 minutes)

```bash
# Install Netlify CLI (if not installed)
npm install -g netlify-cli

# Login to Netlify
netlify login

# Initialize and deploy
netlify init

# Follow prompts:
# - Team: Select your team
# - Site name: monitormamdani (or let it auto-generate)
# - Build command: (leave empty)
# - Directory to deploy: . (current directory)

# Set your Virlo.ai API key
netlify env:set VIRLO_API "your_virlo_api_key_here"

# Deploy to production
netlify deploy --prod
```

### Step 3: Connect Your Domain

Since you already own the domain on Netlify:

1. Go to Netlify dashboard: https://app.netlify.com
2. Select your site
3. Go to **Domain settings**
4. Click **Add custom domain**
5. Enter: `monitormamdani.com`
6. If DNS is already configured on Netlify, it should connect automatically!

**Done!** Your site is live at https://monitormamdani.com

---

## Alternative: Deploy via Netlify Dashboard (Drag & Drop)

If you prefer the visual interface:

1. **Prepare the site:**
   ```bash
   # Make sure your image is in /assets/images.png
   ls assets/images.png
   ```

2. **Go to Netlify:** https://app.netlify.com

3. **Drag & Drop:**
   - Drag the entire `monitormamdani` folder onto the Netlify dashboard
   - Or click "Add new site" → "Deploy manually"
   - Upload the folder

4. **Set Environment Variable:**
   - Go to Site settings → Environment variables
   - Add: `VIRLO_API` = your Virlo.ai API key
   - Click "Save"

5. **Redeploy:**
   - Go to Deploys tab
   - Click "Trigger deploy" → "Deploy site"

6. **Connect Domain:**
   - Go to Domain settings
   - Add `monitormamdani.com`

---

## Alternative: Deploy via Git (Recommended for Updates)

### Option A: GitHub

```bash
# Initialize git repo
cd c:\Users\nicol\OneDrive\Desktop\monitormamdani
git init
git add .
git commit -m "Initial commit: Monitor Mamdani site"

# Create repo on GitHub, then:
git remote add origin https://github.com/yourusername/monitormamdani.git
git push -u origin main
```

Then in Netlify:
1. Go to "Add new site" → "Import an existing project"
2. Connect to GitHub
3. Select your repository
4. Build settings:
   - Build command: (leave empty)
   - Publish directory: `.`
5. Add environment variable: `VIRLO_API`
6. Deploy!

### Option B: Netlify Git

```bash
# Link to Netlify directly
netlify init

# Follow prompts to connect to Git
# Then push changes:
git add .
git commit -m "Update site"
git push

# Netlify auto-deploys on push!
```

---

## Testing Your Deployment

### 1. Test the API Endpoint

```bash
# After deployment, test the API
curl https://monitormamdani.com/api/trends

# Should return JSON with trends data
```

### 2. Check All Features

- [ ] Visit https://monitormamdani.com
- [ ] Ticker scrolls at top
- [ ] Image displays correctly
- [ ] Both "Data by Virlo.ai" links work
- [ ] Feed loads (status shows "LIVE" in green)
- [ ] Wait 45 seconds, verify auto-refresh
- [ ] Test on mobile device
- [ ] Check browser console (no errors)

---

## Netlify Configuration

Your site is already configured with [netlify.toml](netlify.toml):

```toml
[build]
  publish = "."
  functions = "api"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200
```

This tells Netlify:
- Publish the root directory
- Use `/api` folder for serverless functions
- Redirect `/api/*` to serverless functions

---

## Environment Variables

### Set via CLI:

```bash
netlify env:set VIRLO_API "your_key_here"
```

### Set via Dashboard:

1. Go to Site settings
2. Click "Environment variables"
3. Click "Add a variable"
4. Key: `VIRLO_API`
5. Value: Your Virlo.ai API key
6. Save

### Verify:

```bash
netlify env:list
```

---

## Domain DNS (If Not Already Configured)

If your domain DNS isn't already pointing to Netlify:

### At Your Domain Registrar:

**Option 1: Netlify DNS (Recommended)**
- Update nameservers to Netlify's
- Let Netlify manage everything

**Option 2: External DNS**
- Add these records:
  ```
  Type: A       Name: @    Value: 75.2.60.5
  Type: CNAME   Name: www  Value: your-site.netlify.app
  ```

---

## Troubleshooting

### API Returns 500 Error

```bash
# Check environment variable is set
netlify env:list

# Check function logs
netlify functions:log trends

# Or check in dashboard:
# Site → Functions → trends → View logs
```

### Feed Not Loading

1. Check browser console for errors
2. Test API directly: `/api/trends`
3. Verify `VIRLO_API` is set
4. Check Netlify function logs

### Image Not Showing

```bash
# Verify image exists
ls assets/images.png

# Redeploy
netlify deploy --prod
```

### Domain Not Working

1. Check domain settings in Netlify dashboard
2. Verify SSL certificate is active
3. Wait for DNS propagation (can take 24-48 hours)
4. Check: https://dnschecker.org

---

## Local Testing with Netlify Dev

To test serverless functions locally:

```bash
# Install dependencies (if needed)
npm install

# Start Netlify dev server
netlify dev

# Visit: http://localhost:8888
# The API endpoint will work locally!
```

This runs your serverless functions locally so you can test the full integration.

---

## Updating Your Site

### Via CLI:

```bash
# Make changes to files
# Then:
netlify deploy --prod
```

### Via Git (if connected):

```bash
git add .
git commit -m "Update site"
git push

# Netlify auto-deploys!
```

### Via Dashboard:

- Drag and drop updated folder
- Or trigger manual deploy

---

## Monitoring

### Check Site Status:

```bash
netlify status
```

### View Logs:

```bash
# Function logs
netlify functions:log trends

# Deploy logs
netlify logs
```

### Dashboard:

- Analytics: See traffic stats
- Functions: Monitor API calls
- Deploys: View deploy history

---

## Performance

Netlify provides:
- ✅ Global CDN (fast worldwide)
- ✅ Auto HTTPS/SSL
- ✅ Continuous deployment
- ✅ Instant rollbacks
- ✅ Free tier (100GB bandwidth, 300 build minutes)

---

## Commands Cheat Sheet

```bash
# Login
netlify login

# Initialize site
netlify init

# Set environment variable
netlify env:set VIRLO_API "your_key"

# List environment variables
netlify env:list

# Deploy (draft)
netlify deploy

# Deploy (production)
netlify deploy --prod

# Test locally
netlify dev

# Check status
netlify status

# View function logs
netlify functions:log trends

# Open dashboard
netlify open

# Open site in browser
netlify open:site
```

---

## Success Checklist

- [ ] Image added to `/assets/images.png`
- [ ] Deployed to Netlify
- [ ] `VIRLO_API` environment variable set
- [ ] Domain `monitormamdani.com` connected
- [ ] SSL certificate active (HTTPS)
- [ ] Site loads correctly
- [ ] Feed shows "LIVE" status
- [ ] API endpoint working
- [ ] Mobile responsive
- [ ] No console errors

---

## Next Steps

1. Test locally with `netlify dev`
2. Deploy with `netlify deploy --prod`
3. Connect domain `monitormamdani.com`
4. Monitor performance in dashboard

---

**Need Help?**

- Netlify Docs: https://docs.netlify.com
- Netlify Support: https://answers.netlify.com
- Virlo.ai Support: https://virlo.ai/support

---

**Project Location:**
```
c:\Users\nicol\OneDrive\Desktop\monitormamdani
```

**Ready to deploy!** 🚀
