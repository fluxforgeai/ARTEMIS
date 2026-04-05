# ARTEMIS -- Implementation Plan

## Overview

ARTEMIS is an interactive 3D web visualization of the Artemis II lunar flyby mission. It consumes live NASA data sources (OEM ephemeris files, DSN Now XML, JPL Horizons API) to render a real-time Earth-Moon-Orion scene with telemetry HUD overlays and an AI-powered mission chatbot. The tech stack is Vite + React 19 + TypeScript + React Three Fiber + Zustand + Framer Motion + Tailwind CSS 4, deployed as a Vercel SPA with serverless API proxy functions. The chatbot uses Google Gemini 2.5 Flash (free tier) with a system-prompt-stuffed approach -- no RAG, no vector database.

---

## Prerequisites

| Requirement | Details |
|-------------|---------|
| Node.js | v20+ (LTS recommended) |
| npm | v10+ (ships with Node 20) |
| Vercel CLI | `npm i -g vercel` for local dev and deployment |
| Gemini API key | Free tier from Google AI Studio (1,000 requests/day, no credit card required) |
| NASA API key | `DEMO_KEY` works for development; get a free key at api.nasa.gov for higher rate limits |
| Browser | Chrome, Firefox, Safari, or Edge with WebGL2 support |
| Textures | NASA Blue Marble 2K (earth-day.jpg) and CGI Moon Kit (moon.jpg) -- public domain |

Create a `.env` file at the project root (never committed):

```
GEMINI_API_KEY=your_gemini_api_key_here
NASA_API_KEY=DEMO_KEY
```

---

## Phase 1: Project Scaffold

### 1.1 Create the project

```bash
npm create vite@latest artemis-tracker -- --template react-ts
cd artemis-tracker
```

### 1.2 Install dependencies

```bash
# Core 3D and state
npm install three @react-three/fiber @react-three/drei zustand

# UI and animation
npm install framer-motion

# Dev dependencies
npm install -D @types/three @tailwindcss/vite vitest @vercel/node
```

### 1.3 Configure Vite

Create `vite.config.ts`:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          three: ["three"],
          r3f: ["@react-three/fiber", "@react-three/drei"],
        },
      },
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
```

### 1.4 Configure Tailwind CSS 4

Tailwind v4 uses CSS-only configuration. There is NO `tailwind.config.ts` file. All theme customization goes in `src/index.css`:

```css
@import "tailwindcss";

@theme {
  --color-space-dark: #0a0a1a;
  --color-space-blue: #1a1a3e;
  --color-hud-orange: #ff8c00;
  --color-hud-cyan: #00e5ff;
  --color-hud-green: #00ff88;
  --font-family-mono: "JetBrains Mono", "Fira Code", monospace;
}
```

### 1.5 Create root files

- `index.html` -- Vite entry point, mounts `#root`
- `src/main.tsx` -- `createRoot(document.getElementById("root")!).render(<App />)`
- `src/App.tsx` -- Shell layout (Canvas placeholder + HUD placeholder)
- `.env.example` -- `GEMINI_API_KEY=` and `NASA_API_KEY=DEMO_KEY`
- `.gitignore` -- Node, Vite, `.env`, `dist/`

### 1.6 Create mission config

File: `src/data/mission-config.ts`

Hardcoded constants:
- Launch epoch: `2026-04-01T22:35:00Z`
- Crew: Reid Wiseman (Commander), Victor Glover (Pilot), Christina Koch (Mission Specialist), Jeremy Hansen (CSA, Mission Specialist)
- Mission duration: ~10 days
- Milestones: Launch, TLI, Lunar Flyby, Free Return, Splashdown (with approximate epochs)
- Coordinate scale factor: 10,000 (1 Three.js unit = 10,000 km)

### 1.7 Create Zustand store skeleton

File: `src/store/mission-store.ts`

Store shape:

