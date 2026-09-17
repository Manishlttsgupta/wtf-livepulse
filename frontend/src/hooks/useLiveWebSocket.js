import { useState, useEffect, useRef } from 'react';

export function useLiveWebSocket(onMessage) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    // Docker / Nginx proxy ke through connect karega ya direct port 3001 par
    const wsUrl = window.location.port === '3000'
      ? `ws://${window.location.hostname}:3001/ws`
      : `ws://${window.location.host}/ws`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setIsConnected(true);
    ws.onclose = () => setIsConnected(false);
    ws.onerror = () => setIsConnected(false);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (onMessage) onMessage(data);
      } catch (err) {
        console.error('WS Parse Error', err);
      }
    };

    return () => {
      ws.close();
    };
  }, [onMessage]);

  return { isConnected };
}