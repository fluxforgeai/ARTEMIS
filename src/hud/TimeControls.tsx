import { useCallback, useRef } from 'react';
import { useMissionStore } from '../store/mission-store';
import { LAUNCH_EPOCH, MISSION_DURATION_HOURS } from '../data/mission-config';

const RATE_PRESETS = [1, 10, 100, 1000, 10000];

export default function TimeControls() {
  const mode = useMissionStore((s) => s.timeControl.mode);
  const rate = useMissionStore((s) => s.timeControl.rate);
  const simEpochMs = useMissionStore((s) => s.timeControl.simEpochMs);

  const setTimeMode = useMissionStore((s) => s.setTimeMode);
  const setPlaybackRate = useMissionStore((s) => s.setPlaybackRate);
  const setSimTime = useMissionStore((s) => s.setSimTime);

  const lastRateRef = useRef(100);

  const metHours = Math.max(0, (simEpochMs - LAUNCH_EPOCH.getTime()) / 3_600_000);

  const handleScrub = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const hours = parseFloat(e.target.value);
    if (mode === 'live') setTimeMode('sim');
    setSimTime(LAUNCH_EPOCH.getTime() + hours * 3_600_000);
  }, [mode, setTimeMode, setSimTime]);

  const handlePlayPause = useCallback(() => {
    if (rate > 0) {
      lastRateRef.current = rate;
      setPlaybackRate(0);
      setTimeMode('sim');
    } else {
      setPlaybackRate(lastRateRef.current);
      setTimeMode('replay');
    }
  }, [rate, setPlaybackRate, setTimeMode]);

  const handleRate = useCallback((r: number) => {
    lastRateRef.current = r;
    setPlaybackRate(r);
    setTimeMode('replay');
  }, [setPlaybackRate, setTimeMode]);

  const stepTime = useCallback((deltaHours: number) => {
    if (mode === 'live') setTimeMode('sim');
    setSimTime(simEpochMs + deltaHours * 3_600_000);
  }, [mode, simEpochMs, setTimeMode, setSimTime]);

  const jumpToStart = useCallback(() => {
    setTimeMode('sim');
    setSimTime(LAUNCH_EPOCH.getTime());
  }, [setTimeMode, setSimTime]);

  const jumpToEnd = useCallback(() => {
    setTimeMode('sim');
    setSimTime(LAUNCH_EPOCH.getTime() + MISSION_DURATION_HOURS * 3_600_000);
  }, [setTimeMode, setSimTime]);

  const metDisplay = `T+${metHours.toFixed(1)}h`;
  const pct = ((metHours / MISSION_DURATION_HOURS) * 100).toFixed(1);

  return (
    <div className="bg-hud-glass backdrop-blur-sm border border-hud-border rounded-lg px-3 py-2 pointer-events-auto">
      {/* Row 1: Mode + Transport + Rate */}
      <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs">
        {/* Mode toggle */}
        <div className="flex gap-1">
          <button
            onClick={() => setTimeMode('live')}
            className={`flex items-center gap-1 px-2 py-0.5 rounded transition-colors ${
              mode === 'live'
                ? 'bg-[rgba(0,255,136,0.15)] border border-[rgba(0,255,136,0.4)] text-hud-green'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${mode === 'live' ? 'bg-hud-green animate-pulse' : 'bg-gray-600'}`} />
            LIVE
          </button>
          <button
            onClick={() => setTimeMode('sim')}
            className={`flex items-center gap-1 px-2 py-0.5 rounded transition-colors ${
              mode !== 'live'
                ? 'bg-[rgba(0,212,255,0.15)] border border-hud-border text-hud-blue'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${mode !== 'live' ? 'bg-hud-blue' : 'bg-gray-600'}`} />
            SIM
          </button>
        </div>

        {/* Transport — hidden on mobile */}
        <div className="hidden sm:flex items-center gap-1">
          <button onClick={jumpToStart} className="px-1 text-gray-400 hover:text-white" title="Jump to start">|&lt;</button>
          <button onClick={() => stepTime(-1)} className="px-1 text-gray-400 hover:text-white" title="Step back 1h">&lt;</button>
          <button onClick={handlePlayPause} className="px-1.5 text-gray-400 hover:text-white" title={rate > 0 ? 'Pause' : 'Play'}>
            {rate > 0 ? '||' : '\u25B6'}
          </button>
          <button onClick={() => stepTime(1)} className="px-1 text-gray-400 hover:text-white" title="Step forward 1h">&gt;</button>
          <button onClick={jumpToEnd} className="px-1 text-gray-400 hover:text-white" title="Jump to end">&gt;|</button>
        </div>

        {/* Mobile: play/pause + step */}
        <div className="flex sm:hidden items-center gap-1">
          <button onClick={() => stepTime(-1)} className="px-1 text-gray-400 hover:text-white">&lt;</button>
          <button onClick={handlePlayPause} className="px-1.5 text-gray-400 hover:text-white">
            {rate > 0 ? '||' : '\u25B6'}
          </button>
          <button onClick={() => stepTime(1)} className="px-1 text-gray-400 hover:text-white">&gt;</button>
        </div>

        {/* Rate buttons — desktop */}
        <div className="hidden sm:flex items-center gap-1">
          {RATE_PRESETS.map((r) => (
            <button
              key={r}
              onClick={() => handleRate(r)}
              className={`px-1.5 py-0.5 rounded transition-colors ${
                rate === r && mode === 'replay'
                  ? 'text-hud-blue bg-[rgba(0,212,255,0.15)]'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {r >= 1000 ? `${r / 1000}k` : `${r}x`}
            </button>
          ))}
        </div>

        {/* Rate — mobile: current rate only */}
        <button
          onClick={() => {
            const idx = RATE_PRESETS.indexOf(rate);
            const next = RATE_PRESETS[(idx + 1) % RATE_PRESETS.length];
            handleRate(next);
          }}
          className="sm:hidden text-gray-400 hover:text-hud-blue px-1"
        >
          {rate >= 1000 ? `${rate / 1000}kx` : `${rate}x`}
        </button>

        {/* MET display */}
        <span className="ml-auto text-gray-400 tabular-nums">
          {metDisplay} <span className="text-gray-600">/ {MISSION_DURATION_HOURS.toFixed(1)}h</span> <span className="text-gray-600">({pct}%)</span>
        </span>
      </div>

      {/* Row 2: Scrubber */}
      <div className="mt-1.5">
        <input
          type="range"
          min={0}
          max={MISSION_DURATION_HOURS}
          step={0.01}
          value={metHours}
          onChange={handleScrub}
          className="time-scrubber w-full"
        />
      </div>
    </div>
  );
}
