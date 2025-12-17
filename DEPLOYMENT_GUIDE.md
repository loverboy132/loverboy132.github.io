# Deployment Guide - What Goes Where

## 🚨 **IMPORTANT: Two Separate Deployments**

Your website has **TWO parts** that deploy to **DIFFERENT places**:

1. **Frontend (Website)** → GitHub Pages
2. **Backend (Edge Functions)** → Supabase

---

## 📁 **What Goes to GitHub (Frontend)**

### ✅ **Upload to GitHub:**
- ✅ `index.html`
- ✅ `login-supabase.html`
- ✅ `signup-member-supabase.html`
- ✅ `signup-apprentice-supabase.html`
- ✅ `dashboard-supabase.html`
- ✅ `payment-complete.html`
- ✅ `privacy-policy.html`
- ✅ `terms-of-service.html`
- ✅ `*.js` files (dashboard-supabase.js, wallet-interface.js, etc.)
- ✅ `*.css` files (dark-mode.css, wallet-interface-styles.css)
- ✅ `*.svg` files (logos, images)
- ✅ `package.json` (for dependencies)

### ❌ **DO NOT Upload to GitHub:**
- ❌ `env.js` (contains secrets - already in .gitignore)
- ❌ `node_modules/` (already in .gitignore)
- ❌ `.env` files (already in .gitignore)
- ❌ `supabase/` folder (deployed separately to Supabase)

---

## 🔧 **What Goes to Supabase (Backend)**

### ✅ **Deploy to Supabase:**

**Edge Functions** (via Supabase CLI or Dashboard):
- `supabase/functions/flutterwave-init-payment/`
- `supabase/functions/flutterwave-webhook/`
- `supabase/functions/send-notification-email/`
- Other functions in `supabase/functions/`

**SQL Scripts** (run in Supabase SQL Editor):
- `supabase/*.sql` files (database setup, migrations)

---

## 📋 **Step-by-Step Deployment**

### **Step 1: Deploy Frontend to GitHub Pages**

1. **Create GitHub Repository** (if not exists)
2. **Upload Frontend Files**:
   ```bash
   # Files to commit:
   git add *.html *.js *.css *.svg package.json .gitignore
   git commit -m "Deploy frontend"
   git push origin main
   ```
3. **Enable GitHub Pages**:
   - Go to repository Settings → Pages
   - Select branch: `main`
   - Select folder: `/ (root)`
   - Your site will be at: `https://loverboy132.github.io/craftiva-main/`

### **Step 2: Deploy Edge Functions to Supabase**

**Option A: Using Supabase CLI** (Recommended)
```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref xmffdlciwrvuycnsgezb

# Deploy functions
supabase functions deploy flutterwave-init-payment
supabase functions deploy flutterwave-webhook
supabase functions deploy send-notification-email
```

**Option B: Using Supabase Dashboard**
1. Go to your Supabase project dashboard
2. Navigate to **Edge Functions**
3. Click **Create Function** for each function
4. Copy-paste the code from `supabase/functions/[function-name]/index.ts`
5. Deploy

### **Step 3: Set Environment Variables in Supabase**

Go to **Supabase Dashboard → Settings → Edge Functions → Secrets**:

Set these environment variables:
```
FLUTTERWAVE_SECRET_KEY=FLWSECK-xxxxx
FLW_SECRET_KEY=FLWSECK-xxxxx (alternative name)
SITE_URL=https://loverboy132.github.io
SUPABASE_URL=https://xmffdlciwrvuycnsgezb.supabase.co
SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
SERVICE_ROLE_KEY=eyJhbGci... (alternative name)
craftnet_fw_webhook_9f3c1a8b7d=your_webhook_secret_hash
```

### **Step 4: Run SQL Scripts**

1. Go to **Supabase Dashboard → SQL Editor**
2. Run each `.sql` file in order:
   - `create-user-wallet-function.sql`
   - `create-subscription-payment-functions.sql`
   - `admin-dashboard-access-policies.sql`
   - etc.

---

## ⚠️ **IMPORTANT: Fix SITE_URL Issue**

I noticed you hardcoded the SITE_URL incorrectly. Let me fix that:

**Current (WRONG):**
```typescript
const siteUrl = Deno.env.get("https://loverboy132.github.io/") ?? "";
```

**Should be:**
```typescript
const siteUrl = Deno.env.get("SITE_URL") ?? "";
```

The environment variable name should be `SITE_URL`, not the URL itself!

---

## 🔍 **Quick Checklist**

### Before Deploying:
- [ ] Fix SITE_URL in `flutterwave-init-payment/index.ts`
- [ ] Set all environment variables in Supabase
- [ ] Deploy Edge Functions to Supabase
- [ ] Run SQL scripts in Supabase
- [ ] Test Edge Functions are accessible
- [ ] Upload frontend files to GitHub
- [ ] Enable GitHub Pages
- [ ] Update `env.js` with production URLs (but don't commit it!)

### After Deploying:
- [ ] Test payment flows work
- [ ] Verify webhook is receiving requests
- [ ] Check that redirects work correctly
- [ ] Test on mobile devices

---

## 🎯 **Summary**

**GitHub (Frontend):**
- ✅ HTML, JS, CSS files
- ❌ NO `supabase/` folder
- ❌ NO `env.js` file

**Supabase (Backend):**
- ✅ Edge Functions (deploy separately)
- ✅ SQL scripts (run in SQL editor)
- ✅ Environment variables (set in dashboard)

**The `supabase/` folder is for Supabase deployment, NOT GitHub!**

