import { motion, useSpring, useTransform } from 'framer-motion';
import { useEffect } from 'react';

interface TelemetryCardProps {
  label: string;
  value: number;
  unit: string;
  decimals?: number;
  color?: string;
}

export default function TelemetryCard({ label, value, unit, decimals = 0, color = '#00d4ff' }: TelemetryCardProps) {
  const spring = useSpring(0, { stiffness: 50, damping: 20 });
  const display = useTransform(spring, (v) =>
    v.toLocaleString('en-US', { maximumFractionDigits: decimals, minimumFractionDigits: decimals })
  );

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  return (
    <div className="bg-[rgba(10,10,30,0.7)] backdrop-blur-sm border border-[rgba(0,212,255,0.2)] rounded-lg px-2 py-2 sm:px-4 sm:py-3 min-w-0 sm:min-w-[140px]">
      <div className="text-[9px] sm:text-[10px] uppercase tracking-wider text-gray-400 mb-0.5 sm:mb-1">{label}</div>
      <div className="flex items-baseline gap-1">
        <motion.span
          className="text-sm sm:text-xl font-bold font-mono"
          style={{ color }}
        >
          {display}
        </motion.span>
        <span className="text-[10px] sm:text-xs text-gray-500">{unit}</span>
      </div>
    </div>
  );
}
