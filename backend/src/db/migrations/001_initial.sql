CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS gyms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    address TEXT NOT NULL,
    capacity INT NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    opens_at TIME NOT NULL DEFAULT '06:00:00',
    closes_at TIME NOT NULL DEFAULT '22:00:00',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gym_id UUID REFERENCES gyms(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50) NOT NULL,
    plan_type VARCHAR(50) NOT NULL,
    member_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    plan_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_checkin_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS checkins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    member_id UUID REFERENCES members(id) ON DELETE CASCADE,
    gym_id UUID REFERENCES gyms(id) ON DELETE CASCADE,
    checked_in TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    checked_out TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    member_id UUID REFERENCES members(id) ON DELETE CASCADE,
    gym_id UUID REFERENCES gyms(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL,
    plan_type VARCHAR(50) NOT NULL,
    payment_type VARCHAR(50) NOT NULL,
    paid_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS anomalies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gym_id UUID REFERENCES gyms(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL,
    severity VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Indexing Strategy
CREATE INDEX IF NOT EXISTS idx_checkins_brin_time ON checkins USING brin(checked_in);
CREATE INDEX IF NOT EXISTS idx_checkins_live_occupancy ON checkins(gym_id, checked_out) WHERE checked_out IS NULL;
CREATE INDEX IF NOT EXISTS idx_members_churn_risk ON members(last_checkin_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_anomalies_active ON anomalies(gym_id, detected_at DESC) WHERE resolved = FALSE;
CREATE INDEX IF NOT EXISTS idx_payments_gym_date ON payments(gym_id, paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(paid_at DESC);

-- Materialized View
CREATE MATERIALIZED VIEW IF NOT EXISTS gym_hourly_stats AS
SELECT 
    gym_id,
    EXTRACT(DOW FROM checked_in)::INT AS day_of_week,
    EXTRACT(HOUR FROM checked_in)::INT AS hour_of_day,
    COUNT(*) AS checkin_count
FROM checkins
WHERE checked_in >= NOW() - INTERVAL '7 days'
GROUP BY gym_id, EXTRACT(DOW FROM checked_in), EXTRACT(HOUR FROM checked_in);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gym_hourly_stats ON gym_hourly_stats(gym_id, day_of_week, hour_of_day);
