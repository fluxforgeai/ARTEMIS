import { useMission } from '../hooks/useMission';

export default function MissionClock() {
  const { formatted, currentPhase } = useMission();

  return (
    <div className="flex items-center gap-2 sm:gap-4">
      <span className="text-hud-blue font-mono text-xs sm:text-lg font-bold tracking-wider">
        {formatted}
      </span>
      <span className="text-[9px] sm:text-xs text-gray-400 uppercase tracking-wider hidden sm:inline">
        {currentPhase}
      </span>
    </div>
  );
}
