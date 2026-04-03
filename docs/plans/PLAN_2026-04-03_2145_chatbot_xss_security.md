# Plan: Multimodal AI Chatbot (Multimodal F1)

## Context

The ARTEMIS chatbot is text-only. Users asking for images, diagrams, charts, or videos get text descriptions. Adding 4 content sources: Gemini 2.5 Flash Image (AI diagrams), NASA Image API (real photos), Recharts (interactive charts), and curated YouTube embeds. Keyword-based intent detection routes requests to the right source.

**Blueprint**: `docs/blueprints/2026-04-03_2125_multimodal_chatbot.md`

## Step 1: Install recharts

```bash
npm install recharts --legacy-peer-deps
```

## Step 2: Define ChatPart types in `src/hooks/useChat.ts`

Add part type definitions. Change `ChatMessage` from `{ text: string }` to support both legacy `text` and new `parts[]`:

```typescript
export type ChatPart =
  | { type: 'text'; content: string }
  | { type: 'image'; data: string; mimeType: string; alt?: string }
  | { type: 'nasa-image'; url: string; title: string; credit: string }
  | { type: 'chart'; chartType: 'altitude' | 'velocity' | 'earth-distance'; title: string }
  | { type: 'video'; videoId: string; title: string };

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;        // Keep for backward compat + user messages
  parts?: ChatPart[];  // Multimodal parts for assistant messages
}
```

Update `sendMessage` to parse the API response:
- If response has `parts` array: store as `{ role: 'assistant', text: parts.filter(p => p.type === 'text').map(p => p.content).join(''), parts }`
- If response has `text` string (legacy): store as `{ role: 'assistant', text }`

When building the API request body, send only `{ role, text }` for the message history (strip parts — Gemini needs text-only history).

## Step 3: Add intent detection + routing in `api/chat.ts`

Add before the handler:

```typescript
type Intent = 'text' | 'image' | 'nasa-image' | 'chart' | 'video';

function detectIntent(text: string): Intent {
  const lower = text.toLowerCase();
  if (/video|watch|footage|clip|stream|launch video/.test(lower)) return 'video';
  if (/chart|graph|plot|altitude over|velocity over|speed over|distance over/.test(lower)) return 'chart';
  if (/real photo|actual photo|nasa photo|crew photo|launch photo|official photo/.test(lower)) return 'nasa-image';
  if (/show|picture|image|draw|diagram|illustrat|visual|what does.*look/.test(lower)) return 'image';
  return 'text';
}
```

In the handler, detect intent from the last user message. Route:
- `'text'` -> existing Gemini text flow, wrap response as `{ parts: [{ type: 'text', content }] }`
- `'image'` -> forward to internal image generation logic (call Gemini Flash Image inline)
- `'nasa-image'` -> fetch from NASA Images API inline
- `'chart'` -> return chart config part (no external API)
- `'video'` -> return curated video part (no external API)

For image/nasa-image, make the fetch calls inline in `api/chat.ts` rather than separate endpoints (simpler, avoids extra serverless functions). Use helper functions at the bottom of the file.

## Step 4: Add Gemini Image generation helper in `api/chat.ts`

```typescript
const GEMINI_IMAGE_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-image-generation:generateContent';

async function generateImage(prompt: string, apiKey: string): Promise<ChatPart[]> {
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      temperature: 0.7,
      maxOutputTokens: 1000,
    },
  };
  const res = await fetch(`${GEMINI_IMAGE_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Image API ${res.status}`);
  const data = await res.json();
  const parts: ChatPart[] = [];
  for (const part of data.candidates?.[0]?.content?.parts ?? []) {
    if (part.text) parts.push({ type: 'text', content: part.text });
    if (part.inlineData) parts.push({ type: 'image', data: part.inlineData.data, mimeType: part.inlineData.mimeType });
  }
  return parts.length > 0 ? parts : [{ type: 'text', content: 'I could not generate an image for that request.' }];
}
```

## Step 5: Add NASA Image search helper in `api/chat.ts`

```typescript
async function searchNasaImages(query: string): Promise<ChatPart[]> {
  const res = await fetch(`https://images-api.nasa.gov/search?q=${encodeURIComponent(query)}&media_type=image&page_size=3`);
  if (!res.ok) return [{ type: 'text', content: 'Could not search NASA images right now.' }];
  const data = await res.json();
  const items = data.collection?.items ?? [];
  if (items.length === 0) return [{ type: 'text', content: `No NASA images found for "${query}".` }];
  const parts: ChatPart[] = [{ type: 'text', content: `Here are NASA images for "${query}":` }];
  for (const item of items.slice(0, 3)) {
    const meta = item.data?.[0];
    const thumb = item.links?.[0]?.href;
    if (thumb && meta) {
      parts.push({ type: 'nasa-image', url: thumb, title: meta.title, credit: meta.center || 'NASA' });
    }
  }
  return parts;
}
```

## Step 6: Add curated video lookup in `src/data/artemis-videos.ts`

```typescript
export const ARTEMIS_VIDEOS: Array<{ keywords: string[]; videoId: string; title: string }> = [
  { keywords: ['launch', 'liftoff', 'takeoff'], videoId: 'VIDEO_ID_1', title: 'Artemis II Launch' },
  { keywords: ['tli', 'translunar', 'burn'], videoId: 'VIDEO_ID_2', title: 'Translunar Injection Burn' },
  { keywords: ['crew', 'astronaut'], videoId: 'VIDEO_ID_3', title: 'Meet the Artemis II Crew' },
  // ... ~10-15 entries
];

