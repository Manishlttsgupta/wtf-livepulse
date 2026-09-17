const request = require('supertest');
const app = require('../../src/app');

describe('REST API Endpoints Integration', () => {
  test('GET /api/gyms returns 200 and an array', async () => {
    const res = await request(app).get('/api/gyms');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /api/analytics/cross-gym returns 200', async () => {
    const res = await request(app).get('/api/analytics/cross-gym');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /api/anomalies returns 200', async () => {
    const res = await request(app).get('/api/anomalies');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('POST /api/simulator/start starts simulation', async () => {
    const res = await request(app).post('/api/simulator/start').send({ speed: 5 });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('running');
  });

  test('POST /api/simulator/stop pauses simulation', async () => {
    const res = await request(app).post('/api/simulator/stop');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('paused');
  });

  test('PATCH /api/anomalies/non-existing/dismiss returns 404', async () => {
    const res = await request(app).patch('/api/anomalies/00000000-0000-0000-0000-000000000000/dismiss');
    expect(res.status).toBe(404);
  });
});const request = require('supertest');
const app = require('../../src/app');

describe('REST API Endpoints Integration', () => {
  test('GET /api/gyms returns 200 and an array', async () => {
    const res = await request(app).get('/api/gyms');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /api/analytics/cross-gym returns 200', async () => {
    const res = await request(app).get('/api/analytics/cross-gym');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /api/anomalies returns 200', async () => {
    const res = await request(app).get('/api/anomalies');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('POST /api/simulator/start starts simulation', async () => {
    const res = await request(app).post('/api/simulator/start').send({ speed: 5 });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('running');
  });

  test('POST /api/simulator/stop pauses simulation', async () => {
    const res = await request(app).post('/api/simulator/stop');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('paused');
  });

  test('PATCH /api/anomalies/non-existing/dismiss returns 404', async () => {
    const res = await request(app).patch('/api/anomalies/00000000-0000-0000-0000-000000000000/dismiss');
    expect(res.status).toBe(404);
  });
});