const pool = require('../db/pool');
const { broadcast } = require('../websocket/server');

let intervalId = null;
let currentSpeed = 1;

async function generateEvent() {
  const client = await pool.connect();
  try {
    // Pick random gym
    const gymsRes = await client.query('SELECT id, capacity FROM gyms WHERE status = $1 ORDER BY random() LIMIT 1', ['active']);
    if (gymsRes.rows.length === 0) return;
    const gym = gymsRes.rows[0];

    const isCheckin = Math.random() > 0.4; // 60% check-ins, 40% check-outs

    if (isCheckin) {
      // Find a member for this gym
      const mRes = await client.query(
        'SELECT id, name FROM members WHERE gym_id = $1 ORDER BY random() LIMIT 1',
        [gym.id]
      );
      if (mRes.rows.length === 0) return;
      const member = mRes.rows[0];

      await client.query(
        'INSERT INTO checkins (member_id, gym_id, checked_in) VALUES ($1, $2, NOW())',
        [member.id, gym.id]
      );

      const occRes = await client.query(
        'SELECT COUNT(*) FROM checkins WHERE gym_id = $1 AND checked_out IS NULL',
        [gym.id]
      );
      const occ = parseInt(occRes.rows[0].count, 10);
      const capPct = Math.round((occ / gym.capacity) * 100);

      broadcast({
        type: 'CHECKIN_EVENT',
        gym_id: gym.id,
        member_name: member.name,
        timestamp: new Date().toISOString(),
        current_occupancy: occ,
        capacity_pct: capPct,
      });

      // 20% chance payment event happens alongside
      if (Math.random() > 0.8) {
        const amount = 1500;
        await client.query(
          'INSERT INTO payments (member_id, gym_id, amount, plan_type, payment_type) VALUES ($1, $2, $3, $4, $5)',
          [member.id, gym.id, amount, 'monthly', 'renewal']
        );
        const revRes = await client.query(
          'SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE gym_id = $1 AND paid_at >= CURRENT_DATE',
          [gym.id]
        );
        broadcast({
          type: 'PAYMENT_EVENT',
          gym_id: gym.id,
          amount,
          plan_type: 'monthly',
          member_name: member.name,
          today_total: parseFloat(revRes.rows[0].total),
        });
      }
    } else {
      // Checkout an open checkin
      const openRes = await client.query(
        `SELECT c.id, c.member_id, m.name 
         FROM checkins c 
         JOIN members m ON c.member_id = m.id 
         WHERE c.gym_id = $1 AND c.checked_out IS NULL 
         ORDER BY c.checked_in ASC LIMIT 1`,
        [gym.id]
      );

      if (openRes.rows.length > 0) {
        const c = openRes.rows[0];
        await client.query('UPDATE checkins SET checked_out = NOW() WHERE id = $1', [c.id]);

        const occRes = await client.query(
          'SELECT COUNT(*) FROM checkins WHERE gym_id = $1 AND checked_out IS NULL',
          [gym.id]
        );
        const occ = parseInt(occRes.rows[0].count, 10);
        const capPct = Math.round((occ / gym.capacity) * 100);

        broadcast({
          type: 'CHECKOUT_EVENT',
          gym_id: gym.id,
          member_name: c.name,
          timestamp: new Date().toISOString(),
          current_occupancy: occ,
          capacity_pct: capPct,
        });
      }
    }
  } catch (err) {
    console.error('Simulator event error:', err);
  } finally {
    client.release();
  }
}

function startSimulator(speed = 1) {
  stopSimulator();
  currentSpeed = speed;
  const interval = Math.max(200, 2000 / speed);
  intervalId = setInterval(generateEvent, interval);
  return { status: 'running', speed: currentSpeed };
}

function stopSimulator() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  return { status: 'paused' };
}

async function resetSimulator() {
  stopSimulator();
  const client = await pool.connect();
  try {
    await client.query('UPDATE checkins SET checked_out = NOW() WHERE checked_out IS NULL');
    return { status: 'reset' };
  } finally {
    client.release();
  }
}

module.exports = { startSimulator, stopSimulator, resetSimulator };