import { useMissionStore } from '../store/mission-store';
import type { RadiationZone } from '../store/mission-store';

const KP_COLOR: Record<string, string> = {
  low: 'bg-[#00ff88] shadow-[0_0_6px_rgba(0,255,136,0.5)]',
  mid: 'bg-[#ff8c00] shadow-[0_0_6px_rgba(255,140,0,0.5)]',
  high: 'bg-[#ff4444] shadow-[0_0_6px_rgba(255,68,68,0.5)]',
};

function kpColor(kp: number): string {
  if (kp <= 3) return KP_COLOR.low;
  if (kp <= 5) return KP_COLOR.mid;
  return KP_COLOR.high;
}

const ZONE_COLOR: Record<RadiationZone, string> = {
  'clear': 'bg-[#00ff88] shadow-[0_0_6px_rgba(0,255,136,0.5)]',
  'deep-space': 'bg-[#00ff88] shadow-[0_0_6px_rgba(0,255,136,0.5)]',
  'outer-belt': 'bg-[#ff8c00] shadow-[0_0_6px_rgba(255,140,0,0.5)]',
  'slot-region': 'bg-[#ff8c00] shadow-[0_0_6px_rgba(255,140,0,0.5)]',
  'inner-belt': 'bg-[#ff4444] shadow-[0_0_6px_rgba(255,68,68,0.5)]',
};

const ZONE_LABEL: Record<RadiationZone, string> = {
  'clear': 'CLR',
  'deep-space': 'DEEP',
  'outer-belt': 'OUTER',
  'slot-region': 'SLOT',
  'inner-belt': 'INNER',
};

export default function SpaceWeatherPanel() {
  const kpIndex = useMissionStore((s) => s.spaceWeather.kpIndex);
  const solarWindSpeed = useMissionStore((s) => s.spaceWeather.solarWindSpeed);
  const radiationZone = useMissionStore((s) => s.spaceWeather.radiationZone);
  const source = useMissionStore((s) => s.spaceWeather.source);

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="text-[10px] uppercase tracking-wider text-gray-400">Space WX</span>

      {/* Kp Index */}
      <div className="flex items-center gap-1.5">
        <div className={`w-2 h-2 rounded-full ${kpColor(kpIndex)}`} />
        <span className="text-xs text-white font-mono">Kp {kpIndex}</span>
      </div>

      {/* Solar Wind */}
      <div className="flex items-center gap-1">
        <span className="text-xs text-white font-mono">{solarWindSpeed}</span>
        <span className="text-[10px] text-gray-500">km/s</span>
      </div>

      {/* Radiation Zone */}
      <div className="flex items-center gap-1.5">
        <div className={`w-2 h-2 rounded-full ${ZONE_COLOR[radiationZone]}`} />
        <span className="text-xs text-white font-mono">{ZONE_LABEL[radiationZone]}</span>
      </div>

      {/* Source badge */}
      <div className="flex items-center gap-1">
        <div className="w-1.5 h-1.5 rounded-full bg-gray-600" />
        <span className="text-[9px] text-gray-500 uppercase">{source === 'synthetic' ? 'SIM' : 'LIVE'}</span>
      </div>
    </div>
  );
}
