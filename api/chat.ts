import type { VercelRequest, VercelResponse } from '@vercel/node';

const LAUNCH_EPOCH_MS = Date.UTC(2026, 3, 1, 22, 35, 0); // April 1, 2026 22:35 UTC

// --- Intent Detection ---

type Intent = 'text' | 'image' | 'nasa-image' | 'chart' | 'video';

const VIDEO_RE = /video|watch|footage|clip|stream/;
const CHART_RE = /chart|graph|plot|altitude over|velocity over|speed over|distance over/;
const NASA_IMAGE_RE = /photo|picture|image|show me|what does.*look|visual/;
const IMAGE_RE = /draw|diagram|illustrat|generate|create|design|sketch/;

function detectIntent(text: string): Intent {
  const lower = text.toLowerCase();
  if (VIDEO_RE.test(lower)) return 'video';
  if (CHART_RE.test(lower)) return 'chart';
  if (NASA_IMAGE_RE.test(lower)) return 'nasa-image';
  if (IMAGE_RE.test(lower)) return 'image';
  return 'text';
}

// --- Curated Video Lookup (server-side, avoids importing from src/) ---

const CURATED_VIDEOS: Array<{ keywords: string[]; videoId: string; title: string }> = [
  { keywords: ['launch', 'liftoff', 'takeoff', 'sls'], videoId: '_eeZQw9PBc0', title: 'Artemis II Launches Astronauts to the Moon (Official NASA Recap)' },
  { keywords: ['tli', 'translunar', 'injection', 'burn'], videoId: 'Ke6XX8FHOHM', title: 'Artemis II to the Moon: Launch to Splashdown (Mission Animation)' },
  { keywords: ['crew', 'astronaut', 'wiseman', 'glover', 'koch', 'hansen'], videoId: 'lPyl6d2FJGw', title: 'Meet the Astronauts Who will Fly Around the Moon' },
  { keywords: ['moon', 'lunar', 'flyby'], videoId: '6RwfNBtepa4', title: "NASA's Artemis II Live Views from Orion" },
  { keywords: ['orion', 'spacecraft'], videoId: '0uWzj4AiiZ8', title: "Artemis II Astronauts' First Look at Their Lunar Spacecraft" },
  { keywords: ['splashdown', 'return', 'reentry'], videoId: 'Vg-EQ7MOu6I', title: 'Around the Moon for All Humanity: Artemis II (Official Launch Trailer)' },
  { keywords: ['artemis', 'program', 'overview', 'mission'], videoId: '7XzhtWcepos', title: 'Artemis II: Mission Overview' },
];

function findCuratedVideo(query: string): { videoId: string; title: string } | null {
  const lower = query.toLowerCase();
  const match = CURATED_VIDEOS.find((v) => v.keywords.some((k) => lower.includes(k)));
  return match ? { videoId: match.videoId, title: match.title } : null;
}

// --- System Prompt ---

const MISSION_FACTS = `You are ARTEMIS AI, an expert assistant for the Artemis II mission tracker.

MISSION FACTS:
- Launch: April 1, 2026, 6:35 PM EDT (22:35 UTC) from LC-39B, Kennedy Space Center, Florida
- Duration: Approximately 10 days (return around April 10-11, 2026)
- Crew: Reid Wiseman (Commander, NASA), Victor Glover (Pilot, NASA), Christina Koch (Mission Specialist, NASA), Jeremy Hansen (Mission Specialist, CSA - Canadian Space Agency)
- Vehicle: Orion spacecraft atop Space Launch System (SLS) Block 1 rocket
- Objective: First crewed Artemis mission. Test Orion's life support, navigation, and heat shield systems with humans aboard. Lunar flyby without landing.
- Trajectory: Launch -> Earth orbit -> Translunar Injection (TLI) -> Outbound coast (~4 days) -> Lunar flyby approximately 8,900 km (5,500 miles) above the far side of the Moon -> Free return trajectory -> Earth re-entry -> Pacific Ocean splashdown
- Record: Expected to surpass Apollo 13's record of 400,171 km (248,655 miles) for farthest humans from Earth
- Orion: Built by Lockheed Martin. Crew module can support 4 astronauts for up to 21 days. Features the largest heat shield ever built (5 meters diameter).
- European Service Module (ESM): Built by ESA (European Space Agency) and Airbus. Provides propulsion, power (4 solar arrays), thermal control, water, and air.
- SLS: Most powerful rocket ever flown. 98 meters (322 feet) tall. Produces 39.1 meganewtons (8.8 million pounds) of thrust at liftoff.
- Deep Space Network (DSN): Three ground stations (Goldstone CA, Canberra Australia, Madrid Spain) maintain communication with Orion throughout the mission.
- Previous mission: Artemis I was an uncrewed test flight in November 2022 that successfully orbited the Moon over 25.5 days.
- Future missions: Artemis III (planned ~2027-2028) will land astronauts on the lunar south pole, the first Moon landing since Apollo 17 in 1972.

RULES:
- Answer ONLY from the facts above, the current date/time context below, and general publicly known space knowledge
- If you don't know something, say "I don't have that specific information about the Artemis II mission"
- Keep answers concise (2-4 sentences for simple questions, more for complex ones)
- Be enthusiastic about space exploration
- Never speculate about mission anomalies, safety incidents, or crew health
- If asked about real-time telemetry data, direct users to the tracker dashboard
- ALWAYS use the current date/time context below to determine mission status — the mission HAS launched`;

