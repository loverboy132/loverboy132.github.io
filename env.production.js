// env.production.js - Production Environment Configuration
// This file CAN be committed to GitHub (only contains public keys)
// The real env.js with secrets stays in .gitignore

export const ENV_CONFIG = {
    // Supabase Configuration (these are PUBLIC keys - safe to commit)
    SUPABASE_URL: "https://xmffdlciwrvuycnsgezb.supabase.co",
    SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtZmZkbGNpd3J2dXljbnNnZXpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwMjUzMzQsImV4cCI6MjA3MDYwMTMzNH0.bBPsRDAljy2WDkw9K6faOFDYrJ7F8EJT5F4cqdI4MQQ",

    // Site Configuration
    SITE_URL: "https://loverboy132.github.io",
    SITE_NAME: "Craftiva",

    // Flutterwave Configuration (public function URL - safe to commit)
    FLUTTERWAVE_FUNCTION_URL: "https://xmffdlciwrvuycnsgezb.functions.supabase.co/flutterwave-init-payment",

    // Feature Flags
    ENABLE_PAYMENTS: true,
    ENABLE_REFERRALS: true,
    ENABLE_JOBS: true,
    ENABLE_EMAIL_NOTIFICATIONS: false,
    EMAIL_FUNCTION_NAME: "send-notification-email",

    // Production Settings
    NODE_ENV: "production", // Set to 'production' for production builds
    DEBUG_MODE: false, // Set to false for production
    LOG_LEVEL: "info", // 'info', 'warn', 'error' for production
};

// Set window.ENV for browser compatibility (used by supabase-auth.js)
if (typeof window !== "undefined") {
    window.ENV = ENV_CONFIG;
}

// Also set window.ENV immediately when this script loads (for direct script loading)
window.ENV = ENV_CONFIG;

// Note: Secret keys (FLUTTERWAVE_SECRET_KEY, FLUTTERWAVE_SECRET_HASH, etc.)
// are stored in Supabase Edge Functions environment variables, not here.

