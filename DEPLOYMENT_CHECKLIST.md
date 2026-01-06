# Deployment Checklist for Monitor Mamdani

Use this checklist to ensure everything is ready for production.

## Pre-Deployment

### 1. Image Setup
- [ ] Copy image to `/assets/images.png`
- [ ] Verify image loads in browser
- [ ] Check file size (< 2MB recommended)
- [ ] Test on mobile devices

### 2. Virlo.ai API Access
- [ ] Have Virlo.ai API key ready
- [ ] Test API key works (curl test if possible)
- [ ] Know API endpoint: https://api.virlo.ai/v1/trends
- [ ] Understand API rate limits

### 3. Domain Preparation
- [ ] Have access to domain registrar (where you bought monitormamdani.com)
- [ ] Know how to edit DNS records
- [ ] Decide on www redirect (recommend: www → non-www)

## Deployment Steps

### 4. Choose Hosting Platform

**Option A: Vercel (Recommended)**
- [ ] Install Vercel CLI: `npm install -g vercel`
- [ ] Login: `vercel login`
- [ ] Deploy: `vercel`
- [ ] Set API key: `vercel env add VIRLO_API`
- [ ] Deploy to production: `vercel --prod`

**Option B: Netlify**
- [ ] Install Netlify CLI: `npm install -g netlify-cli`
- [ ] Login: `netlify login`
- [ ] Initialize: `netlify init`
- [ ] Set API key: `netlify env:set VIRLO_API "your_key"`
- [ ] Deploy: `netlify deploy --prod`

### 5. Test Deployment
- [ ] Visit deployment URL (e.g., yourproject.vercel.app)
- [ ] Verify ticker scrolls at top
- [ ] Check image displays correctly
- [ ] Confirm CTA links work (top and bottom)
- [ ] Verify feed loads (status shows "LIVE" in green)
- [ ] Wait 45 seconds, verify auto-refresh works
- [ ] Check on mobile device
- [ ] Test in different browsers (Chrome, Firefox, Safari)

### 6. Configure Custom Domain

**In Hosting Dashboard:**
- [ ] Add domain: monitormamdani.com
- [ ] Add www subdomain: www.monitormamdani.com (optional)
- [ ] Note the DNS records provided

**At Domain Registrar:**

For Vercel:
- [ ] Add A record: @ → 76.76.21.21
- [ ] Add CNAME record: www → cname.vercel-dns.com
- [ ] Save changes

For Netlify:
- [ ] Add A record: @ → 75.2.60.5
- [ ] Add CNAME record: www → yoursite.netlify.app
- [ ] Save changes

### 7. Wait for DNS Propagation
- [ ] Wait 15 minutes minimum
- [ ] Check DNS propagation: https://dnschecker.org
- [ ] Test with different devices/networks
- [ ] Full propagation can take up to 48 hours

### 8. SSL Certificate
- [ ] Verify HTTPS works automatically (Vercel/Netlify handle this)
- [ ] Check for SSL warnings in browser
- [ ] Ensure all resources load over HTTPS

## Post-Deployment

### 9. Final Testing
- [ ] Visit https://monitormamdani.com
- [ ] Test all features again:
  - [ ] Ticker scrolls
  - [ ] Image displays
  - [ ] CTAs link to Virlo.ai (verify dofollow)
  - [ ] Feed loads and shows data
  - [ ] Auto-refresh works
  - [ ] Mobile responsive
  - [ ] No console errors

### 10. Performance Check
- [ ] Test page load speed (should be < 3 seconds)
- [ ] Verify API response time (should be < 1 second)
- [ ] Check feed updates every 45 seconds
- [ ] Monitor error logs in hosting dashboard

### 11. SEO & Analytics (Optional)
- [ ] Submit to Google Search Console
- [ ] Add Google Analytics (if desired)
- [ ] Create sitemap.xml (if needed)
- [ ] Verify meta tags
- [ ] Check Open Graph tags (for social sharing)

### 12. Monitoring
- [ ] Set up uptime monitoring (e.g., UptimeRobot)
- [ ] Monitor API usage in Virlo.ai dashboard
- [ ] Check hosting dashboard for errors
- [ ] Set up alerts for downtime

## Troubleshooting Checklist

### Feed Not Loading
- [ ] Check VIRLO_API is set: `vercel env ls` or `netlify env:list`
- [ ] Verify API key in Virlo.ai dashboard
- [ ] Test API endpoint: `curl https://monitormamdani.com/api/trends`
- [ ] Check browser console for errors
- [ ] Review serverless function logs

### Image Not Showing
- [ ] Verify file exists: `/assets/images.png`
- [ ] Check file is not corrupted
- [ ] Clear browser cache
- [ ] Test image URL directly: `https://monitormamdani.com/assets/images.png`

### Domain Not Working
- [ ] Verify DNS records are correct
- [ ] Check DNS propagation: https://dnschecker.org
- [ ] Wait longer (can take 24-48 hours)
- [ ] Try different DNS server: `nslookup monitormamdani.com 8.8.8.8`
- [ ] Clear local DNS cache

### Styling Issues
- [ ] Clear browser cache
- [ ] Check CSS file loads: view source
- [ ] Test in incognito/private mode
- [ ] Verify no CSP blocking styles

## Success Criteria

Your deployment is successful when:
- ✅ Site loads at https://monitormamdani.com
- ✅ Ticker scrolls continuously
- ✅ Image displays prominently
- ✅ Both CTA links work and go to Virlo.ai
- ✅ Feed shows "LIVE" status in green
- ✅ Trend items appear in the feed
- ✅ Feed auto-refreshes every 45 seconds
- ✅ Mobile responsive
- ✅ No console errors
- ✅ HTTPS certificate valid

## Maintenance Schedule

### Daily
- Check site is online
- Verify feed is updating

### Weekly
- Review error logs
- Check API usage
- Test on different devices

### Monthly
- Update dependencies (if any)
- Review hosting costs
- Check analytics (if configured)

## Rollback Plan

If something goes wrong:

1. **Quick Fix**: Revert to previous deployment
   ```bash
   vercel rollback
   # or
   netlify rollback
   ```

2. **Emergency**: Point DNS back to old server
   - Update DNS records at registrar
   - Wait for propagation

3. **Local Test**: Run index.local.html to verify code works

## Support Resources

- **Vercel Docs**: https://vercel.com/docs
- **Netlify Docs**: https://docs.netlify.com
- **Virlo.ai Support**: https://virlo.ai/support
- **DNS Help**: https://dnschecker.org

## Notes

- Keep your VIRLO_API secure (never commit to git)
- Monitor API rate limits
- Check hosting bills monthly
- Update this checklist as you learn

---

**Last Updated**: 2026-01-05
**Status**: Ready for deployment
**Next Review**: After first successful deployment