function buildSystemPrompt(userTimezone?: string): string {
  const now = new Date();
  const utcStr = now.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  const metMs = now.getTime() - LAUNCH_EPOCH_MS;
  const metDays = Math.floor(metMs / 86400000);
  const metHours = Math.floor((metMs % 86400000) / 3600000);
  const metMinutes = Math.floor((metMs % 3600000) / 60000);
  const metStr = `M+ ${String(metDays).padStart(2, '0')}:${String(metHours).padStart(2, '0')}:${String(metMinutes).padStart(2, '0')}`;

  let phase = 'Pre-launch';
  const metHoursTotal = metMs / 3600000;
  if (metHoursTotal < 0) phase = 'Pre-launch';
  else if (metHoursTotal < 5) phase = 'Earth Orbit / TLI';
  else if (metHoursTotal < 96) phase = 'Outbound Coast (heading toward the Moon)';
  else if (metHoursTotal < 130) phase = 'Lunar Flyby';
  else if (metHoursTotal < 220) phase = 'Return Coast (heading back to Earth)';
  else if (metHoursTotal < 240) phase = 'Entry / Splashdown';
  else phase = 'Mission Complete';

  let tzLine = '';
  if (userTimezone) {
    try {
      const localStr = now.toLocaleString('en-US', { timeZone: userTimezone, dateStyle: 'full', timeStyle: 'long' });
      tzLine = `\n- User's local time (${userTimezone}): ${localStr}`;
    } catch {
      // Invalid timezone, skip
    }
  }

  return `${MISSION_FACTS}

CURRENT DATE/TIME CONTEXT (use this to answer time-sensitive questions):
- Current UTC: ${utcStr}
- Mission Elapsed Time: ${metStr}
- Current mission phase: ${phase}${tzLine}
- The mission launched successfully on April 1, 2026. The crew is currently in space.`;
}

// --- Content Source Helpers ---

type ChatPart =
  | { type: 'text'; content: string }
  | { type: 'image'; data: string; mimeType: string; alt?: string }
  | { type: 'nasa-image'; url: string; title: string; credit: string }
  | { type: 'chart'; chartType: 'altitude' | 'velocity' | 'earth-distance'; title: string }
  | { type: 'video'; videoId: string; title: string };

const VALID_ROLES = new Set(['user', 'model']);

const GEMINI_TEXT_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
const GEMINI_IMAGE_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-image-generation:generateContent';

async function generateTextResponse(messages: Array<{ role: string; text: string }>, systemPrompt: string, apiKey: string): Promise<ChatPart[]> {
  const geminiBody = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.text }],
    })),
    generationConfig: { temperature: 0.7, maxOutputTokens: 1024, topP: 0.9 },
  };
  const response = await fetch(GEMINI_TEXT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(geminiBody),
  });
  if (!response.ok) throw new Error(`Gemini text API ${response.status}`);
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? 'I could not generate a response.';
  return [{ type: 'text', content: text }];
}

async function generateImage(prompt: string, apiKey: string): Promise<ChatPart[]> {
  const body = {
    contents: [{ role: 'user', parts: [{ text: `Create a space-themed illustration: ${prompt}` }] }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      temperature: 0.7,
      maxOutputTokens: 1000,
    },
  };
  const res = await fetch(GEMINI_IMAGE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    // Fall back to NASA Image search if Gemini generation fails
    return searchNasaImages(prompt);
  }
  const data = await res.json();
  const parts: ChatPart[] = (data.candidates?.[0]?.content?.parts ?? []).flatMap((part: { text?: string; inlineData?: { data: string; mimeType: string } }) => {
    const result: ChatPart[] = [];
    if (part.text) result.push({ type: 'text', content: part.text });
    if (part.inlineData) result.push({ type: 'image', data: part.inlineData.data, mimeType: part.inlineData.mimeType });
    return result;
  });
  return parts.length > 0 ? parts : [{ type: 'text', content: 'I could not generate an image for that request.' }];
}

