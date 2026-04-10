import { memo } from 'react';
import { useMissionStore } from '../store/mission-store';

const STATION_NAMES: Record<string, string> = {
  gdscc: 'Goldstone',
  cdscc: 'Canberra',
  mdscc: 'Madrid',
};

export default memo(function DSNStatus() {
  const stations = useMissionStore((s) => s.dsnStations);
  const timeMode = useMissionStore((s) => s.timeControl.mode);

  const stationStatuses = ['gdscc', 'cdscc', 'mdscc'].map((id) => {
    const station = stations.find((s) => s.name === id);
    const hasOrion = station
      ? station.dishes.some((d) =>
          d.targets.some((t) => {
            const name = t.name.toUpperCase();
            return name.includes('ORION') || name.includes('ARTEMIS') || name.includes('EM2') || name.includes('EM-2');
          })
        )
      : false;

    return {
      id,
      name: STATION_NAMES[id] || id,
      active: hasOrion,
    };
  });

  const anyActive = stationStatuses.some((s) => s.active);
  const activeCount = stationStatuses.filter((s) => s.active).length;

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <span className="text-[10px] uppercase tracking-wider text-gray-400">DSN{timeMode !== 'live' ? ' (SIM)' : ''}</span>
      {/* Mobile: compact summary */}
      <div className="sm:hidden flex items-center gap-1.5">
        <div className={`w-2 h-2 rounded-full ${anyActive ? 'bg-[#00ff88] shadow-[0_0_6px_rgba(0,255,136,0.5)]' : 'bg-gray-600'}`} />
        <span className={`text-xs ${anyActive ? 'text-[#00ff88]' : 'text-gray-500'}`}>
          {activeCount}/{stationStatuses.length}
        </span>
      </div>
      {/* Desktop: full station list */}
      {stationStatuses.map((s) => (
        <div key={s.id} className="hidden sm:flex items-center gap-1.5">
          <div
            className={`w-2 h-2 rounded-full ${
              s.active ? 'bg-[#00ff88] shadow-[0_0_6px_rgba(0,255,136,0.5)]' : 'bg-gray-600'
            }`}
          />
          <span className={`text-xs ${s.active ? 'text-[#00ff88]' : 'text-gray-500'}`}>
            {s.name}
          </span>
        </div>
      ))}
    </div>
  );
})
