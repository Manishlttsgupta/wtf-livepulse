const { WebSocketServer } = require('ws');

let wss = null;

function initWebSocket(server) {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
    ws.send(JSON.stringify({ type: 'CONNECTED', message: 'WTF LivePulse WS Connected' }));
  });

  const interval = setInterval(() => {
    if (!wss) return;
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => clearInterval(interval));
  return wss;
}

function broadcast(event) {
  if (!wss) return;
  const data = JSON.stringify(event);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // 1 = WebSocket.OPEN
      client.send(data);
    }
  });
}

module.exports = { initWebSocket, broadcast };