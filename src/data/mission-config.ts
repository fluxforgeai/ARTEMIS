export const LAUNCH_EPOCH = new Date('2026-04-01T22:35:00Z');
export const MISSION_DURATION_DAYS = 217.53 / 24; // 9.064 days — NASA actual splashdown T+217.53h
export const MISSION_DURATION_HOURS = MISSION_DURATION_DAYS * 24; // 217.53h
export const MISSION_END_EPOCH = new Date(LAUNCH_EPOCH.getTime() + MISSION_DURATION_DAYS * 24 * 60 * 60 * 1000);

export const SCALE_FACTOR = 10_000; // 1 Three.js unit = 10,000 km

export interface CrewMember {
  name: string;
  role: string;
  agency: string;
}

export const CREW: CrewMember[] = [
  { name: 'Reid Wiseman', role: 'Commander', agency: 'NASA' },
  { name: 'Victor Glover', role: 'Pilot', agency: 'NASA' },
  { name: 'Christina Koch', role: 'Mission Specialist', agency: 'NASA' },
  { name: 'Jeremy Hansen', role: 'Mission Specialist', agency: 'CSA' },
];

export interface Milestone {
  name: string;
  missionElapsedHours: number;
  description: string;
}

export const MILESTONES: Milestone[] = [
  { name: 'Launch', missionElapsedHours: 0, description: 'SLS lifts off from LC-39B, Kennedy Space Center' },
  { name: 'SRB Separation', missionElapsedHours: 0.036, description: 'Solid rocket boosters jettison at T+2m08s' },
  { name: 'Core Stage Sep', missionElapsedHours: 0.138, description: 'Core stage MECO and separation, ICPS takes over' },
  { name: 'Perigee Raise', missionElapsedHours: 0.817, description: 'ICPS perigee raise burn at T+49 min — orbit to 115 × 1,381 mi' },
  { name: 'ICPS Separation', missionElapsedHours: 3.40, description: 'ICPS separates after proximity operations demo at T+3h24m' },
  { name: 'Belt Transit', missionElapsedHours: 3.8, description: 'Orion transits the inner Van Allen radiation belt' },
  { name: 'TLI Burn', missionElapsedHours: 25.23, description: 'Translunar Injection at phasing orbit perigee — Orion ESM engine, 5m50s burn' },
  { name: 'OTB-1', missionElapsedHours: 28.2, description: 'Outbound Trajectory Burn 1 — waived, trajectory sufficiently precise' },
  { name: 'Star Tracker Cal', missionElapsedHours: 36, description: 'Navigation star tracker calibration and crew observation' },
  { name: 'MCC-1', missionElapsedHours: 48, description: 'Mid-Course Correction 1 — refine lunar approach trajectory' },
  { name: 'Lunar Approach', missionElapsedHours: 102, description: 'Entering lunar sphere of influence (~66,000 km from Moon)' },
  { name: 'Lunar Flyby', missionElapsedHours: 120.45, description: 'Closest approach — 6,543 km (4,066 mi) above lunar far side' },
  { name: 'Return Burn', missionElapsedHours: 139, description: 'Return trajectory correction near lunar SOI exit' },
  { name: 'Return Coast', missionElapsedHours: 144, description: 'Free return coast toward Earth' },
  { name: 'MCC-3', missionElapsedHours: 200, description: 'Final mid-course correction — precision entry targeting' },
  { name: 'CM/SM Sep', missionElapsedHours: 217.0, description: 'Crew Module separates from Service Module' },
  { name: 'Entry Interface', missionElapsedHours: 217.3, description: 'Orion enters Earth atmosphere at ~40,000 km/h (122 km altitude)' },
  { name: 'Splashdown', missionElapsedHours: 217.53, description: 'Pacific Ocean splashdown off San Diego — recovery by USS Portland' },
];

export function getMissionElapsed(now: Date = new Date()): {
  totalMs: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  formatted: string;
  progress: number;
  currentPhase: string;
} {
  const totalMs = now.getTime() - LAUNCH_EPOCH.getTime();
  const totalSeconds = Math.max(0, Math.floor(totalMs / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number, d = 2) => String(n).padStart(d, '0');
  const formatted = `M+ ${pad(days)}:${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

  const totalDurationMs = MISSION_DURATION_DAYS * 24 * 60 * 60 * 1000;
  const progress = Math.min(100, Math.max(0, (totalMs / totalDurationMs) * 100));

  const elapsedHours = totalMs / (1000 * 60 * 60);
  let currentPhase = MILESTONES[0].name;
  for (const m of MILESTONES) {
    if (elapsedHours >= m.missionElapsedHours) {
      currentPhase = m.name;
    }
  }

  return { totalMs, days, hours, minutes, seconds, formatted, progress, currentPhase };
}
