# WTF LivePulse — Real-Time Multi-Gym Intelligence Engine

## 1. Quick Start
Run the entire production stack using a single command:
\`\`\`bash
docker compose up --build
\`\`\`
- Frontend Dashboard: `http://localhost:3000`
- Backend REST API: `http://localhost:3001/api`
- WebSocket Server: `ws://localhost:3001/ws`

## 2. Architecture Decisions
- **PostgreSQL Indexing Strategy:**
  - `BRIN` index on `checkins (checked_in)` for optimized, append-only time-series data.
  - Partial composite index on `checkins (gym_id, checked_out) WHERE checked_out IS NULL` to ensure sub-millisecond execution for real-time occupancy counts.
  - Partial index on `members (last_checkin_at) WHERE status = 'active'` for high-speed churn detection.
  - Partial index on `anomalies (gym_id, detected_at DESC) WHERE resolved = FALSE`.
- **Materialized View:**
  - `gym_hourly_stats` aggregates 7-day hourly check-in volume with a unique composite index to eliminate heavy runtime `GROUP BY` operations.
- **Real-Time Layer:**
  - Native Node.js `ws` library pushes immediate `CHECKIN_EVENT`, `CHECKOUT_EVENT`, `PAYMENT_EVENT`, and anomaly alerts without polling.

## 3. AI Tools Used
- **Claude / ChatGPT / Cursor:** Used as force multipliers to scaffold database migrations, complex data seed scripts, Express REST routes, WebSocket handlers, and React dashboard components.

## 4. Query Benchmarks
All 6 benchmark queries run against 5,000 members and ~270,000 records. Verified with `EXPLAIN (ANALYZE, BUFFERS)`:
- Q1 (Live Occupancy): `< 0.5ms` (Index Scan via `idx_checkins_live_occupancy`)
- Q2 (Today's Revenue): `< 0.8ms` (Index Scan via `idx_payments_gym_date`)
- Q3 (Churn Risk): `< 1.0ms` (Index Scan via `idx_members_churn_risk`)
- Q4 (Hourly Heatmap): `< 0.3ms` (Index Scan on materialized view `gym_hourly_stats`)
- Q5 (Cross-Gym Revenue): `< 2.0ms` (Index Scan via `idx_payments_date`)
- Q6 (Active Anomalies): `< 0.3ms` (Index Scan via `idx_anomalies_active`)

*Screenshots are located in `/benchmarks/screenshots`.*

## 5. Known Limitations
- The simulation engine uses client-side state transitions alongside database updates; under high simulator speeds (10x), browser render queues may debounce event animations.