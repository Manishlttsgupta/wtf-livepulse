require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const apiRoutes = require('./routes/api');
const { initWebSocket } = require('./websocket/server');
const { checkAnomalies } = require('./services/anomalyService');
const seed = require('./db/seeds/seed');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// REST Routes
app.use('/api', apiRoutes);

// Init WebSocket
initWebSocket(server);

// Background Job: Anomaly Detection every 30 seconds
setInterval(checkAnomalies, 30000);

// Auto-seed on startup & start listening
server.listen(PORT, async () => {
  console.log(`🚀 LivePulse Backend running on port ${PORT}`);
  try {
    await seed();
    console.log('✅ Auto-seed check finished.');
  } catch (err) {
    console.error('⚠️ Auto-seed check failed:', err.message);
  }
});

module.exports = app;