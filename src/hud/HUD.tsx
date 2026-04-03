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
  return <TelemetryCard label="Distance from Earth" value={earthDist} unit="km" color="#00d4ff" />;
}

function MoonDistCard() {
  const moonDist = useMissionStore((s) => s.spacecraft.moonDist);
  return <TelemetryCard label="Distance to Moon" value={moonDist ?? 0} unit="km" color="#aaaaaa" />;
}

export default function HUD() {
  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 z-10">
      {/* Top bar */}
      <div className="flex items-center justify-between pointer-events-auto">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-widest text-white">
            ARTEMIS <span className="text-hud-blue">II</span>
          </h1>
        </div>
        <MissionClock />
      </div>

      {/* Bottom section */}
      <div className="flex flex-col gap-3">
        {/* DSN + Camera controls */}
        <div className="flex items-center justify-between pointer-events-auto">
          <DSNStatus />
          <CameraControls />
        </div>

        {/* Telemetry cards — each subscribes to its own scalar */}
        <div className="flex items-center gap-3 pointer-events-auto flex-wrap">
          <SpeedCard />
          <EarthDistCard />
          <MoonDistCard />
          <ProgressBar />
        </div>
      </div>
    </div>
  );
}
