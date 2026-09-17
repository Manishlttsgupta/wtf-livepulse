const pool = require('../db/pool');
const { broadcast } = require('../websocket/server');

async function checkAnomalies() {
  const client = await pool.connect();
  try {
    const gymsRes = await client.query('SELECT * FROM gyms WHERE status = $1', ['active']);
    const gyms = gymsRes.rows;

    for (const gym of gyms) {
      // 1. Capacity Breach Check (> 90% capacity)
      const occRes = await client.query(
        'SELECT COUNT(*) FROM checkins WHERE gym_id = $1 AND checked_out IS NULL',
        [gym.id]
      );
      const currentOcc = parseInt(occRes.rows[0].count, 10);
      const capacityPct = (currentOcc / gym.capacity) * 100;

      if (capacityPct > 90) {
        await triggerAnomaly(client, gym.id, 'capacity_breach', 'critical', 
          `Occupancy reached ${currentOcc}/${gym.capacity} (${Math.round(capacityPct)}%)`
        );
      } else if (capacityPct < 85) {
        await resolveAnomaly(client, gym.id, 'capacity_breach');
      }

      // 2. Zero Check-ins (within operating hours 6-22, no check-in in last 2 hours)
      const now = new Date();
      const hour = now.getHours();
      if (hour >= 6 && hour < 22) {
        const lastCheckinRes = await client.query(
          `SELECT checked_in FROM checkins 
           WHERE gym_id = $1 AND checked_in >= NOW() - INTERVAL '2 hours' 
           LIMIT 1`,
          [gym.id]
        );
        if (lastCheckinRes.rows.length === 0) {
          await triggerAnomaly(client, gym.id, 'zero_checkins', 'warning',
            `Zero check-ins recorded in the last 2 hours`
          );
        } else {
          await resolveAnomaly(client, gym.id, 'zero_checkins');
        }
      }

      // 3. Revenue Drop (> 30% lower vs same day last week)
      const revTodayRes = await client.query(
        `SELECT COALESCE(SUM(amount), 0) AS total FROM payments 
         WHERE gym_id = $1 AND paid_at >= CURRENT_DATE`,
        [gym.id]
      );
      const revLastWeekRes = await client.query(
        `SELECT COALESCE(SUM(amount), 0) AS total FROM payments 
         WHERE gym_id = $1 AND paid_at >= CURRENT_DATE - INTERVAL '7 days' 
         AND paid_at < CURRENT_DATE - INTERVAL '6 days'`,
        [gym.id]
      );

      const revToday = parseFloat(revTodayRes.rows[0].total);
      const revLastWeek = parseFloat(revLastWeekRes.rows[0].total);

      if (revLastWeek > 0 && revToday < 0.7 * revLastWeek) {
        await triggerAnomaly(client, gym.id, 'revenue_drop', 'warning',
          `Revenue today (${revToday}) dropped >30% compared to last week (${revLastWeek})`
        );
      } else if (revLastWeek > 0 && revToday >= 0.8 * revLastWeek) {
        await resolveAnomaly(client, gym.id, 'revenue_drop');
      }
    }
  } catch (err) {
    console.error('Error during anomaly scan:', err);
  } finally {
    client.release();
  }
}

async function triggerAnomaly(client, gymId, type, severity, message) {
  const existing = await client.query(
    'SELECT id FROM anomalies WHERE gym_id = $1 AND type = $2 AND resolved = FALSE',
    [gymId, type]
  );
  if (existing.rows.length === 0) {
    const res = await client.query(
      `INSERT INTO anomalies (gym_id, type, severity, message)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [gymId, type, severity, message]
    );
    const gymRes = await client.query('SELECT name FROM gyms WHERE id = $1', [gymId]);
    broadcast({
      type: 'ANOMALY_DETECTED',
      anomaly_id: res.rows[0].id,
      gym_id: gymId,
      gym_name: gymRes.rows[0]?.name,
      anomaly_type: type,
      severity,
      message,
    });
  }
}

async function resolveAnomaly(client, gymId, type) {
  const res = await client.query(
    `UPDATE anomalies 
     SET resolved = TRUE, resolved_at = NOW() 
     WHERE gym_id = $1 AND type = $2 AND resolved = FALSE 
     RETURNING id`,
    [gymId, type]
  );
  if (res.rows.length > 0) {
    broadcast({
      type: 'ANOMALY_RESOLVED',
      anomaly_id: res.rows[0].id,
      gym_id: gymId,
      resolved_at: new Date().toISOString(),
    });
  }
}

module.exports = { checkAnomalies };