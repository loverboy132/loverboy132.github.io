-- ==============================================
-- MINIMAL SQL FOR RATINGS & PROGRESS TAB
-- Only adds what's needed for apprentice ratings and earnings/progress
-- Does NOT affect existing tables or functionality
-- ==============================================

-- ==============================================
-- RATINGS TABLE (NEW - for apprentice ratings)
-- ==============================================

-- Create ratings table
CREATE TABLE IF NOT EXISTS ratings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    job_request_id UUID NOT NULL,
    rater_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    ratee_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ==============================================
-- INDEXES FOR RATINGS
-- ==============================================

CREATE INDEX IF NOT EXISTS idx_ratings_ratee_id ON ratings(ratee_id);
CREATE INDEX IF NOT EXISTS idx_ratings_rater_id ON ratings(rater_id);
CREATE INDEX IF NOT EXISTS idx_ratings_created_at ON ratings(created_at);

-- ==============================================
-- RLS POLICIES FOR RATINGS (only what's needed)
-- ==============================================

-- Enable RLS on ratings table
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;

-- Ratings policies (anyone can read, only authenticated users can create)
CREATE POLICY "Anyone can view ratings" ON ratings
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create ratings" ON ratings
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = rater_id);

CREATE POLICY "Users can update their own ratings" ON ratings
    FOR UPDATE USING (auth.uid() = rater_id);

-- ==============================================
-- TRIGGER FOR RATINGS UPDATED_AT
-- ==============================================

-- Function to update updated_at timestamp (only for ratings table)
CREATE OR REPLACE FUNCTION update_ratings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to ratings table
CREATE TRIGGER update_ratings_updated_at_trigger
    BEFORE UPDATE ON ratings
    FOR EACH ROW EXECUTE FUNCTION update_ratings_updated_at();

-- ==============================================
-- GRANT PERMISSIONS FOR RATINGS
-- ==============================================

-- Grant permissions for ratings table
GRANT SELECT, INSERT, UPDATE ON ratings TO authenticated;

-- ==============================================
-- OPTIONAL: ADD MISSING COLUMNS TO EXISTING TABLES
-- Only run these if the columns don't exist yet
-- ==============================================

-- Note: These ALTER TABLE statements will only add columns if they don't exist
-- They are safe to run even if the columns already exist

/*
-- Add total_earnings column to profiles if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'profiles' AND column_name = 'total_earnings') THEN
        ALTER TABLE profiles ADD COLUMN total_earnings DECIMAL(10,2) DEFAULT 0;
    END IF;
END $$;

-- Add completed_jobs column to profiles if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'profiles' AND column_name = 'completed_jobs') THEN
        ALTER TABLE profiles ADD COLUMN completed_jobs INTEGER DEFAULT 0;
    END IF;
END $$;

-- Add balance_ngn column to user_wallets if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'user_wallets' AND column_name = 'balance_ngn') THEN
        ALTER TABLE user_wallets ADD COLUMN balance_ngn DECIMAL(10,2) DEFAULT 0;
    END IF;
END $$;

-- Add balance_points column to user_wallets if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'user_wallets' AND column_name = 'balance_points') THEN
        ALTER TABLE user_wallets ADD COLUMN balance_points DECIMAL(10,2) DEFAULT 0;
    END IF;
END $$;

-- Add transaction_type column to wallet_transactions if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'wallet_transactions' AND column_name = 'transaction_type') THEN
        ALTER TABLE wallet_transactions ADD COLUMN transaction_type TEXT DEFAULT 'deposit';
    END IF;
END $$;

-- Add amount_ngn column to wallet_transactions if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'wallet_transactions' AND column_name = 'amount_ngn') THEN
        ALTER TABLE wallet_transactions ADD COLUMN amount_ngn DECIMAL(10,2) DEFAULT 0;
    END IF;
END $$;
*/