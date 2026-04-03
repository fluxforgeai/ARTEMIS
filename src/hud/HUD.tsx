import { useMissionStore } from '../store/mission-store';
import TelemetryCard from './TelemetryCard';
import MissionClock from './MissionClock';
import ProgressBar from './ProgressBar';
import DSNStatus from './DSNStatus';
import CameraControls from './CameraControls';

function SpeedCard() {
  const speed = useMissionStore((s) => s.spacecraft.speed);
  return <TelemetryCard label="Speed" value={speed} unit="km/h" color="#ff8c00" />;
}

function EarthDistCard() {
  const earthDist = useMissionStore((s) => s.spacecraft.earthDist);
  return <TelemetryCard label="Earth" value={earthDist} unit="km" color="#00d4ff" />;
}

function MoonDistCard() {
  const moonDist = useMissionStore((s) => s.spacecraft.moonDist);
  return <TelemetryCard label="Moon" value={moonDist ?? 0} unit="km" color="#aaaaaa" />;
}

export default function HUD() {
  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-2 sm:p-4 z-10">
      {/* Top bar */}
      <div className="flex items-center justify-between pointer-events-auto">
        <h1 className="text-base sm:text-xl font-bold tracking-widest text-white">
          ARTEMIS <span className="text-hud-blue">II</span>
        </h1>
        <MissionClock />
      </div>

      {/* Bottom section */}
      <div className="flex flex-col gap-2 sm:gap-3">
        {/* DSN + Camera controls — stack on mobile */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pointer-events-auto">
          <DSNStatus />
          <CameraControls />
        </div>

        {/* Telemetry cards — grid on mobile, flex on desktop */}
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-3 pointer-events-auto">
          <SpeedCard />
          <EarthDistCard />
          <MoonDistCard />
          <ProgressBar />
        </div>
      </div>
    </div>
  );
}
