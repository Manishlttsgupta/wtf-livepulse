const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { startSimulator, stopSimulator, resetSimulator } = require('../services/simulatorService');

// 1. GET /api/gyms
router.get('/gyms', async (req, res) => {
  try {
    const query = `
      SELECT 
        g.id, g.name, g.city, g.capacity, g.status,
        COALESCE(o.current_occupancy, 0)::INTEGER AS current_occupancy,
        COALESCE(r.today_revenue, 0)::NUMERIC AS today_revenue
      FROM gyms g
      LEFT JOIN (
        SELECT gym_id, COUNT(*) AS current_occupancy
        FROM checkins
        WHERE checked_out IS NULL
        GROUP BY gym_id
      ) o ON g.id = o.gym_id
      LEFT JOIN (
        SELECT gym_id, SUM(amount) AS today_revenue
        FROM payments
        WHERE paid_at >= CURRENT_DATE
        GROUP BY gym_id
      ) r ON g.id = r.gym_id
      ORDER BY g.name ASC;
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. GET /api/gyms/:id/live (< 5ms target)
router.get('/gyms/:id/live', async (req, res) => {
  const { id } = req.params;
  try {
    const [gymRes, occRes, revRes, eventsRes, anomRes] = await Promise.all([
      pool.query('SELECT id, name, capacity FROM gyms WHERE id = $1', [id]),
      pool.query('SELECT COUNT(*) FROM checkins WHERE gym_id = $1 AND checked_out IS NULL', [id]),
      pool.query('SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE gym_id = $1 AND paid_at >= CURRENT_DATE', [id]),
      pool.query(`
        SELECT c.id, 'checkin' AS type, m.name AS member_name, c.checked_in AS timestamp
        FROM checkins c JOIN members m ON c.member_id = m.id
        WHERE c.gym_id = $1 ORDER BY c.checked_in DESC LIMIT 20
      `, [id]),
      pool.query('SELECT * FROM anomalies WHERE gym_id = $1 AND resolved = FALSE ORDER BY detected_at DESC', [id]),
    ]);

    if (gymRes.rows.length === 0) return res.status(404).json({ error: 'Gym not found' });

    res.json({
      gym: gymRes.rows[0],
      current_occupancy: parseInt(occRes.rows[0].count, 10),
      today_revenue: parseFloat(revRes.rows[0].total),
      recent_events: eventsRes.rows,
      active_anomalies: anomRes.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. GET /api/gyms/:id/analytics
router.get('/gyms/:id/analytics', async (req, res) => {
  const { id } = req.params;
  try {
    const [heatmapRes, planRevRes, churnRes, ratioRes] = await Promise.all([
      pool.query('SELECT day_of_week, hour_of_day, checkin_count FROM gym_hourly_stats WHERE gym_id = $1', [id]),
      pool.query(`
        SELECT plan_type, SUM(amount) AS total 
        FROM payments 
        WHERE gym_id = $1 AND paid_at >= NOW() - INTERVAL '30 days'
        GROUP BY plan_type
      `, [id]),
      pool.query(`
        SELECT id, name, last_checkin_at,
          CASE WHEN last_checkin_at < NOW() - INTERVAL '60 days' THEN 'Critical' ELSE 'High' END AS risk_level
        FROM members
        WHERE gym_id = $1 AND status = 'active' AND last_checkin_at < NOW() - INTERVAL '45 days'
        ORDER BY last_checkin_at ASC LIMIT 10
      `, [id]),
      pool.query(`
        SELECT member_type, COUNT(*) AS count
        FROM members
        WHERE gym_id = $1 AND joined_at >= NOW() - INTERVAL '30 days'
        GROUP BY member_type
      `, [id]),
    ]);

    res.json({
      heatmap: heatmapRes.rows,
      revenue_by_plan: planRevRes.rows,
      churn_risk: churnRes.rows,
      new_vs_renewal: ratioRes.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. GET /api/analytics/cross-gym (< 2ms target)
router.get('/analytics/cross-gym', async (req, res) => {
  try {
    const query = `
      SELECT g.id AS gym_id, g.name AS gym_name, COALESCE(SUM(p.amount), 0)::NUMERIC AS total_revenue,
             DENSE_RANK() OVER (ORDER BY COALESCE(SUM(p.amount), 0) DESC) AS rank
      FROM gyms g
      LEFT JOIN payments p ON g.id = p.gym_id AND p.paid_at >= NOW() - INTERVAL '30 days'
      GROUP BY g.id, g.name
      ORDER BY total_revenue DESC;
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Anomalies endpoints
router.get('/anomalies', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.*, g.name AS gym_name 
      FROM anomalies a JOIN gyms g ON a.gym_id = g.id
      WHERE a.resolved = FALSE
      ORDER BY a.detected_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/anomalies/:id/dismiss', async (req, res) => {
  const { id } = req.params;
  try {
    const check = await pool.query('SELECT severity FROM anomalies WHERE id = $1', [id]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Anomaly not found' });
    if (check.rows[0].severity === 'critical') {
      return res.status(403).json({ error: 'Critical anomalies cannot be dismissed' });
    }

    const result = await pool.query(
      'UPDATE anomalies SET dismissed = TRUE WHERE id = $1 RETURNING *',
      [id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Simulator controls
router.post('/simulator/start', (req, res) => {
  const speed = parseInt(req.body.speed || 1, 10);
  res.json(startSimulator(speed));
});

router.post('/simulator/stop', (req, res) => {
  res.json(stopSimulator());
});

router.post('/simulator/reset', async (req, res) => {
  res.json(await resetSimulator());
});

module.exports = router;