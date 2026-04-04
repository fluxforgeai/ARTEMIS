import type { RadiationZone, RadiationLevel, SpaceWeatherState } from '../store/mission-store';

interface ScriptedEvent {
  type: string;
  description: string;
}

// Van Allen belt thresholds (Earth distance in km)
function getRadiationZone(earthDistKm: number): RadiationZone {
  if (earthDistKm < 1_000) return 'clear';         // Below inner belt
  if (earthDistKm < 6_000) return 'inner-belt';     // Inner belt: 1,000-6,000 km
  if (earthDistKm < 13_000) return 'slot-region';   // Slot: 6,000-13,000 km
  if (earthDistKm < 60_000) return 'outer-belt';    // Outer belt: 13,000-60,000 km
  return 'deep-space';                               // Beyond belts
}

// Piecewise Kp baseline curve tied to mission elapsed time
function getBaselineKp(metHours: number): number {
  if (metHours < 0) return 3;
  if (metHours < 3) return 4;      // Launch + Van Allen transit
  if (metHours < 24) return 3;     // Early outbound
  if (metHours < 44) return 2;     // Quiet outbound coast
  if (metHours < 52) return 5;     // Flare event window (~48h)
  if (metHours < 90) return 2;     // Post-flare quiet
  if (metHours < 100) return 3;    // Pre-flyby approach
  if (metHours < 115) return 2;    // Lunar flyby region
  if (metHours < 124) return 6;    // CME event window (~120h)
  if (metHours < 128) return 4;    // CME recovery
  if (metHours < 220) return 3;    // Return coast
  return 4;                         // Re-entry approach
}

// Shared empty array to avoid allocating a new [] when no events are active
const EMPTY_EVENTS: ScriptedEvent[] = [];

// Scripted solar events
function getScriptedEvents(metHours: number): ScriptedEvent[] {
  const events: ScriptedEvent[] = [];

  // M2.3 solar flare at MET ~48h, 4h duration
  if (metHours >= 48 && metHours < 52) {
    events.push({ type: 'flare', description: 'M2.3 Solar Flare — elevated particle flux' });
  }

  // CME arrival at MET ~120h, 8h duration
  if (metHours >= 120 && metHours < 128) {
    events.push({ type: 'cme', description: 'CME Arrival — geomagnetic storm conditions' });
  }

  return events.length > 0 ? events : EMPTY_EVENTS;
}

// Radiation dose rate based on zone and events
function getDoseRate(zone: RadiationZone, events: ScriptedEvent[]): number {
  const baseDose: Record<RadiationZone, number> = {
    'clear': 0.5,
    'deep-space': 5,
    'outer-belt': 25,
    'slot-region': 40,
    'inner-belt': 80,
  };
  let dose = baseDose[zone];
  // Events boost dose
  for (const e of events) {
    if (e.type === 'flare') dose += 15;
    if (e.type === 'cme') dose += 30;
  }
  return dose;
}

function getRadiationLevel(doseRate: number): RadiationLevel {
  if (doseRate < 10) return 'nominal';
  if (doseRate < 35) return 'elevated';
  if (doseRate < 60) return 'high';
  return 'severe';
}

/**
 * Generate synthetic space weather data.
 * Pure function: same inputs always produce the same outputs.
 */
export function generateSpaceWeather(
  missionElapsedMs: number,
  earthDistKm: number,
): SpaceWeatherState {
  const metHours = missionElapsedMs / 3_600_000;
  const radiationZone = getRadiationZone(earthDistKm);
  const kpIndex = getBaselineKp(metHours);
  const solarWindSpeed = 350 + kpIndex * 40;
  const solarWindDensity = 3 + kpIndex * 1.5;
  const activeEvents = getScriptedEvents(metHours);
  const radiationDoseRate = getDoseRate(radiationZone, activeEvents);
  const radiationLevel = getRadiationLevel(radiationDoseRate);

  return {
    kpIndex,
    solarWindSpeed,
    solarWindDensity,
    radiationZone,
    radiationDoseRate,
    radiationLevel,
    activeEvents,
    source: 'synthetic',
    lastUpdated: Date.now(),
  };
}
