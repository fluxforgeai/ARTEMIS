import { memo } from 'react';
import { motion } from 'framer-motion';
import type { AlertSeverity } from '../store/mission-store';

interface AlertItemProps {
  id: string;
  severity: AlertSeverity;
  message: string;
  timestamp: number;
  onDismiss: (id: string) => void;
}

const SEVERITY_CONFIG: Record<AlertSeverity, { border: string; glow: string; text: string }> = {
  info: {
    border: 'border-l-[#00d4ff]',
    glow: '',
    text: 'text-[#00d4ff]',
  },
  nominal: {
    border: 'border-l-[#00ff88]',
    glow: '',
    text: 'text-[#00ff88]',
  },
  caution: {
    border: 'border-l-[#ff8c00]',
    glow: 'shadow-[0_0_8px_rgba(255,140,0,0.3)]',
    text: 'text-[#ff8c00]',
  },
  warning: {
    border: 'border-l-[#ff4444]',
    glow: 'animate-[alert-glow-red_2s_ease-in-out_infinite]',
    text: 'text-[#ff4444]',
  },
};

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
}

export default memo(function AlertItem({ id, severity, message, timestamp, onDismiss }: AlertItemProps) {
  const config = SEVERITY_CONFIG[severity];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 100 }}
      transition={{ duration: 0.3 }}
      className={`pointer-events-auto bg-[rgba(10,10,30,0.85)] backdrop-blur-md border-l-4 ${config.border} ${config.glow} rounded-r-lg px-3 py-2 flex items-start gap-2 max-w-md`}
    >
      <div className="flex-1 min-w-0">
        <div className={`text-[10px] uppercase tracking-wider font-bold ${config.text}`}>
          {severity}
        </div>
        <div className="text-xs text-white mt-0.5">{message}</div>
        <div className="text-[9px] text-gray-500 mt-0.5">{formatRelativeTime(timestamp)}</div>
      </div>
      <button
        onClick={() => onDismiss(id)}
        className="text-gray-500 hover:text-white transition-colors text-sm leading-none mt-0.5"
      >
        ×
      </button>
    </motion.div>
  );
});
