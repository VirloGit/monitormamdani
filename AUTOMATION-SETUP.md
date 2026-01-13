# Email Automation Setup Guide

This document explains the automated email system for Monitor Mamdani using Buttondown and Supabase.

## System Overview

The automation consists of two main features:

1. **Weekly Digest** - Sends a summary of notable alerts every Sunday to `weekly_digest` subscribers
2. **Breaking Alerts** - Monitors prediction markets every 15 minutes and sends instant alerts for 10%+ price changes to `breaking_alerts` subscribers

## Architecture

### Components

1. **Supabase Database** - Stores:
   - Notable alerts history
   - Market price snapshots
   - Breaking alerts sent log (to prevent duplicates)

2. **Netlify Functions** - API endpoints for:
   - `/api/save-alert` - Save notable alerts to database
   - `/api/save-market-snapshot` - Record market prices
   - `/api/check-breaking-alerts` - Detect and send breaking alerts
   - `/api/send-weekly-digest` - Send Sunday digest

3. **GitHub Actions** - Automated cron jobs:
   - `market-monitor.yml` - Runs every 15 minutes
   - `weekly-digest.yml` - Runs Sundays at 9 AM UTC

4. **Buttondown** - Email delivery service

## Setup Instructions

### 1. Supabase Setup

✅ **Already completed:**
- Created `notable_alerts` table
- Created `market_history` table
- Created `breaking_alerts_sent` table
- Added Supabase credentials to Netlify environment

### 2. Netlify Environment Variables

✅ **Already configured:**
- `BUTTDOWN_API` - Buttondown API key
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_KEY` - Your Supabase anon/public key

### 3. GitHub Actions

The workflows are now in `.github/workflows/`:
- `market-monitor.yml` - Monitors markets every 15 minutes
- `weekly-digest.yml` - Sends digest every Sunday

**Next step:** Push these files to enable GitHub Actions.

## How It Works

### Weekly Digest Flow

1. **Sunday 9 AM UTC**: GitHub Action triggers
2. Calls `/api/send-weekly-digest`
3. Fetches all unsent alerts from previous Mon-Fri
4. Groups alerts by type (TREND, OPPORTUNITY, RISK, MOMENTUM)
5. Formats email with bullet points
6. Sends via Buttondown to `weekly_digest` tag
7. Marks alerts as `sent_in_digest: true`

### Breaking Alerts Flow

1. **Every 15 minutes**: GitHub Action triggers
2. Fetches current Polymarket + Kalshi data
3. Saves snapshots to `market_history` table
4. Compares current prices to 1-hour-ago prices
5. If change ≥ 10%:
   - Checks if alert already sent today
   - Sends email via Buttondown to `breaking_alerts` tag
   - Records in `breaking_alerts_sent` table

## Manual Testing

### Test Weekly Digest
```bash
curl -X POST https://monitormamdani.com/api/send-weekly-digest \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Test Breaking Alerts
First save some market data, then check:
```bash
# Save current market state
curl https://monitormamdani.com/api/polymarket > markets.json
curl -X POST https://monitormamdani.com/api/save-market-snapshot \
  -H "Content-Type: application/json" \
  -d @markets.json

# Check for breaking alerts (after 1 hour)
curl -X POST https://monitormamdani.com/api/check-breaking-alerts \
  -H "Content-Type: application/json" \
  -d @markets.json
```

## Monitoring

### Check GitHub Actions
- Go to your repo → Actions tab
- View workflow runs and logs

### Check Supabase Data
- `notable_alerts` - View saved alerts
- `market_history` - View price snapshots
- `breaking_alerts_sent` - View sent alerts log

### Check Buttondown
- Dashboard → Emails to see sent emails
- Subscribers → Tags to see subscriber counts

## Configuration

### Adjust Breaking Alert Threshold
Edit `/api/check-breaking-alerts.mjs`:
```javascript
const PRICE_CHANGE_THRESHOLD = 0.10; // 10% = 0.10
const LOOKBACK_HOURS = 1;
```

### Adjust Check Frequency
Edit `.github/workflows/market-monitor.yml`:
```yaml
schedule:
  - cron: '*/15 * * * *'  # Every 15 minutes
```

### Adjust Digest Schedule
Edit `.github/workflows/weekly-digest.yml`:
```yaml
schedule:
  - cron: '0 9 * * 0'  # Sunday 9 AM UTC
```

## Troubleshooting

### Alerts not being saved
- Check Netlify function logs
- Verify SUPABASE_URL and SUPABASE_KEY are set correctly

### Breaking alerts not sending
- Check that market data is being saved (query `market_history` table)
- Verify BUTTDOWN_API key is correct
- Check Buttondown dashboard for failed emails

### Weekly digest not sending
- Verify alerts exist in `notable_alerts` with `sent_in_digest: false`
- Check GitHub Actions logs for errors
- Ensure date range logic is correct (Mon-Fri of previous week)

## Next Steps

1. **Push to GitHub** to enable Actions
2. **Test manually** using curl commands above
3. **Monitor first week** to ensure everything works
4. **Adjust thresholds** based on volume/quality of alerts

## Email Templates

### Breaking Alert Format
```
Subject: 🚨 Breaking: [Market Title] 📈 [X.X]%

Market Alert

[Market Title] has moved **X.X%** up in the last hour.

- Previous: XX.X%
- Current: XX.X%

[View Market](url)
```

### Weekly Digest Format
```
Subject: 📊 Informed on Zohran - Week of Mon X - Fri Y

# Informed on Zohran
**Weekly Digest: Mon X - Fri Y**

## 📈 Trends
- **Title**: Description

## 💡 Opportunities
- **Title**: Description

## ⚠️ Risks
- **Title**: Description

## 🚀 Momentum
- **Title**: Description
```
