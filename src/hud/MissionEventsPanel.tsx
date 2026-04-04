import { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useMissionStore } from '../store/mission-store';
import { MILESTONES } from '../data/mission-config';
import { useMission } from '../hooks/useMission';

export default function MissionEventsPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const alerts = useMissionStore((s) => s.alerts);
  const dismissAlert = useMissionStore((s) => s.dismissAlert);
  const setHoveredMilestoneHours = useMissionStore((s) => s.setHoveredMilestoneHours);
  const { totalMs } = useMission();
  const elapsedHours = totalMs / 3_600_000;
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Sort milestones by time
  const sortedMilestones = [...MILESTONES].sort((a, b) => a.missionElapsedHours - b.missionElapsedHours);

  // Find current milestone index
  let currentIdx = 0;
  for (let i = sortedMilestones.length - 1; i >= 0; i--) {
    if (elapsedHours >= sortedMilestones[i].missionElapsedHours) {
      currentIdx = i;
      break;
    }
  }

  // Auto-dismiss timers for alerts
  useEffect(() => {
    for (const alert of alerts) {
      if (!timers.current.has(alert.id)) {
        const timer = setTimeout(() => {
          dismissAlert(alert.id);
          timers.current.delete(alert.id);
        }, alert.autoDismissMs);
        timers.current.set(alert.id, timer);
      }
    }
    return () => {
      const ids = new Set(alerts.map((a) => a.id));
      for (const [id, timer] of timers.current) {
        if (!ids.has(id)) {
          clearTimeout(timer);
          timers.current.delete(id);
        }
      }
    };
  }, [alerts, dismissAlert]);

  useEffect(() => {
    return () => {
      for (const timer of timers.current.values()) clearTimeout(timer);
    };
  }, []);

  const handleMilestoneHover = useCallback((hours: number) => {
    setHoveredMilestoneHours(hours);
  }, [setHoveredMilestoneHours]);

  const handleMilestoneLeave = useCallback(() => {
    setHoveredMilestoneHours(null);
  }, [setHoveredMilestoneHours]);

  const SEVERITY_COLORS: Record<string, string> = {
    info: '#00d4ff',
    nominal: '#00ff88',
    caution: '#ff8c00',
    warning: '#ff4444',
  };

  return (
    <div className="relative pointer-events-auto">
      {/* Hamburger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative px-2 py-1.5 rounded transition-colors ${isOpen ? 'text-[#00d4ff]' : 'text-gray-400 hover:text-[#00d4ff]'}`}
        title="Mission Events"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
        {/* Alert badge */}
        {alerts.length > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#ff4444] text-[8px] text-white flex items-center justify-center font-bold">
            {alerts.length}
          </span>
        )}
      </button>

      {/* Panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Click-outside overlay */}
            <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="absolute top-full mt-2 right-0 z-40 bg-[rgba(10,10,30,0.92)] backdrop-blur-md border border-[rgba(0,212,255,0.2)] rounded-lg w-[320px] max-h-[70vh] overflow-y-auto shadow-lg"
            >
              {/* Active Alerts */}
              {alerts.length > 0 && (
                <div className="p-3 border-b border-[rgba(0,212,255,0.1)]">
                  <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-2">
                    Active Alerts ({alerts.length})
                  </div>
                  <div className="flex flex-col gap-2">
                    {alerts.map((alert) => (
                      <div
                        key={alert.id}
                        className="flex items-start gap-2 text-xs"
                        style={{ borderLeft: `3px solid ${SEVERITY_COLORS[alert.severity] || '#888'}`, paddingLeft: '8px' }}
                      >
                        <div className="flex-1">
                          <span style={{ color: SEVERITY_COLORS[alert.severity], fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                            {alert.severity}
                          </span>
                          <div className="text-gray-300 mt-0.5">{alert.message}</div>
                        </div>
                        <button
                          onClick={() => dismissAlert(alert.id)}
                          className="text-gray-500 hover:text-white text-sm leading-none"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Mission Timeline */}
              <div className="p-3">
                <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-2">
                  Mission Timeline
                </div>
                <div className="flex flex-col gap-0.5">
                  {sortedMilestones.map((m, i) => {
                    const isPast = elapsedHours >= m.missionElapsedHours;
                    const isCurrent = i === currentIdx;

                    return (
                      <div
                        key={m.name}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors ${
                          isCurrent
                            ? 'bg-[rgba(0,212,255,0.1)]'
                            : 'hover:bg-[rgba(255,255,255,0.05)]'
                        }`}
                        onMouseEnter={() => handleMilestoneHover(m.missionElapsedHours)}
                        onMouseLeave={handleMilestoneLeave}
                      >
                        {/* Status icon */}
                        <span className={`text-sm w-5 text-center ${
                          isCurrent
                            ? 'text-[#00d4ff]'
                            : isPast
                              ? 'text-[#00ff88]'
                              : 'text-gray-600'
                        }`}>
                          {isCurrent ? '\u2192' : isPast ? '\u2713' : '\u25CB'}
                        </span>

                        {/* Name */}
                        <span className={`flex-1 text-xs font-mono ${
                          isCurrent
                            ? 'text-[#00d4ff] font-bold'
                            : isPast
                              ? 'text-gray-300'
                              : 'text-gray-500'
                        }`}>
                          {m.name}
                        </span>

                        {/* Time */}
                        <span className={`text-[10px] font-mono ${
                          isCurrent ? 'text-[#00d4ff]/70' : 'text-gray-600'
                        }`}>
                          T+{m.missionElapsedHours}h
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
