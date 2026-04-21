# Site URL Configuration Guide

## ✅ Your Site URL

**Production URL**: `https://loverboy132.github.io`

Your site is live at: https://loverboy132.github.io/

---

## 🔧 Configuration Checklist

### 1. **Frontend (`env.js`)** ✅
Already configured:
```javascript
SITE_URL: "https://loverboy132.github.io"
```

**Note**: This file is in `.gitignore` - it won't be committed to GitHub (good for security).

---

### 2. **Supabase Edge Functions** ⚠️ **MUST SET**

You **MUST** set `SITE_URL` as an environment variable in Supabase:

**Steps**:
1. Go to your Supabase Dashboard
2. Navigate to: **Settings → Edge Functions → Secrets**
3. Add new secret:
   - **Name**: `SITE_URL`
   - **Value**: `https://loverboy132.github.io`

**Why?**: The Edge Functions use `Deno.env.get("SITE_URL")` to build payment redirect URLs.

---

### 3. **Payment Redirect URLs**

When users complete payments, they'll be redirected to:
```
https://loverboy132.github.io/payment-complete.html?tx_ref=...&type=...
```

This URL is built from:
- `SITE_URL` (from Supabase environment variable)
- `/payment-complete.html` (payment success page)
- Query parameters (tx_ref, type, job_id)

---

## ⚠️ **Important Notes**

### Trailing Slash
- ✅ **Correct**: `https://loverboy132.github.io` (no trailing slash)
- ❌ **Wrong**: `https://loverboy132.github.io/` (with trailing slash)

The code handles this correctly - it adds `/payment-complete.html` after the URL.

### GitHub Pages Path
If your repository name is `craftiva-main`, your GitHub Pages URL might be:
- `https://loverboy132.github.io/craftiva-main/`

**Check**: Visit https://loverboy132.github.io/ - if it works, use that.
If you need the repo name, use: `https://loverboy132.github.io/craftiva-main`

---

## 🧪 **Testing**

After setting `SITE_URL` in Supabase:

1. **Test Payment Flow**:
   - Initiate a payment
   - Complete payment on Flutterwave
   - Verify redirect goes to: `https://loverboy132.github.io/payment-complete.html`

2. **Check Payment Complete Page**:
   - Should show payment status
   - Should display transaction reference
   - Should allow user to return to dashboard

---

## 📋 **Quick Setup**

### In Supabase Dashboard:

1. **Edge Functions → Secrets**
2. Add:
   ```
   SITE_URL = https://loverboy132.github.io
   ```

3. **Verify** (after deployment):
   - Check Edge Function logs
   - Look for: `SITE_URL not set - payment redirects may not work correctly`
   - If you see this warning, the variable isn't set correctly

---

## ✅ **Current Status**

- ✅ Frontend `env.js` configured
- ⚠️ **Action Required**: Set `SITE_URL` in Supabase Edge Functions secrets
- ✅ Code handles URL construction correctly
- ✅ Payment redirect will work once Supabase variable is set

---

**Next Step**: Set `SITE_URL` in Supabase Dashboard → Edge Functions → Secrets

