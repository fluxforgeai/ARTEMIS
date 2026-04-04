import { useState, memo, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useMissionStore } from '../store/mission-store';
import TelemetryCard from './TelemetryCard';
import MissionClock from './MissionClock';
import ProgressBar from './ProgressBar';
import DSNStatus from './DSNStatus';
import CameraControls from './CameraControls';
import CrewPanel from './CrewPanel';
import MissionEventsPanel from './MissionEventsPanel';
import SpaceWeatherPanel from './SpaceWeatherPanel';
import { useSpaceWeather } from '../hooks/useSpaceWeather';
import { useAlerts } from '../hooks/useAlerts';

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
  const [moreOpen, setMoreOpen] = useState(false);
  const handleCrewClose = useCallback(() => setCrewOpen(false), []);
  const toggleMore = useCallback(() => setMoreOpen((prev) => !prev), []);

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-2 sm:p-4 z-[var(--z-hud)] isolate safe-area-pad">
      <WeatherAlertDriver />
      {/* Top bar */}
      <div className="flex items-center justify-between pointer-events-auto">
        <div className="relative flex items-center gap-2 sm:gap-3">
          <h1 className="text-base sm:text-xl font-bold tracking-widest text-white">
            ARTEMIS <span className="text-hud-blue">II</span>
          </h1>
          <button
            onClick={() => setCrewOpen(!crewOpen)}
            className={`px-2 py-2 sm:px-1.5 sm:py-0.5 -mx-0.5 rounded transition-colors ${crewOpen ? 'text-[#00d4ff]' : 'text-gray-400 hover:text-[#00d4ff]'}`}
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
        <div className="flex items-center gap-2 sm:gap-3">
          <MissionEventsPanel />
          <MissionClock />
        </div>
      </div>

      {/* Bottom section */}
      <div className="flex flex-col gap-2 sm:gap-3">
        {/* Secondary row — desktop only */}
        <div className="hidden sm:flex items-center justify-between gap-2 pointer-events-auto">
          <DSNStatus />
          <SpaceWeatherPanel />
          <CameraControls />
        </div>

        {/* Mobile "More" expandable section */}
        <AnimatePresence>
          {moreOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="sm:hidden flex flex-col gap-2 overflow-hidden pointer-events-auto"
            >
              <MoonDistCard />
              <DSNStatus />
              <SpaceWeatherPanel />
              <CameraControls />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Primary telemetry — always visible */}
        {/* sm:pr-16 reserves space for chat toggle — see RCA docs/RCAs/2026-04-04_2045_progressbar_overlay_and_height.md */}
        <div className="grid grid-cols-2 sm:flex sm:items-end gap-2 sm:gap-3 sm:pr-16 pointer-events-auto">
          <SpeedCard />
          <EarthDistCard />
          <div className="hidden sm:block">
            <MoonDistCard />
          </div>
          <ProgressBar />
        </div>

        {/* Mobile "More" toggle */}
        <button
          onClick={toggleMore}
          className="sm:hidden flex items-center justify-center gap-1 py-2 text-[10px] text-gray-400 active:text-gray-200 pointer-events-auto"
          aria-expanded={moreOpen}
          aria-label={moreOpen ? 'Show less telemetry' : 'Show more telemetry'}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`transition-transform duration-200 ${moreOpen ? 'rotate-180' : ''}`}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
          {moreOpen ? 'Less' : 'More telemetry'}
        </button>
      </div>
    </div>
  );
}
