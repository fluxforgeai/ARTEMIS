import { useState, memo, useCallback } from 'react';
import { useMissionStore } from '../store/mission-store';
import TelemetryCard from './TelemetryCard';
import MissionClock from './MissionClock';
import ProgressBar from './ProgressBar';
import DSNStatus from './DSNStatus';
import CameraControls from './CameraControls';
import CrewPanel from './CrewPanel';
import AlertsBanner from './AlertsBanner';
import SpaceWeatherPanel from './SpaceWeatherPanel';
import { useSpaceWeather } from '../hooks/useSpaceWeather';
import { useAlerts } from '../hooks/useAlerts';

/** Isolates subscription hooks from the HUD component tree */
function WeatherAlertDriver() {
  useSpaceWeather();
  useAlerts();
  return null;
}

const SpeedCard = memo(function SpeedCard() {
  const speed = useMissionStore((s) => s.spacecraft.speed);
  return <TelemetryCard label="Speed" value={speed} unit="km/h" color="#ff8c00" />;
});

const EarthDistCard = memo(function EarthDistCard() {
  const earthDist = useMissionStore((s) => s.spacecraft.earthDist);
  return <TelemetryCard label="Earth" value={earthDist} unit="km" color="#00d4ff" />;
});

const MoonDistCard = memo(function MoonDistCard() {
  const moonDist = useMissionStore((s) => s.spacecraft.moonDist);
  return <TelemetryCard label="Moon" value={moonDist ?? 0} unit="km" color="#aaaaaa" />;
});

export default function HUD() {
  const [crewOpen, setCrewOpen] = useState(false);
  const handleCrewClose = useCallback(() => setCrewOpen(false), []);

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-2 sm:p-4 z-10">
      <WeatherAlertDriver />
      {/* Alert notifications */}
      <AlertsBanner />
      {/* Top bar */}
      <div className="flex items-center justify-between pointer-events-auto">
        <div className="relative flex items-center gap-2 sm:gap-3">
          <h1 className="text-base sm:text-xl font-bold tracking-widest text-white">
            ARTEMIS <span className="text-hud-blue">II</span>
          </h1>
          <button
            onClick={() => setCrewOpen(!crewOpen)}
            className={`pointer-events-auto px-1.5 py-0.5 rounded transition-colors ${crewOpen ? 'text-[#00d4ff]' : 'text-gray-400 hover:text-[#00d4ff]'}`}
            title="Crew"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="7" r="3" />
              <circle cx="17" cy="7" r="3" />
              <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
              <path d="M17 14a4 4 0 0 1 4 4v3" />
            </svg>
          </button>
          <CrewPanel isOpen={crewOpen} onClose={handleCrewClose} />
        </div>
        <MissionClock />
      </div>

      {/* Bottom section */}
      <div className="flex flex-col gap-2 sm:gap-3">
        {/* DSN + Camera controls — stack on mobile */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pointer-events-auto">
          <DSNStatus />
          <SpaceWeatherPanel />
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