```ts
interface MissionStore {
  // OEM data
  oemVectors: StateVector[];
  oemLoaded: boolean;

  // Spacecraft state (derived from interpolation)
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  speed: number;          // km/h
  earthDist: number;      // km
  moonDist: number;       // km

  // Moon position (from Horizons)
  moonPosition: { x: number; y: number; z: number };

  // DSN data
  dsnStations: DsnStation[];

  // Mission timing
  met: string;            // M+ DD:HH:MM:SS
  progress: number;       // 0-100
  currentPhase: string;

  // Camera
  cameraMode: "free" | "follow" | "earth" | "moon";

  // Chat
  chatOpen: boolean;
  chatMessages: ChatMessage[];

  // Loading
  isLoading: boolean;

  // Actions
  setOemVectors: (v: StateVector[]) => void;
  setSpacecraftState: (s: Partial<SpacecraftState>) => void;
  setMoonPosition: (p: Position) => void;
  setDsnStations: (d: DsnStation[]) => void;
  setCameraMode: (m: CameraMode) => void;
  toggleChat: () => void;
  addChatMessage: (msg: ChatMessage) => void;
  setLoading: (loading: boolean) => void;
}
```

---

## Phase 2: Data Pipeline

### 2.1 OEM Parser

File: `src/data/oem-parser.ts`

**OEM file format (CCSDS Orbit Ephemeris Message, KVN text format):**

```
CCSDS_OEM_VERS = 2.0
CREATION_DATE = 2026-04-02T12:00:00.000
ORIGINATOR = JSC

META_START
OBJECT_NAME          = ORION
OBJECT_ID            = 2026-001A
CENTER_NAME          = EARTH
REF_FRAME            = EME2000
TIME_SYSTEM          = UTC
START_TIME           = 2026-04-01T22:35:00.000
STOP_TIME            = 2026-04-11T18:00:00.000
INTERPOLATION        = LAGRANGE
INTERPOLATION_DEGREE = 8
META_STOP

2026-04-01T22:35:00.000   6578.137   0.000   0.000   0.000   7.784   0.000
2026-04-01T22:39:00.000   6571.234   28.912  -0.531  -0.342   7.782   0.012
... (one line every ~4 minutes)
```

Each data line contains: ISO 8601 timestamp followed by 6 space-separated floats representing X, Y, Z (km) and VX, VY, VZ (km/s) in the J2000/EME2000 Earth-centered reference frame.

Implementation details:
- Must handle multiple META_START/META_STOP segments (some OEM files contain more than one)
- Skip comment lines (starting with `COMMENT`)
- Parse header key-value pairs (split on `=`)
- Parse data lines: split on whitespace, first token is epoch, remaining 6 are floats
- Return typed `StateVector[]` array

```ts
interface StateVector {
  epoch: Date;       // Parsed from ISO string
  epochMs: number;   // epoch.getTime() for fast comparison
  x: number;         // km
  y: number;         // km
  z: number;         // km
  vx: number;        // km/s
  vy: number;        // km/s
  vz: number;        // km/s
}
```

### 2.2 Lagrange Interpolator

File: `src/data/interpolator.ts`

