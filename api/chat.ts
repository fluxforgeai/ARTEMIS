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

const CURATED_VIDEOS = [
  { keywords: ['launch', 'liftoff', 'takeoff', 'sls'], videoId: '_eeZQw9PBc0', title: 'Artemis II Launches Astronauts to the Moon (Official NASA Recap)' },
  { keywords: ['tli', 'translunar', 'injection', 'burn'], videoId: 'Ke6XX8FHOHM', title: 'Artemis II to the Moon: Launch to Splashdown (Mission Animation)' },
  { keywords: ['crew', 'astronaut', 'wiseman', 'glover', 'koch', 'hansen'], videoId: 'lPyl6d2FJGw', title: 'Meet the Astronauts Who will Fly Around the Moon' },
  { keywords: ['moon', 'lunar', 'flyby'], videoId: '6RwfNBtepa4', title: "NASA's Artemis II Live Views from Orion" },
  { keywords: ['orion', 'spacecraft'], videoId: '0uWzj4AiiZ8', title: "Artemis II Astronauts' First Look at Their Lunar Spacecraft" },
  { keywords: ['splashdown', 'return', 'reentry'], videoId: 'Vg-EQ7MOu6I', title: 'Around the Moon for All Humanity: Artemis II (Official Launch Trailer)' },
  { keywords: ['artemis', 'program', 'overview', 'mission'], videoId: '7XzhtWcepos', title: 'Artemis II: Mission Overview' },
] as const;

function findCuratedVideo(query: string): { videoId: string; title: string } | null {
  const lower = query.toLowerCase();
  const match = CURATED_VIDEOS.find((v) => v.keywords.some((k) => lower.includes(k)));
  return match ? { videoId: match.videoId, title: match.title } : null;
}

// --- System Prompt ---

const MISSION_FACTS = `You are ARTEMIS AI, an expert assistant for the Artemis II mission tracker.

MISSION FACTS:
- Launch: April 1, 2026, 6:35 PM EDT (22:35 UTC) from LC-39B, Kennedy Space Center, Florida
- Duration: About 9 days (217.53 hours / 9.064 days). Splashdown: April 10, 2026, ~8:07 PM EDT (00:07 UTC April 11)
- Crew: Reid Wiseman (Commander, NASA), Victor Glover (Pilot, NASA), Christina Koch (Mission Specialist, NASA), Jeremy Hansen (Mission Specialist, CSA - Canadian Space Agency)
- Vehicle: Orion spacecraft atop Space Launch System (SLS) Block 1 rocket
- Objective: First crewed Artemis mission. Test Orion's life support, navigation, and heat shield systems with humans aboard. Lunar flyby without landing. No EVA — this is a test flight to verify spacecraft systems with crew aboard.
- Trajectory: Launch -> Earth orbit -> Perigee raise (T+49m) -> ICPS separation (T+3h24m) -> Phasing orbit (2 revolutions, ~22 hours) -> TLI burn at T+25h13m (Orion ESM engine, 5m50s burn) -> Outbound coast (~3.2 days) -> Lunar flyby at 6,543 km (4,066 mi) above the lunar far side (T+120h27m) -> Free return trajectory -> Earth re-entry -> Pacific Ocean splashdown (T+217h32m)
- Key milestones: SRB sep T+2m08s | Core stage sep T+8m17s | Perigee raise T+49m | ICPS sep T+3h24m | TLI burn T+25h13m | MCC-1 T+48h | Lunar approach T+102h | Closest approach T+120h27m (6,543 km above far side) | Return burn T+139h | MCC-3 T+200h | CM/SM sep T+217h | Entry T+217h18m | Splashdown T+217h32m
- Record: Expected to surpass Apollo 13's record of 400,171 km (248,655 miles) for farthest humans from Earth
- Orion: Built by Lockheed Martin. Crew module can support 4 astronauts for up to 21 days. Features the largest heat shield ever built (5 meters diameter).
- European Service Module (ESM): Built by ESA (European Space Agency) and Airbus. Provides propulsion, power (4 solar arrays), thermal control, water, and air.
- SLS: Most powerful rocket ever flown. 98 meters (322 feet) tall. Produces 39.1 meganewtons (8.8 million pounds) of thrust at liftoff.
- Deep Space Network (DSN): Three ground stations (Goldstone CA, Canberra Australia, Madrid Spain) maintain communication with Orion throughout the mission.
- Previous mission: Artemis I was an uncrewed test flight in November 2022 that successfully orbited the Moon over 25.5 days.
- Future missions: Artemis III (planned ~2027-2028) will land astronauts on the lunar south pole, the first Moon landing since Apollo 17 in 1972.

RULES:
- Use the mission facts above as your primary source for core mission parameters (crew, trajectory, timeline, vehicle specs).
- For current events, news, mission status updates, or anything not covered by the facts above, use Google Search to find the latest information.
- When your response includes information from web search, briefly note that it comes from web sources.
- Provide thorough, informative answers. Use short answers for simple factual lookups; give detailed explanations for complex or multi-part questions.
- Be enthusiastic about space exploration while maintaining accuracy.
- If uncertain about mission-specific details, say "I don't have confirmed information about that specific detail."
- Never speculate about mission anomalies, safety incidents, or crew health.
- If asked about real-time telemetry data, direct users to the tracker dashboard.
- ALWAYS use the current date/time context below to determine mission status — the mission HAS launched.`;

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
  else if (metHoursTotal < 3.40) phase = 'Launch & Earth Orbit';
  else if (metHoursTotal < 25.23) phase = 'Phasing Orbit';
  else if (metHoursTotal < 25.33) phase = 'Translunar Injection Burn';
  else if (metHoursTotal < 102) phase = 'Outbound Coast (heading toward the Moon)';
  else if (metHoursTotal < 139) phase = 'Lunar Flyby';
  else if (metHoursTotal < 217.0) phase = 'Return Coast (heading back to Earth)';
  else if (metHoursTotal < 217.53) phase = 'Entry & Splashdown';
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
  | { type: 'video'; videoId: string; title: string }
  | { type: 'sources'; items: Array<{ url: string; title: string }> };

