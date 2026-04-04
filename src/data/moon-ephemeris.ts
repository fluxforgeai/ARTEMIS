/**
 * JPL Horizons geocentric J2000 Moon ephemeris for Artemis II mission window.
 * Source: https://ssd.jpl.nasa.gov/api/horizons.api
 * CENTER='500@399' (Earth geocentric), REF_SYSTEM='J2000', REF_PLANE='FRAME'
 * Matches OEM data's REF_FRAME = EME2000.
 * 37 data points at 6-hour intervals, April 2-11 2026 (~2 KB).
 */

import { SCALE_FACTOR } from './mission-config';

interface EphemerisPoint {
  epochMs: number;
  x: number; // km
  y: number;
  z: number;
}

const RAW_DATA: { t: string; x: number; y: number; z: number }[] = [
  {"t":"2026-04-02T00:00","x":-385833.807,"y":-60038.527,"z":-46890.717},
  {"t":"2026-04-02T06:00","x":-381939.648,"y":-78884.887,"z":-56872.562},
  {"t":"2026-04-02T12:00","x":-376885.521,"y":-97491.542,"z":-66680.371},
  {"t":"2026-04-02T18:00","x":-370694.333,"y":-115802.919,"z":-76285.141},
  {"t":"2026-04-03T00:00","x":-363392.052,"y":-133765.009,"z":-85658.833},
  {"t":"2026-04-03T06:00","x":-355007.554,"y":-151325.481,"z":-94774.423},
  {"t":"2026-04-03T12:00","x":-345572.460,"y":-168433.785,"z":-103605.961},
  {"t":"2026-04-03T18:00","x":-335120.984,"y":-185041.244,"z":-112128.605},
  {"t":"2026-04-04T00:00","x":-323689.769,"y":-201101.132,"z":-120318.662},
  {"t":"2026-04-04T06:00","x":-311317.733,"y":-216568.744,"z":-128153.615},
  {"t":"2026-04-04T12:00","x":-298045.917,"y":-231401.450,"z":-135612.152},
  {"t":"2026-04-04T18:00","x":-283917.326,"y":-245558.747,"z":-142674.185},
  {"t":"2026-04-05T00:00","x":-268976.793,"y":-259002.295,"z":-149320.861},
  {"t":"2026-04-05T06:00","x":-253270.829,"y":-271695.948,"z":-155534.579},
  {"t":"2026-04-05T12:00","x":-236847.495,"y":-283605.778,"z":-161298.991},
  {"t":"2026-04-05T18:00","x":-219756.266,"y":-294700.093,"z":-166599.011},
  {"t":"2026-04-06T00:00","x":-202047.917,"y":-304949.445,"z":-171420.816},
  {"t":"2026-04-06T06:00","x":-183774.398,"y":-314326.643,"z":-175751.842},
  {"t":"2026-04-06T12:00","x":-164988.735,"y":-322806.754,"z":-179580.784},
  {"t":"2026-04-06T18:00","x":-145744.921,"y":-330367.107,"z":-182897.596},
  {"t":"2026-04-07T00:00","x":-126097.825,"y":-336987.291,"z":-185693.483},
  {"t":"2026-04-07T06:00","x":-106103.101,"y":-342649.159,"z":-187960.900},
  {"t":"2026-04-07T12:00","x":-85817.105,"y":-347336.829,"z":-189693.548},
  {"t":"2026-04-07T18:00","x":-65296.821,"y":-351036.682,"z":-190886.373},
  {"t":"2026-04-08T00:00","x":-44599.781,"y":-353737.371,"z":-191535.566},
  {"t":"2026-04-08T06:00","x":-23784.001,"y":-355429.827,"z":-191638.563},
  {"t":"2026-04-08T12:00","x":-2907.914,"y":-356107.270,"z":-191194.045},
  {"t":"2026-04-08T18:00","x":17969.697,"y":-355765.220,"z":-190201.950},
  {"t":"2026-04-09T00:00","x":38789.761,"y":-354401.523,"z":-188663.472},
  {"t":"2026-04-09T06:00","x":59492.982,"y":-352016.367,"z":-186581.079},
  {"t":"2026-04-09T12:00","x":80019.905,"y":-348612.317,"z":-183958.520},
  {"t":"2026-04-09T18:00","x":100310.982,"y":-344194.345,"z":-180800.842},
  {"t":"2026-04-10T00:00","x":120306.645,"y":-338769.871,"z":-177114.409},
  {"t":"2026-04-10T06:00","x":139947.381,"y":-332348.808,"z":-172906.919},
  {"t":"2026-04-10T12:00","x":159173.819,"y":-324943.607,"z":-168187.430},
  {"t":"2026-04-10T18:00","x":177926.816,"y":-316569.312,"z":-162966.385},
  {"t":"2026-04-11T00:00","x":196147.562,"y":-307243.620,"z":-157255.635},
];

const EPHEMERIS: EphemerisPoint[] = RAW_DATA.map((d) => ({
  epochMs: new Date(d.t + 'Z').getTime(),
  x: d.x,
  y: d.y,
  z: d.z,
}));

/** Interpolate Moon position (in scene units) at a given timestamp. */
export function getMoonPosition(timeMs: number): [number, number, number] {
  // Clamp to data range
  if (timeMs <= EPHEMERIS[0].epochMs) {
    const p = EPHEMERIS[0];
    return [p.x / SCALE_FACTOR, p.y / SCALE_FACTOR, p.z / SCALE_FACTOR];
  }
  if (timeMs >= EPHEMERIS[EPHEMERIS.length - 1].epochMs) {
    const p = EPHEMERIS[EPHEMERIS.length - 1];
    return [p.x / SCALE_FACTOR, p.y / SCALE_FACTOR, p.z / SCALE_FACTOR];
  }

  // Find bracketing interval
  let lo = 0;
  for (let i = 1; i < EPHEMERIS.length; i++) {
    if (EPHEMERIS[i].epochMs >= timeMs) { lo = i - 1; break; }
  }
  const a = EPHEMERIS[lo];
  const b = EPHEMERIS[lo + 1];

  // Linear interpolation
  const frac = (timeMs - a.epochMs) / (b.epochMs - a.epochMs);
  return [
    (a.x + (b.x - a.x) * frac) / SCALE_FACTOR,
    (a.y + (b.y - a.y) * frac) / SCALE_FACTOR,
    (a.z + (b.z - a.z) * frac) / SCALE_FACTOR,
  ];
}

/** Get Moon position at the flyby epoch (2026-04-06T23:06 UTC) for static placement. */
export function getMoonFlybyPosition(): [number, number, number] {
  return getMoonPosition(new Date('2026-04-06T23:06:00Z').getTime());
}
