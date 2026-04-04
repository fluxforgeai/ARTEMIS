import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMission } from '../hooks/useMission';
import { useMissionStore } from '../store/mission-store';
import { MILESTONES } from '../data/mission-config';

const TOTAL_MISSION_HOURS = 240;

export default function ProgressBar() {
  const { progress, totalMs } = useMission();
  const setHoveredMilestoneHours = useMissionStore((s) => s.setHoveredMilestoneHours);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const elapsedHours = totalMs / 3_600_000;

  const { milestoneData, currentIndex } = useMemo(() => {
    // Sort milestones by time for display (Belt Transit at T+5h comes before OTB-1 at T+8h)
    const sorted = [...MILESTONES].sort((a, b) => a.missionElapsedHours - b.missionElapsedHours);

    const data = sorted.map((m, i) => {
      const position = (m.missionElapsedHours / TOTAL_MISSION_HOURS) * 100;
      const isComplete = elapsedHours >= m.missionElapsedHours;
      const isNext = i > 0 && elapsedHours < m.missionElapsedHours &&
        elapsedHours >= sorted[i - 1].missionElapsedHours;
      return { ...m, position, isComplete, isNext, index: i };
    });

    let idx = 0;
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (elapsedHours >= sorted[i].missionElapsedHours) {
        idx = i;
        break;
      }
    }

    return { milestoneData: data, currentIndex: idx };
  }, [elapsedHours]);

  const nextMilestone = milestoneData[currentIndex + 1] ?? null;
  const countdown = useMemo(() => {
    if (!nextMilestone) return null;
    const remainingHours = nextMilestone.missionElapsedHours - elapsedHours;
    if (remainingHours <= 0) return null;
    const d = Math.floor(remainingHours / 24);
    const h = Math.floor(remainingHours % 24);
    const m = Math.floor((remainingHours % 1) * 60);
    const parts: string[] = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    parts.push(`${m}m`);
    return parts.join(' ');
  }, [nextMilestone, elapsedHours]);

  function handleHover(i: number) {
    setHoveredIndex(i);
    setHoveredMilestoneHours(milestoneData[i].missionElapsedHours);
  }

  function handleLeave() {
    setHoveredIndex(null);
    setHoveredMilestoneHours(null);
  }

  return (
    <div className="bg-[rgba(10,10,30,0.7)] backdrop-blur-sm border border-[rgba(0,212,255,0.2)] rounded-lg px-4 py-3 min-w-[200px] sm:min-w-[420px] col-span-2 sm:col-span-1 sm:flex-1 sm:mr-16">
      <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Mission Progress</div>
      <div className="flex items-center gap-2">
        {/* Track wrapper — relative for markers, inner overflow-hidden for fill */}
        <div className="flex-1 relative h-2">
          {/* Fill bar */}
          <div className="absolute inset-0 bg-[rgba(255,255,255,0.1)] rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[#ff8c00] to-[#00d4ff]"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />
          </div>

          {/* Milestone markers */}
          {milestoneData.map((m, i) => (
            <div
              key={m.name}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10"
              style={{ left: `${m.position}%` }}
              onMouseEnter={() => handleHover(i)}
              onMouseLeave={handleLeave}
              onTouchStart={() => handleHover(i)}
              onTouchEnd={handleLeave}
            >
              {i === currentIndex ? (
                <motion.div
                  className="w-1.5 h-1.5 sm:w-[6px] sm:h-[6px] rounded-full bg-[#00d4ff] cursor-pointer"
                  animate={{
                    boxShadow: [
                      '0 0 4px rgba(0,212,255,0.4)',
                      '0 0 10px rgba(0,212,255,0.7)',
                    ],
                  }}
                  transition={{ repeat: Infinity, repeatType: 'reverse', duration: 1.5 }}
                />
              ) : (
                <div
                  className={`w-1.5 h-1.5 sm:w-[6px] sm:h-[6px] rounded-full cursor-pointer ${
                    m.isComplete
                      ? 'bg-[#00ff88] shadow-[0_0_4px_rgba(0,255,136,0.3)]'
                      : 'bg-gray-600'
                  }`}
                />
              )}

              {/* Tooltip */}
              <AnimatePresence>
                {hoveredIndex === i && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.15 }}
                    className={`absolute bottom-full mb-2 z-50 bg-[rgba(10,10,30,0.9)] backdrop-blur-sm border border-[rgba(0,212,255,0.2)] rounded px-2 py-1.5 max-w-[200px] whitespace-normal ${
                      m.position < 10 ? 'left-0' : m.position > 90 ? 'right-0' : 'left-1/2 -translate-x-1/2'
                    }`}
                  >
                    <div className="text-[10px] text-white font-mono font-bold">{m.name}</div>
                    <div className="text-[9px] text-gray-400 mt-0.5">{m.description}</div>
                    <div className="text-[9px] text-gray-500 mt-0.5">T+{m.missionElapsedHours}h</div>
                    <div className="text-[9px] text-[#00d4ff]/60 mt-0.5">Hover to see on trajectory</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
        <span className="text-sm font-mono text-hud-blue font-bold whitespace-nowrap">
          {progress.toFixed(1)}%
        </span>
      </div>
      {/* Next milestone countdown */}
      <div className="text-[9px] sm:text-[10px] text-[#00d4ff]/70 mt-1">
        {nextMilestone && countdown
          ? `Next: ${nextMilestone.name} in ${countdown}`
          : 'Mission Complete'}
      </div>
    </div>
  );
}
