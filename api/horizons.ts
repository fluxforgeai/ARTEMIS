import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=300');

  const now = new Date();
  const startTime = now.toISOString().split('.')[0];
  const stopTime = new Date(now.getTime() + 60000).toISOString().split('.')[0];

  const params = new URLSearchParams({
    format: 'json',
    COMMAND: "'301'",
    CENTER: "'500@399'",
    MAKE_EPHEM: 'YES',
    EPHEM_TYPE: 'VECTORS',
    START_TIME: `'${startTime}'`,
    STOP_TIME: `'${stopTime}'`,
    STEP_SIZE: "'1'",
    VEC_TABLE: "'2'",
    REF_PLANE: "'FRAME'",
  });

  try {
    const upstream = await fetch(`https://ssd.jpl.nasa.gov/api/horizons.api?${params}`);
    if (!upstream.ok) throw new Error(`Horizons upstream ${upstream.status}`);
    const data = await upstream.json();
    res.status(200).json(data);
  } catch {
    res.status(502).json({ error: 'Failed to fetch Horizons data' });
  }
}