async function searchNasaImages(query: string): Promise<ChatPart[]> {
  // Build NASA Image API search query: strip UI noise, normalize synonyms, ensure mission context
  const cleanQuery = query
    .replace(/\b(show|me|find|get|can you|please|real|actual|official|of|the|a|an|some|any)\b/gi, '')
    .replace(/\b(picture|pictures|image|images)\b/gi, 'photo')
    .replace(/\s+/g, ' ')
    .trim() || 'artemis II';
  const searchQuery = cleanQuery.toLowerCase().includes('artemis') ? cleanQuery : `artemis II ${cleanQuery}`;
  const res = await fetch(`https://images-api.nasa.gov/search?q=${encodeURIComponent(searchQuery)}&media_type=image&page_size=3`);
  if (!res.ok) return [{ type: 'text', content: 'Could not search NASA images right now. Try again later.' }];
  const data = await res.json();
  const items = data.collection?.items ?? [];
  if (items.length === 0) return [{ type: 'text', content: `No NASA images found for "${searchQuery}". Try a different search term.` }];
  const parts: ChatPart[] = [{ type: 'text', content: `Here are NASA images related to "${searchQuery}":` }];
  for (const item of items.slice(0, 3)) {
    const meta = item.data?.[0];
    const thumb = item.links?.[0]?.href;
    if (thumb && meta) {
      parts.push({ type: 'nasa-image', url: thumb, title: meta.title || 'NASA Image', credit: meta.center || 'NASA' });
    }
  }
  return parts;
}

function buildChartParts(text: string): ChatPart[] {
  const lower = text.toLowerCase();
  const { chartType, title } = /altitude|height/.test(lower)
    ? { chartType: 'earth-distance' as const, title: 'Altitude (Distance from Earth) Over Time' }
    : /velocity|speed/.test(lower)
      ? { chartType: 'velocity' as const, title: 'Spacecraft Velocity Over Time' }
      : { chartType: 'earth-distance' as const, title: 'Distance from Earth Over Time' };
  return [
    { type: 'text', content: `Here's the ${title.toLowerCase()} chart based on live NASA trajectory data:` },
    { type: 'chart', chartType, title },
  ];
}

function buildVideoParts(text: string): ChatPart[] {
  const video = findCuratedVideo(text);
  if (video) {
    return [
      { type: 'text', content: `Here's the video: **${video.title}**` },
      { type: 'video', videoId: video.videoId, title: video.title },
    ];
  }
  return [{ type: 'text', content: 'I don\'t have a specific video for that topic. Try asking for "launch video", "crew video", or "mission overview video".' }];
}

// --- Main Handler ---

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

  const { messages, userTimezone } = req.body as {
    messages: Array<{ role: string; text: string }>;
    userTimezone?: string;
  };
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  const sanitizedMessages = messages
    .slice(-20)
    .filter((m) => typeof m.text === 'string' && typeof m.role === 'string' && VALID_ROLES.has(m.role))
    .map((m) => ({ role: m.role, text: m.text.slice(0, 2000) }));

  if (sanitizedMessages.length === 0) {
    return res.status(400).json({ error: 'No valid messages provided' });
  }

  const lastUserMessage = sanitizedMessages[sanitizedMessages.length - 1]?.text ?? '';
  const intent = detectIntent(lastUserMessage);

  try {
    let parts: ChatPart[];

    switch (intent) {
      case 'image':
        parts = await generateImage(lastUserMessage, apiKey);
        break;
      case 'nasa-image':
        parts = await searchNasaImages(lastUserMessage);
        break;
      case 'chart':
        parts = buildChartParts(lastUserMessage);
        break;
      case 'video':
        parts = buildVideoParts(lastUserMessage);
        break;
      case 'text':
      default:
        parts = await generateTextResponse(sanitizedMessages, buildSystemPrompt(userTimezone), apiKey);
        break;
    }

    res.status(200).json({ parts });
  } catch (err) {
    console.error('Chat failed:', err);
    res.status(500).json({ parts: [{ type: 'text', content: 'Sorry, I encountered an error. Please try again.' }] });
  }
}