export function findVideo(query: string): { videoId: string; title: string } | null {
  const lower = query.toLowerCase();
  for (const v of ARTEMIS_VIDEOS) {
    if (v.keywords.some(k => lower.includes(k))) return { videoId: v.videoId, title: v.title };
  }
  return null;
}
```

Note: actual YouTube video IDs need to be looked up during implementation by searching for real Artemis II NASA videos.

## Step 7: Add chart config helper in `api/chat.ts`

For chart intent, detect the chart type from keywords and return a config part:

```typescript
function buildChartPart(text: string): ChatPart[] {
  const lower = text.toLowerCase();
  let chartType: 'altitude' | 'velocity' | 'earth-distance' = 'earth-distance';
  let title = 'Distance from Earth Over Time';
  if (/velocity|speed/.test(lower)) { chartType = 'velocity'; title = 'Spacecraft Velocity Over Time'; }
  if (/altitude|height/.test(lower)) { chartType = 'altitude'; title = 'Altitude Over Time'; }
  return [
    { type: 'text', content: `Here's the ${title.toLowerCase()} chart based on NASA trajectory data:` },
    { type: 'chart', chartType, title },
  ];
}
```

## Step 8: Create `src/chat/ChatImage.tsx`

Renders both AI-generated (base64) and NASA (URL) images:

```tsx
// For type 'image': <img src={`data:${mimeType};base64,${data}`} />
// For type 'nasa-image': <img src={url} /> + <span>{credit}</span>
// Both: rounded corners, max-width 100%, loading="lazy"
```

## Step 9: Create `src/chat/ChatChart.tsx`

Renders Recharts LineChart using OEM data from Zustand store:

```tsx
// Read oemData from useMissionStore
// Sample every Nth point (e.g., every 20th) to keep chart performant
// For 'velocity': compute sqrt(vx²+vy²+vz²)*3600 for each point
// For 'earth-distance': compute sqrt(x²+y²+z²) for each point
// Render <ResponsiveContainer width="100%" height={200}>
//   <LineChart data={sampled}>
//     <XAxis dataKey="met" /> <YAxis /> <Tooltip /> <Line />
//   </LineChart>
// </ResponsiveContainer>
```

## Step 10: Create `src/chat/ChatVideo.tsx`

Renders YouTube embed:

```tsx
// <iframe src={`https://www.youtube.com/embed/${videoId}`}
//   width="100%" style={{ aspectRatio: '16/9' }}
//   allowFullScreen loading="lazy" />
```

## Step 11: Update `src/chat/ChatMessage.tsx`

For assistant messages with `parts`, iterate and render each:

```tsx
{message.parts ? (
  message.parts.map((part, i) => {
    switch (part.type) {
      case 'text': return <span key={i} dangerouslySetInnerHTML={{ __html: renderMarkdown(part.content) }} />;
      case 'image': return <ChatImage key={i} part={part} />;
      case 'nasa-image': return <ChatImage key={i} part={part} />;
      case 'chart': return <ChatChart key={i} part={part} />;
      case 'video': return <ChatVideo key={i} part={part} />;
    }
  })
) : (
  // Legacy text-only rendering (backward compat)
  isUser ? message.text : <span dangerouslySetInnerHTML={{ __html: renderMarkdown(message.text) }} />
)}
```

## Verification

```bash
# 1. Install deps
npm install recharts --legacy-peer-deps

# 2. Build + test
npm run build && npx vitest run

# 3. Visual verification on deployment:
#    - "Show me a diagram of the trajectory" -> AI image
#    - "Show me real photos of the crew" -> NASA images
#    - "Show me velocity chart" -> Recharts interactive chart
#    - "Show me the launch video" -> YouTube embed
#    - "Who are the crew?" -> text-only (unchanged)
```
