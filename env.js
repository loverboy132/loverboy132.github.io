// Environment Configuration for Craftiva
// This file contains your actual configuration values
// DO NOT commit this file to version control

export const ENV_CONFIG = {
    // Supabase Configuration
    SUPABASE_URL: "https://xmffdlciwrvuycnsgezb.supabase.co",
    SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtZmZkbGNpd3J2dXljbnNnZXpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwMjUzMzQsImV4cCI6MjA3MDYwMTMzNH0.bBPsRDAljy2WDkw9K6faOFDYrJ7F8EJT5F4cqdI4MQQ",

    // Paystack Configuration
    PAYSTACK_PUBLIC_KEY: "pk_test_YOUR_ACTUAL_PUBLIC_KEY_HERE", // Replace with your actual Paystack public key
    PAYSTACK_SECRET_KEY: "sk_test_YOUR_ACTUAL_SECRET_KEY_HERE", // Only for server-side

    // Flutterwave Configuration
    FLUTTERWAVE_SECRET_HASH: "set-this-to-your-webhook-secret",
    FLUTTERWAVE_FUNCTION_URL: "https://xmffdlciwrvuycnsgezb.functions.supabase.co/flutterwave-init-payment", // Supabase Edge Function URL

    // Site Configuration
    SITE_URL: "https://loverboy132.github.io", // Production site URL (no trailing slash)
    SITE_NAME: "Craftiva",

    // Feature Flags
    ENABLE_PAYMENTS: true,
    ENABLE_REFERRALS: true,
    ENABLE_JOBS: true,
    ENABLE_EMAIL_NOTIFICATIONS: false,
    EMAIL_FUNCTION_NAME: "send-notification-email",

    // Development
    NODE_ENV: "development", // Set to 'production' for production builds
    DEBUG_MODE: true, // Set to false for production
    LOG_LEVEL: "debug", // 'debug', 'info', 'warn', 'error'
};

// Set window.ENV for browser compatibility (used by supabase-auth.js)
if (typeof window !== "undefined") {
    window.ENV = ENV_CONFIG;
}

// Also set window.ENV immediately when this script loads (for direct script loading)
window.ENV = ENV_CONFIG;



