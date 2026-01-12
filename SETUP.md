# How to Recreate this Project

## Prerequisites

- [Netlify](https://netlify.com) account
- [Virlo.ai](https://virlo.ai) API key
- [Firecrawl](https://firecrawl.dev) API key (optional)
- [Anthropic](https://anthropic.com) API key (optional, for AI alerts)

## Setup

1. Fork or clone this repository

2. Deploy to Netlify:
   ```bash
   netlify login
   netlify init
   netlify deploy --prod
   ```

3. Set environment variables in Netlify dashboard:
   - `VIRLO_API` - Your Virlo.ai API key
   - `FIREBASE_KEY` - Your Firecrawl API key
   - `CLAUDE_API` - Your Anthropic API key

4. Configure custom domain (optional):
   - Go to Site settings → Domain management
   - Add your custom domain

## Project Structure

```
├── index.html      # Main page
├── styles.css      # Styles
├── app.js          # Frontend logic
├── api/            # Netlify serverless functions
│   ├── trends.mjs
│   ├── comet-mamdani.mjs
│   ├── firecrawl-search.mjs
│   ├── nyc-311.mjs
│   ├── nyc-budget.mjs
│   ├── nyc-legislation.mjs
│   ├── nyc-mmr.mjs
│   └── changelog.mjs
└── netlify.toml    # Netlify config
```

## Data Sources

- [Virlo.ai](https://virlo.ai) - Trends and viral video tracking
- [Firecrawl](https://firecrawl.dev) - News search
- [Polymarket](https://polymarket.com) - Prediction markets
- [Kalshi](https://kalshi.com) - Prediction markets
- [NYC Open Data](https://data.cityofnewyork.us) - City data APIs
