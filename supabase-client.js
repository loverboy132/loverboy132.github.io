// supabase-client.js - shared Supabase client instance
// Use a stable ESM CDN for the browser (Skypack is returning 500 errors)
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.3/+esm";

// Load environment config with fallback chain:
// 1. Try env.js (local development, not committed)
// 2. Try env.production.js (production, committed to GitHub)
// 3. Fallback to hardcoded values (last resort)
let ENV_CONFIG;

try {
    // First, try env.js (for local development)
    const envModule = await import("./env.js");
    ENV_CONFIG = envModule.ENV_CONFIG;
    console.log("✅ Environment config loaded from env.js (local)");
} catch (error) {
    console.log("ℹ️ env.js not found, trying env.production.js...");
    try {
        // Second, try env.production.js (for production/GitHub Pages)
        const prodModule = await import("./env.production.js");
        ENV_CONFIG = prodModule.ENV_CONFIG;
        console.log("✅ Environment config loaded from env.production.js (production)");
    } catch (prodError) {
        console.error("❌ Failed to load env.production.js:", prodError);
        console.warn("⚠️ Using fallback Supabase config (hardcoded)");
        // Fallback to hardcoded values (last resort)
        ENV_CONFIG = {
            SUPABASE_URL: "https://xmffdlciwrvuycnsgezb.supabase.co",
            SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtZmZkbGNpd3J2dXljbnNnZXpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwMjUzMzQsImV4cCI6MjA3MDYwMTMzNH0.bBPsRDAljy2WDkw9K6faOFDYrJ7F8EJT5F4cqdI4MQQ",
            SITE_URL: "https://loverboy132.github.io",
        };
    }
}

if (!ENV_CONFIG.SUPABASE_URL || !ENV_CONFIG.SUPABASE_ANON_KEY) {
    console.error("❌ Missing Supabase configuration");
    throw new Error("Supabase configuration is missing. Please check env.js");
}

// Get current origin for redirect URL
const getRedirectUrl = () => {
    if (typeof window === "undefined") return undefined;
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    // Check if we're in a subdirectory (e.g., /craftiva-main/)
    const basePath = pathname.split('/').filter(p => p && p !== 'index.html' && !p.endsWith('.html'))[0];
    const redirectUrl = `${origin}${basePath ? `/${basePath}` : ''}/dashboard-supabase.html`;
    console.log("📍 Redirect URL:", redirectUrl);
    return redirectUrl;
};

export const supabase = createClient(
    ENV_CONFIG.SUPABASE_URL,
    ENV_CONFIG.SUPABASE_ANON_KEY,
    {
        auth: {
            redirectTo: getRedirectUrl(),
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
        }
    }
);

console.log("✅ Supabase client initialized:", {
    url: ENV_CONFIG.SUPABASE_URL,
    hasAnonKey: !!ENV_CONFIG.SUPABASE_ANON_KEY,
    redirectTo: getRedirectUrl()
});


