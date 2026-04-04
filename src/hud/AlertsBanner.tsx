import { useEffect, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useMissionStore } from '../store/mission-store';
import AlertItem from './AlertItem';

export default function AlertsBanner() {
  const alerts = useMissionStore((s) => s.alerts);
  const dismissAlert = useMissionStore((s) => s.dismissAlert);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Auto-dismiss timers
  useEffect(() => {
    const visible = alerts.slice(0, 3);
    for (const alert of visible) {
      if (!timers.current.has(alert.id)) {
        const timer = setTimeout(() => {
          dismissAlert(alert.id);
          timers.current.delete(alert.id);
        }, alert.autoDismissMs);
        timers.current.set(alert.id, timer);
      }
    }

    // Cleanup dismissed alerts' timers
    return () => {
      const visibleIds = new Set(visible.map((a) => a.id));
      for (const [id, timer] of timers.current) {
        if (!visibleIds.has(id)) {
          clearTimeout(timer);
          timers.current.delete(id);
        }
      }
    };
  }, [alerts, dismissAlert]);

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      for (const timer of timers.current.values()) {
        clearTimeout(timer);
      }
    };
  }, []);

  const visible = alerts.slice(0, 3);

  return (
    <div className="absolute top-0 left-0 right-0 z-20 flex flex-col gap-2 p-2 sm:p-4 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {visible.map((alert) => (
          <AlertItem
            key={alert.id}
            id={alert.id}
            severity={alert.severity}
            message={alert.message}
            timestamp={alert.timestamp}
            onDismiss={dismissAlert}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