const VALID_ROLES = new Set(['user', 'model']);

const GEMINI_TEXT_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent';
const GEMINI_IMAGE_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent';

// Hoisted regexes for buildChartParts (S4: avoid re-creation per call)
const ALTITUDE_RE = /altitude|height/;
const VELOCITY_RE = /velocity|speed/;

function hostnameFromUri(uri: string): string {
  try { return new URL(uri).hostname; } catch { return 'Source'; }
}

function isTransient(status: number): boolean {
  return status === 429 || status === 500 || status === 503;
}

async function generateTextResponse(messages: Array<{ role: string; text: string }>, systemPrompt: string, apiKey: string): Promise<ChatPart[]> {
  const baseBody = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.text }],
    })),
    generationConfig: { temperature: 0.7, maxOutputTokens: 2048, topP: 0.9 },
  };
  const headers = { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey };

  // Pre-serialize to avoid repeated JSON.stringify on the same object
  const baseBodyJson = JSON.stringify(baseBody);
  const groundedBodyJson = JSON.stringify({ ...baseBody, tools: [{ google_search: {} }] });

  // Shared deadline across all retries — caps total I/O at 15s regardless of retry path
  const deadline = AbortSignal.timeout(15_000);

  // Try with search grounding first, fall back without it if the API rejects the tool
  let response = await fetch(GEMINI_TEXT_URL, {
    method: 'POST',
    headers,
    body: groundedBodyJson,
    signal: deadline,
  });
  if (!response.ok) {
    // Release the unconsumed response body to free the socket
    await response.body?.cancel();
    // Search grounding may not be available — retry without tools
    response = await fetch(GEMINI_TEXT_URL, {
      method: 'POST',
      headers,
      body: baseBodyJson,
      signal: deadline,
    });
    if (!response.ok) {
      // Retry once on transient server errors (500/503/429)
      if (isTransient(response.status)) {
        // Respect Retry-After header for 429; use 1s default for 500/503
        const retryAfter = response.status === 429
          ? Math.min(3_000, Math.max(1_000, Number(response.headers.get('retry-after') || '1') * 1_000))
          : 1_000;
        await response.body?.cancel();
        // Skip retry if deadline leaves insufficient time for a meaningful fetch
        if (deadline.aborted) throw new Error(`Gemini text API ${response.status}`);
        await new Promise((r) => setTimeout(r, retryAfter));
        response = await fetch(GEMINI_TEXT_URL, {
          method: 'POST',
          headers,
          body: baseBodyJson,
          signal: deadline,
        });
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error(`Gemini text API ${response.status}`);
      }
    }
  }
  const data = await response.json();

  const candidate = data.candidates?.[0];
  if (!candidate) {
    return [{ type: 'text', content: 'I could not generate a response.' }];
  }

  // Concatenate ALL text parts (not just parts[0]) — search grounding may return multiple
  const textParts = candidate.content?.parts ?? [];
  const fullText = textParts
    .filter((p: { text?: string }) => p.text)
    .map((p: { text: string }) => p.text)
    .join('\n') || 'I could not generate a response.';

  const result: ChatPart[] = [{ type: 'text', content: fullText }];

  // Extract grounding sources if present
  const chunks = candidate.groundingMetadata?.groundingChunks;
  if (Array.isArray(chunks) && chunks.length > 0) {
    const items = chunks
      .filter((c: { web?: { uri?: string; title?: string } }) => c.web?.uri)
      .map((c: { web: { uri: string; title?: string } }) => ({
        url: c.web.uri,
        title: c.web.title || hostnameFromUri(c.web.uri),
      }));
    if (items.length > 0) {
      result.push({ type: 'sources', items });
    }
  }

  return result;
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
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    await res.body?.cancel();
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
  const res = await fetch(`https://images-api.nasa.gov/search?q=${encodeURIComponent(searchQuery)}&media_type=image&page_size=3`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    await res.body?.cancel();
    return [{ type: 'text', content: 'Could not search NASA images right now. Try again later.' }];
  }
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
  const { chartType, title } = ALTITUDE_RE.test(lower)
    ? { chartType: 'earth-distance' as const, title: 'Altitude (Distance from Earth) Over Time' }
    : VELOCITY_RE.test(lower)
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
