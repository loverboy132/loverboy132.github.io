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

    // Site Configuration
    SITE_URL: "http://localhost:3000", // Update this to your actual domain
    SITE_NAME: "Craftiva",

    // Feature Flags
    ENABLE_PAYMENTS: true,
    ENABLE_REFERRALS: true,
    ENABLE_JOBS: true,
    ENABLE_EMAIL_NOTIFICATIONS: false,
    EMAIL_FUNCTION_NAME: "send-notification-email",

    // Developments
    DEBUG_MODE: true, // Set to false for production
    LOG_LEVEL: "debug", // 'debug', 'info', 'warn', 'error'
};