**Lagrange polynomial interpolation, degree 8** (matching the OEM file's `INTERPOLATION_DEGREE = 8`).

For a target epoch `t`, find the nearest 9 data points (degree + 1). For each of the 6 components (x, y, z, vx, vy, vz), compute:

```
L(t) = SUM(i=0..n) [ y_i * PRODUCT(j=0..n, j!=i) [ (t - t_j) / (t_i - t_j) ] ]
```

Where:
- `n = 8` (degree)
- `t_j` are the epochs of the 9 selected data points (converted to seconds or milliseconds for numeric stability)
- `y_i` are the component values at each data point

Implementation details:
- Sort state vectors by epoch
- For a given target epoch, find the closest data point index, then select 4 points before and 4 points after (centering the window)
- Clamp the window at boundaries (start/end of data)
- Convert epochs to relative seconds from the first point in the window (avoids floating-point precision loss with large millisecond timestamps)
- Return interpolated `{ x, y, z, vx, vy, vz }`

### 2.3 DSN Parser

File: `src/data/dsn-parser.ts`

Parse DSN Now XML using `DOMParser` (browser-native, no dependencies).

**DSN XML structure:**

```xml
<dsn>
  <station name="gdscc" friendly="Goldstone">
    <dish name="DSS-14" azimuth="123.4" elevation="45.6">
      <target name="ORION" id="..."
              uplegRange="400000.0" downlegRange="400000.0" rtlt="2.67"/>
    </dish>
  </station>
  <station name="cdscc" friendly="Canberra">...</station>
  <station name="mdscc" friendly="Madrid">...</station>
</dsn>
```

Extract:
- Station name, friendly name, active status
- Dish identifiers, azimuth/elevation
- Target name (filter for "ORION"), downleg range (km), round-trip light time (seconds)

### 2.4 Unit Test Strategy

File: `tests/oem-parser.test.ts`
- Embed a sample OEM text block (10-15 data lines) as a string constant
- Test that parser returns correct number of StateVector entries
- Test that parsed epochs match expected dates
- Test that parsed position/velocity values match expected floats
- Test handling of comment lines and multiple meta segments

File: `tests/interpolator.test.ts`
- Use the same sample data
- Test interpolation AT a known data point epoch: result must match to < 0.001 km
- Test interpolation BETWEEN two data points: result must be plausible (bounded by neighbors)
- Test boundary clamping: interpolation at first and last epochs must not throw

Run with: `npx vitest run`

---

## Phase 3: Store and Hooks

### 3.1 Zustand Store

File: `src/store/mission-store.ts`

See store shape in Phase 1.7 above. Use `create` from `zustand`. The store is accessible both inside and outside React components (Zustand stores are plain JavaScript -- critical for accessing state inside the R3F render loop via `useStore.getState()`).

### 3.2 useOEM Hook

File: `src/hooks/useOEM.ts`

Responsibilities:
- On mount: fetch `/api/oem`, parse response text with `parseOEM()`, store result in Zustand
- Also fetch Moon position from `/api/horizons` and store in Zustand
- Set up polling: re-fetch every **5 minutes** via `setInterval`
- Set `isLoading = false` once initial fetch completes
- Clean up interval on unmount

### 3.3 useDSN Hook

File: `src/hooks/useDSN.ts`

Responsibilities:
- On mount: fetch `/api/dsn`, parse XML with `parseDSN()`, store in Zustand
- Set up polling: re-fetch every **30 seconds** via `setInterval`
- Clean up interval on unmount

### 3.4 useSpacecraft -- IMPORTANT CONSTRAINT

The blueprint lists `src/hooks/useSpacecraft.ts`, but this hook must call `useFrame` from React Three Fiber, which can ONLY run inside a `<Canvas>` child. Therefore, the spacecraft interpolation logic lives in a dedicated component:

File: `src/components/DataDriver.tsx`

This component renders `null` (no visual output). On every animation frame (`useFrame`), it:
1. Gets the current UTC time
2. Calls the Lagrange interpolator with OEM data from the store
3. Computes speed: `sqrt(vx^2 + vy^2 + vz^2) * 3600` (km/s to km/h)
4. Computes Earth distance: `sqrt(x^2 + y^2 + z^2)` (km, Earth is at origin)
5. Computes Moon distance: `sqrt((x-mx)^2 + (y-my)^2 + (z-mz)^2)` (km)
6. Updates the Zustand store with all derived values

This is placed inside `<Canvas>` in Scene.tsx, not outside it.

### 3.5 useMission Hook

File: `src/hooks/useMission.ts`

Responsibilities:
- Compute Mission Elapsed Time (MET) from launch epoch: `M+ DD:HH:MM:SS`
- Determine current mission phase from milestones
- Calculate progress percentage: `(now - launch) / totalDuration * 100`
- Update every **1 second** via `setInterval`
- Store results in Zustand

---

## Phase 4: API Routes

All 5 API routes live in the `api/` directory at the project root (NOT inside `src/`). These are Vercel Serverless Functions.

**Critical constraint**: Files in `api/` CANNOT import from `src/`. The Vercel build compiles API functions separately. Any shared data (like the Artemis knowledge base for the chatbot) must be inlined directly in the API file.

All API functions use types from `@vercel/node` (NOT Next.js types):

```ts
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  // ...
}
```

### 4.1 api/oem.ts -- OEM Ephemeris Proxy

- Fetches the latest Artemis II OEM file from NASA
- Returns raw text with CORS headers
- `Cache-Control: public, s-maxage=300` (5 minutes)

### 4.2 api/dsn.ts -- DSN Now Proxy

- Fetches `https://eyes.nasa.gov/apps/dsn-now/dsn.xml`
- Returns XML text with CORS headers
- `Cache-Control: public, s-maxage=30` (30 seconds)

### 4.3 api/horizons.ts -- JPL Horizons Proxy

- Proxies requests to `https://ssd.jpl.nasa.gov/api/horizons.api`
- Accepts query parameters: `command=301` (Moon), Earth-centered vectors
- Returns JSON with CORS headers
- `Cache-Control: public, s-maxage=1800` (30 minutes)

### 4.4 api/donki.ts -- Space Weather Proxy

- Proxies requests to `https://api.nasa.gov/DONKI/`
- Appends `api_key` from environment
- Returns JSON with CORS headers
- `Cache-Control: public, s-maxage=900` (15 minutes)

### 4.5 api/chat.ts -- Gemini AI Chatbot

- Receives POST body: `{ messages: [{ role: "user"|"model", content: string }] }`
- Prepends Artemis II system prompt via the `system_instruction` top-level field
- Calls Gemini 2.5 Flash (non-streaming for MVP):
  ```
  POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent
  Header: x-goog-api-key: ${process.env.GEMINI_API_KEY}
  ```
- Request body format:
  ```json
  {
    "system_instruction": {
      "parts": [{ "text": "You are ARTEMIS AI..." }]
    },
    "contents": [
      { "role": "user", "parts": [{ "text": "Who are the crew?" }] },
      { "role": "model", "parts": [{ "text": "The Artemis II crew..." }] },
      { "role": "user", "parts": [{ "text": "What is TLI?" }] }
    ]
  }
  ```
- Note the Gemini-specific conventions: the assistant role is `"role": "model"` (not `"assistant"`), and the system prompt uses the `system_instruction` field (not a system message in the contents array)
- Returns the generated text with CORS headers
- Handles 429 (rate limit) gracefully with a user-friendly error message

### 4.6 vercel.json

```json
{
  "rewrites": [
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ]
}
```

This enables SPA routing -- all non-API requests fall through to the Vite-built `index.html`.

---

## Phase 5: 3D Scene

### Build order matters

`Scene.tsx` must be created FIRST because it provides the `<Canvas>` shell. All other 3D components are children of Canvas and cannot be tested or rendered without it.

### 5.1 Scene.tsx (create first)

File: `src/components/Scene.tsx`

- R3F `<Canvas>` with `camera={{ fov: 45, position: [0, 5, 15] }}`
- `<Suspense fallback={null}>` wrapping all children
- Black background (`scene.background = new Color(0x000000)`)
- Composes: `<DataDriver />`, `<Stars />`, `<Earth />`, `<Moon />`, `<Trajectory />`, `<Spacecraft />`, `<CameraController />`
- `<ambientLight intensity={0.1} />` for base illumination
- `<directionalLight position={[100, 0, 0]} intensity={1.5} />` simulating Sun

### 5.2 DataDriver.tsx

File: `src/components/DataDriver.tsx`

- Renders `null`
- `useFrame` callback: interpolate current spacecraft state, update store
- See Phase 3.4 for full logic

### 5.3 Stars.tsx

File: `src/components/Stars.tsx`

- `<Points>` geometry with ~5,000 random positions
- Each star: small white point, scattered in a large sphere (radius ~500 units)
- Alternative: use `<Stars>` from `@react-three/drei`

### 5.4 Earth.tsx

File: `src/components/Earth.tsx`

- `<Sphere args={[0.637, 64, 64]}>`  (Earth radius 6,371 km / 10,000 scale)
- Texture: `useTexture("/textures/earth-day.jpg")` from `@react-three/drei`
- Position: origin `[0, 0, 0]` (Earth-centered coordinate system)
- Slow rotation: `useFrame` incrementing `rotation.y`

### 5.5 Moon.tsx

File: `src/components/Moon.tsx`

- `<Sphere args={[0.174, 32, 32]>` (Moon radius 1,737 km / 10,000 scale)
- Texture: `useTexture("/textures/moon.jpg")`
- Position: read `moonPosition` from Zustand store, divide by 10,000

**Coordinate scaling**: All OEM positions are in km. The 3D scene divides all positions by 10,000 so that 1 Three.js unit = 10,000 km. This keeps the Earth-Moon system (384,400 km apart) at ~38.4 units -- a comfortable camera range.

### 5.6 Trajectory.tsx

File: `src/components/Trajectory.tsx`

- Reads OEM state vectors from the store
- Converts to scaled 3D positions (divide by 10,000)
- Splits the trajectory at the current epoch:
  - Past: solid orange line (`#ff8c00`)
  - Future: dashed cyan line (`#00e5ff`)
- Uses `<Line>` from drei or raw `BufferGeometry` with `LineBasicMaterial`

### 5.7 Spacecraft.tsx

File: `src/components/Spacecraft.tsx`

- Small emissive sphere (`<Sphere args={[0.05, 16, 16]}>`) at interpolated Orion position (scaled)
- Emissive material: `emissive="#00e5ff"`, `emissiveIntensity={2}`
- `<Html>` label from drei: "ORION" text floating above the marker
- Position updates from Zustand store

### 5.8 CameraController.tsx

File: `src/components/CameraController.tsx`

- `<OrbitControls>` from drei for free rotation, zoom, pan
- Camera preset functions:
  - Follow Orion: lerp camera to offset from spacecraft position
  - Earth View: position camera above Earth looking outward
  - Moon View: position camera near Moon looking at Earth
  - Free Orbit: default, user-controlled
- Reads `cameraMode` from Zustand store

### 5.9 Texture Acquisition

Before implementing Phase 5, download textures into `public/textures/`:

```bash
mkdir -p public/textures
# Earth: NASA Blue Marble (2K resolution)
curl -o public/textures/earth-day.jpg "https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73909/world.topo.bathy.200412.3x5400x2700.jpg"
# Moon: use a suitable 2K lunar surface texture from NASA
```

Use 2K resolution (not 8K) to keep initial load under 2MB for textures.

---

## Phase 6: HUD Overlay

All HUD components are positioned as an absolute overlay on top of the Canvas. The root HUD container uses `pointer-events: none` so mouse events pass through to the 3D scene. Individual interactive elements (buttons, inputs) use `pointer-events: auto`.

### 6.1 TelemetryCard.tsx

File: `src/hud/TelemetryCard.tsx`

- Props: `label`, `value` (number), `unit` (string), `precision` (number)
- Framer Motion `motion.span` with `animate={{ opacity: 1 }}` for smooth number transitions
- Use `useSpring` or `animate` from Framer Motion to interpolate between old and new values (prevents jarring jumps when telemetry updates)
- Glass-morphism card style: `backdrop-blur-md bg-white/5 border border-white/10 rounded-lg`

### 6.2 MissionClock.tsx

File: `src/hud/MissionClock.tsx`

- Displays: `M+ DD:HH:MM:SS` (Mission Elapsed Time)
- Updates every second via `setInterval` or `requestAnimationFrame`
- Reads launch epoch from `mission-config.ts`
- Monospace font for stable digit width

### 6.3 ProgressBar.tsx

File: `src/hud/ProgressBar.tsx`

- Horizontal bar showing mission progress percentage
- Animated fill width via Framer Motion `motion.div`
- Percentage label aligned right

### 6.4 DSNStatus.tsx

File: `src/hud/DSNStatus.tsx`

- Three antenna indicators: Goldstone, Canberra, Madrid
- Green dot = active (dish targeting Orion), gray dot = inactive
- Station name labels beneath each indicator
- Reads from Zustand store DSN data

### 6.5 CameraControls.tsx

File: `src/hud/CameraControls.tsx`

- Row of buttons: "Free", "Follow Orion", "Earth", "Moon"
- Each button sets `cameraMode` in Zustand store
- Active button highlighted

### 6.6 HUD.tsx

File: `src/hud/HUD.tsx`

- Overlay container: `position: absolute; inset: 0; pointer-events: none;`
- Layout:
  - Top-left: Mission Clock + Progress Bar
  - Top-right: Telemetry Cards (Speed, Earth Dist, Moon Dist)
  - Bottom-left: DSN Status
  - Bottom-right: Camera Controls
- All interactive children: `pointer-events: auto`

---

## Phase 7: AI Chatbot

### 7.1 Knowledge Base

File: `src/data/artemis-knowledge.ts`

Contains two exports:

1. **System prompt** (~2,000-4,000 tokens of Artemis II mission facts):
   - Crew bios (names, roles, backgrounds)
   - Launch details (date, time, pad, vehicle)
   - Mission timeline and milestones
   - Spacecraft specs (Orion, SLS Block 1)
   - Objectives and records (surpassing Apollo 13 distance record)
   - Trajectory description (Earth orbit, TLI, lunar flyby at ~8,900 km, free return, splashdown)

2. **Quick-answer Q&A pairs** (10-15 pre-written pairs):
   - "Who are the crew?" -> pre-written answer about all 4 crew members
   - "How long is the mission?" -> ~10 days, launch to splashdown
   - "What is Orion?" -> spacecraft description
   - "What's the trajectory?" -> flight path description
   - "When did it launch?" -> April 1, 2026, 6:35 PM EDT
   - "What records will it break?" -> farthest humans from Earth
   - "What is SLS?" -> Space Launch System description
   - "What is the Artemis program?" -> program overview
   - "How far from Earth?" -> dynamic answer mentioning current distance
   - "What is TLI?" -> Trans-Lunar Injection explanation
   - "When does it return?" -> ~April 10-11, Pacific splashdown
   - "Who built the spacecraft?" -> Lockheed Martin (Orion), Boeing/Northrop/Aerojet (SLS)

Note: The system prompt text must also be inlined in `api/chat.ts` (see Phase 4 constraint about api/ not importing from src/).

### 7.2 useChat Hook

File: `src/hooks/useChat.ts`

Responsibilities:
- Maintains chat message history array in Zustand store
- `sendMessage(text)` function:
  1. Check if text matches a quick-answer question (fuzzy match against Q&A pairs)
  2. If match: resolve instantly from `artemis-knowledge.ts`, no API call
  3. If no match: POST to `/api/chat` with full message history
  4. Append assistant response to history
- Handles loading state (typing indicator during API call)
- Handles errors (rate limiting, network failures)

### 7.3 ChatMessage.tsx

File: `src/chat/ChatMessage.tsx`

- Message bubble component
- User messages: right-aligned, blue background
- Assistant messages: left-aligned, dark background with subtle border
- Typing indicator (animated dots) shown during API response

### 7.4 QuickAnswers.tsx

File: `src/chat/QuickAnswers.tsx`

- Grid of clickable pill buttons (one per quick-answer question)
- Displayed at the start of the conversation or when no messages exist
- Clicking a button calls `sendMessage()` which resolves client-side
- Buttons fade out as conversation progresses (optional)

### 7.5 ChatPanel.tsx

File: `src/chat/ChatPanel.tsx`

- Toggle button: fixed bottom-right corner, always visible, `pointer-events: auto`
- Slide-in panel: Framer Motion `animate` for slide/fade transition
- Panel contents: scrollable message list + quick answers + text input
- Panel has `pointer-events: auto` so it does not conflict with 3D scene interaction
- Reads `chatOpen` and `chatMessages` from Zustand store

---

## Phase 8: Integration and Deploy

### 8.1 Wire App.tsx

File: `src/App.tsx`

Final composition:

```tsx
function App() {
  useOEM();        // Fetch OEM + Moon data, poll every 5 min
  useDSN();        // Fetch DSN XML, poll every 30 sec
  useMission();    // Compute MET, phase, progress every 1 sec

  const isLoading = useMissionStore((s) => s.isLoading);

  if (isLoading) return <LoadingScreen />;

  return (
    <div className="relative w-screen h-screen bg-space-dark">
      <Scene />        {/* Full-screen 3D canvas */}
      <HUD />          {/* Absolute overlay with telemetry */}
      <ChatPanel />    {/* Floating chat panel */}
    </div>
  );
}
```

### 8.2 Loading Screen

- Full-screen dark background with "ARTEMIS II" title
- Subtitle: "Loading trajectory data..."
- Shown while `isLoading === true` (before OEM data loads)
- Fades out when data is ready

### 8.3 Cross-Validation

On every DSN fetch, compare the interpolated Earth distance (from OEM + Lagrange) against the DSN `downlegRange` value. Log a warning to the console if the delta exceeds 1,000 km. This provides a continuous sanity check that the data pipeline is producing accurate results.

### 8.4 Vercel Deployment

```bash
# Login to Vercel
vercel login

# Set environment variables
vercel env add GEMINI_API_KEY
vercel env add NASA_API_KEY

# Deploy
vercel --prod
```

Verify after deployment:
- All 5 API endpoints return valid responses
- 3D scene loads and renders
- HUD displays live telemetry
- Chatbot responds to questions
- No console errors

---

## Verification Checklist

### Build and Tests
- [ ] `npm run dev` starts without errors
- [ ] `npm run build` succeeds without TypeScript errors
- [ ] `npm run test` passes all unit tests

### OEM Parser
- [ ] Correctly parses a real Artemis II OEM file into StateVector[]
- [ ] Handles comment lines and multiple META segments
- [ ] Parsed epochs and values match expected data

### Lagrange Interpolator
- [ ] Returns exact values when queried at known OEM data point epochs (error < 0.001 km)
- [ ] Returns plausible values when queried between data points
- [ ] Does not throw at boundary epochs (first/last data point)

### 3D Scene
- [ ] Renders Earth with visible texture
- [ ] Renders Moon with visible texture at correct position
- [ ] Renders Orion marker at interpolated position
- [ ] Renders trajectory line with past (orange) and future (cyan) segments
- [ ] Renders star field background
- [ ] Orion position updates in real-time

### HUD
- [ ] Displays Speed (km/h)
- [ ] Displays Earth Distance (km)
- [ ] Displays Moon Distance (km)
- [ ] Displays Mission Elapsed Time (M+ DD:HH:MM:SS)
- [ ] Displays Mission Progress (%)
- [ ] Numbers animate smoothly between updates (no jarring jumps)

### Camera
- [ ] Can rotate via mouse drag
- [ ] Can zoom via scroll wheel
- [ ] Can pan via right-click drag or two-finger drag

### API Proxies
- [ ] /api/oem returns valid OEM text
- [ ] /api/dsn returns valid XML
- [ ] /api/horizons returns valid JSON
- [ ] /api/donki returns valid JSON
- [ ] /api/chat returns a generated response

### Data Accuracy
- [ ] Displayed Speed is within 5% of NASA AROW value
- [ ] Displayed Earth Distance is within 5% of NASA AROW value
- [ ] Displayed Moon Distance is within 5% of NASA AROW value

### Chatbot
- [ ] Chat toggle button is visible and opens/closes the panel
- [ ] Quick-answer buttons resolve instantly without API call
- [ ] Free-text questions return relevant answers via Gemini API
- [ ] Chatbot refuses to answer questions outside its knowledge
- [ ] Gemini API key is not exposed in the client-side bundle

### Deployment
- [ ] Deploys successfully to Vercel
- [ ] No console errors in production build
- [ ] All API proxies function in production

---

## Known Gotchas

1. **useFrame only works inside Canvas children.** The `useSpacecraft` interpolation logic cannot live in a standalone hook called from App.tsx. It must be inside a component rendered within `<Canvas>`. Solution: `DataDriver.tsx` component that renders null.

2. **api/ directory cannot import from src/.** Vercel compiles serverless functions independently. The Artemis II system prompt for the chatbot must be inlined directly in `api/chat.ts`, not imported from `src/data/artemis-knowledge.ts`.

3. **Tailwind CSS v4 has no config file.** There is no `tailwind.config.ts`. All theme tokens, colors, and fonts are defined using `@theme` directives in `src/index.css`. The `@tailwindcss/vite` plugin is used instead of PostCSS.

4. **Gemini API uses non-standard role names.** The assistant role is `"role": "model"` (not `"role": "assistant"` as in OpenAI). The system prompt goes in the top-level `system_instruction` field (not as a message in the contents array).

5. **Vercel serverless functions use @vercel/node types.** Import `VercelRequest` and `VercelResponse` from `@vercel/node`, not from Next.js. These are Vite serverless functions, not Next.js API routes.

6. **Three.js bundle size.** Without manual chunks, Three.js can produce a single 1MB+ JavaScript bundle. The `manualChunks` config in `vite.config.ts` splits Three.js and R3F into separate chunks for better caching and parallel loading.

7. **Floating-point precision in Lagrange interpolation.** Using raw millisecond timestamps (e.g., 1.77e12) as interpolation parameters causes precision loss. Convert epochs to relative seconds from the first data point in the interpolation window.

8. **OEM files may have multiple META segments.** Some OEM files contain multiple trajectory segments with separate META_START/META_STOP blocks. The parser must handle this and concatenate all data lines.

9. **Moon position from Horizons needs the same coordinate frame.** Request Earth-centered (geocentric) J2000 vectors from JPL Horizons to match the OEM reference frame. Use `command='301'` for the Moon and `CENTER='500@399'` for Earth center.

10. **Texture loading is asynchronous.** Use `useTexture` from `@react-three/drei` inside a `<Suspense>` boundary. Without Suspense, the component will throw during the loading phase.

11. **HUD pointer-events conflict.** The HUD overlay covers the entire viewport. Set `pointer-events: none` on the HUD container and `pointer-events: auto` only on interactive elements (buttons, inputs, chat panel). Otherwise, the 3D scene will not receive mouse events.

12. **DSN feed may not list Artemis II.** If no DSN dish is currently communicating with Orion, the XML will not contain an Orion target. Handle gracefully by showing "No DSN contact" state rather than erroring.

13. **Circumcenter ≠ Moon center (Session 5 lesson).** The circumcenter of a trajectory arc is the center of the osculating circle, NOT the gravitational body the trajectory orbits. For the Artemis II lunar flyby, the circumcenter is 5,034 km from the Moon's actual position. Always use real ephemeris data (JPL Horizons) for celestial body positioning, not geometric approximations from trajectory geometry.

14. **Orion distance-adaptive scaling prevents planet-sized sprites.** A fixed-size billboard sprite appears planet-sized in trajectory overview zoom. Use `useFrame` to compute camera distance and lerp the sprite scale (e.g., 1.0x at <5 su to 0.1x at >40 su). Gate label/hover visibility on a distance threshold to avoid per-frame DOM updates.

15. **HUD pointer-events-auto on flex containers blocks 3D interaction.** Applying `pointer-events-auto` to a wrapper `div` (e.g., with `flex-1`) creates an invisible overlay that intercepts all pointer events before they reach the Canvas. Always apply `pointer-events-auto` only to the specific interactive element, not its layout container.
