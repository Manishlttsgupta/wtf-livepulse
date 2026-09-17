import React, { useState, useEffect, useCallback } from 'react';
import { useLiveWebSocket } from './hooks/useLiveWebSocket';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

export default function App() {
  const [gyms, setGyms] = useState([]);
  const [selectedGymId, setSelectedGymId] = useState('');
  const [liveData, setLiveData] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [anomalies, setAnomalies] = useState([]);
  const [simSpeed, setSimSpeed] = useState(1);
  const [simStatus, setSimStatus] = useState('paused');

  // Initial Data Fetch
  useEffect(() => {
    fetch('/api/gyms')
      .then(res => res.json())
      .then(data => {
        setGyms(data);
        if (data.length > 0) setSelectedGymId(data[0].id);
      });

    fetch('/api/anomalies')
      .then(res => res.json())
      .then(data => setAnomalies(data));
  }, []);

  // Fetch Gym Snapshot & Analytics when Gym changes
  useEffect(() => {
    if (!selectedGymId) return;

    fetch(`/api/gyms/${selectedGymId}/live`)
      .then(res => res.json())
      .then(data => setLiveData(data));

    fetch(`/api/gyms/${selectedGymId}/analytics`)
      .then(res => res.json())
      .then(data => setAnalytics(data));
  }, [selectedGymId]);

  // WebSocket Message Handler
  const handleWebSocketMessage = useCallback((data) => {
    if (data.type === 'CHECKIN_EVENT' || data.type === 'CHECKOUT_EVENT') {
      if (data.gym_id === selectedGymId) {
        setLiveData(prev => prev ? {
          ...prev,
          current_occupancy: data.current_occupancy,
          recent_events: [
            {
              id: Date.now(),
              type: data.type === 'CHECKIN_EVENT' ? 'checkin' : 'checkout',
              member_name: data.member_name,
              timestamp: data.timestamp
            },
            ...(prev.recent_events || []).slice(0, 19)
          ]
        } : prev);
      }
    }

    if (data.type === 'PAYMENT_EVENT') {
      if (data.gym_id === selectedGymId) {
        setLiveData(prev => prev ? { ...prev, today_revenue: data.today_total } : prev);
      }
    }

    if (data.type === 'ANOMALY_DETECTED') {
      setAnomalies(prev => [data, ...prev]);
    }

    if (data.type === 'ANOMALY_RESOLVED') {
      setAnomalies(prev => prev.filter(a => a.id !== data.anomaly_id));
    }
  }, [selectedGymId]);

  const { isConnected } = useLiveWebSocket(handleWebSocketMessage);

  // Simulator Controls
  const toggleSimulator = (action) => {
    if (action === 'start') {
      fetch('/api/simulator/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ speed: simSpeed })
      }).then(() => setSimStatus('running'));
    } else if (action === 'stop') {
      fetch('/api/simulator/stop', { method: 'POST' })
        .then(() => setSimStatus('paused'));
    } else if (action === 'reset') {
      fetch('/api/simulator/reset', { method: 'POST' })
        .then(() => {
          setSimStatus('paused');
          if (selectedGymId) {
            fetch(`/api/gyms/${selectedGymId}/live`)
              .then(res => res.json())
              .then(data => setLiveData(data));
          }
        });
    }
  };

  // Dismiss Anomaly
  const dismissAnomaly = (id) => {
    fetch(`/api/anomalies/${id}/dismiss`, { method: 'PATCH' })
      .then(res => {
        if (res.ok) setAnomalies(prev => prev.filter(a => a.id !== id));
      });
  };

  // Occupancy Styling
  const capacity = liveData?.gym?.capacity || 100;
  const currentOcc = liveData?.current_occupancy || 0;
  const occupancyPct = Math.round((currentOcc / capacity) * 100);
  const occColor = occupancyPct > 85 ? 'text-red-500' : occupancyPct > 60 ? 'text-yellow-400' : 'text-emerald-400';

  const COLORS = ['#38BDF8', '#818CF8', '#34D399'];

  return (
    <div className="min-h-screen bg-[#0D0D1A] text-slate-100 p-6 flex flex-col gap-6">
      
      {/* Top Bar: Selector + Live Indicator + Simulator Panel */}
      <header className="flex flex-wrap items-center justify-between bg-[#1A1A2E] p-4 rounded-xl border border-slate-800 gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold tracking-wide text-red-500">WTF LIVEPULSE</h1>
          <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-full border border-slate-800 text-xs">
            <span className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
            <span>{isConnected ? 'LIVE FEED' : 'DISCONNECTED'}</span>
          </div>
        </div>

        {/* Gym Selector */}
        <select
          value={selectedGymId}
          onChange={(e) => setSelectedGymId(e.target.value)}
          className="bg-slate-900 border border-slate-700 px-4 py-2 rounded-lg text-sm font-medium focus:outline-none focus:border-red-500"
        >
          {gyms.map(g => (
            <option key={g.id} value={g.id}>{g.name} ({g.city})</option>
          ))}
        </select>

        {/* Simulator Control Panel */}
        <div className="flex items-center gap-2 bg-slate-900 px-4 py-2 rounded-lg border border-slate-800 text-sm">
          <span className="text-xs text-slate-400 font-mono uppercase">Simulator:</span>
          {simStatus === 'running' ? (
            <button onClick={() => toggleSimulator('stop')} className="px-3 py-1 bg-amber-600 hover:bg-amber-500 rounded font-semibold text-xs">Pause</button>
          ) : (
            <button onClick={() => toggleSimulator('start')} className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 rounded font-semibold text-xs">Start</button>
          )}
          <select
            value={simSpeed}
            onChange={(e) => setSimSpeed(Number(e.target.value))}
            className="bg-slate-800 border border-slate-700 px-2 py-1 rounded text-xs"
          >
            <option value={1}>1x Speed</option>
            <option value={5}>5x Speed</option>
            <option value={10}>10x Speed</option>
          </select>
          <button onClick={() => toggleSimulator('reset')} className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-xs text-slate-300">Reset</button>
        </div>
      </header>

      {/* KPI Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#1A1A2E] p-5 rounded-xl border border-slate-800 flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Live Occupancy</span>
          <div className="my-2 flex items-baseline gap-3">
            <span className={`text-4xl font-bold font-mono ${occColor}`}>{currentOcc}</span>
            <span className="text-slate-400 text-sm">/ {capacity} capacity ({occupancyPct}%)</span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div className={`h-full transition-all duration-500 ${occupancyPct > 85 ? 'bg-red-500' : occupancyPct > 60 ? 'bg-yellow-400' : 'bg-emerald-400'}`} style={{ width: `${Math.min(occupancyPct, 100)}%` }}></div>
          </div>
        </div>

        <div className="bg-[#1A1A2E] p-5 rounded-xl border border-slate-800 flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Today's Revenue</span>
          <div className="my-2">
            <span className="text-4xl font-bold font-mono text-emerald-400">
              ₹{(liveData?.today_revenue || 0).toLocaleString('en-IN')}
            </span>
          </div>
          <span className="text-xs text-slate-500">Live transaction stream</span>
        </div>

        <div className="bg-[#1A1A2E] p-5 rounded-xl border border-slate-800 flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Anomalies</span>
          <div className="my-2">
            <span className="text-4xl font-bold font-mono text-rose-500">{anomalies.length}</span>
          </div>
          <span className="text-xs text-slate-500">Real-time detection engine</span>
        </div>
      </div>

      {/* Main Operations Grid: Activity Feed & Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Module 1: Activity Feed */}
        <div className="bg-[#1A1A2E] p-5 rounded-xl border border-slate-800 flex flex-col h-[380px]">
          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4">Live Activity Feed</h2>
          <div className="flex-1 overflow-y-auto space-y-3 pr-2">
            {liveData?.recent_events?.map((evt, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs bg-slate-900/60 p-2.5 rounded border border-slate-800/80">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${evt.type === 'checkin' ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                  <span className="font-semibold text-slate-200">{evt.member_name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="uppercase text-[10px] text-slate-400 font-mono">{evt.type}</span>
                  <span className="text-slate-500 font-mono">{new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Module 2: Peak Hours Heatmap / Checkin Volume */}
        <div className="bg-[#1A1A2E] p-5 rounded-xl border border-slate-800 flex flex-col h-[380px]">
          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4">Hourly Check-in Activity</h2>
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics?.heatmap?.slice(0, 12) || []}>
                <XAxis dataKey="hour_of_day" stroke="#64748B" tickFormatter={h => `${h}:00`} />
                <YAxis stroke="#64748B" />
                <Tooltip contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155' }} />
                <Bar dataKey="checkin_count" fill="#38BDF8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Module 2: New vs Renewal Ratio */}
        <div className="bg-[#1A1A2E] p-5 rounded-xl border border-slate-800 flex flex-col h-[380px]">
          <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4">Member Acquisition (30D)</h2>
          <div className="flex-1 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analytics?.new_vs_renewal || []}
                  dataKey="count"
                  nameKey="member_type"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                >
                  {(analytics?.new_vs_renewal || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Module 3: Anomaly Log Panel */}
      <div className="bg-[#1A1A2E] p-5 rounded-xl border border-slate-800">
        <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4">Active Anomaly Log</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900 text-slate-400 uppercase font-mono">
              <tr>
                <th className="p-3">Gym</th>
                <th className="p-3">Type</th>
                <th className="p-3">Severity</th>
                <th className="p-3">Message</th>
                <th className="p-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-mono">
              {anomalies.map(a => (
                <tr key={a.id || a.anomaly_id} className="hover:bg-slate-900/40">
                  <td className="p-3 font-sans font-medium">{a.gym_name || 'Gym Location'}</td>
                  <td className="p-3">{a.type || a.anomaly_type}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${a.severity === 'critical' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                      {a.severity?.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-3 font-sans">{a.message}</td>
                  <td className="p-3">
                    {a.severity === 'warning' && (
                      <button
                        onClick={() => dismissAnomaly(a.id || a.anomaly_id)}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px]"
                      >
                        Dismiss
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {anomalies.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center p-6 text-slate-500">No active anomalies detected across all gyms.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}