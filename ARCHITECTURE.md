# ARTEMIS -- Architecture

## 1. System Overview

ARTEMIS is a greenfield interactive 3D web visualization of the Artemis II lunar flyby mission, built with Vite + React + React Three Fiber and deployed on Vercel. The application consumes live NASA data feeds -- OEM ephemeris files for spacecraft trajectory, DSN Now XML for real-time communications status, JPL Horizons for lunar position, and DONKI for space weather -- through Vercel serverless API proxies that solve CORS and provide edge caching. The client is a single-page application with three visual layers: a WebGL 3D scene (Earth, Moon, Orion spacecraft, trajectory path, star field), an animated HUD overlay showing real-time telemetry (velocity, distances, mission elapsed time, DSN status), and a floating AI chatbot panel powered by Gemini 2.5 Flash via system-prompt-stuffed LLM calls. Zustand manages shared state between the 3D render loop and the React UI, while Lagrange interpolation bridges the 4-minute gaps in OEM data to produce smooth, accurate spacecraft positioning at 60fps.

---

## 2. Architecture Diagram

```
+------------------------------------------------------------------+
|  Vercel Deployment                                                |
|                                                                   |
|  Serverless API Routes (/api/)                                    |
|  +--------------------------------------------------------------+ |
|  |  /api/oem       --> nasa.gov OEM file (trajectory ephemeris) | |
|  |  /api/dsn       --> eyes.nasa.gov DSN XML (comms status)     | |
|  |  /api/horizons  --> ssd.jpl.nasa.gov API (moon position)     | |
|  |  /api/donki     --> api.nasa.gov DONKI (space weather)       | |
|  |  /api/chat      --> generativelanguage.googleapis.com (LLM)  | |
|  +--------------------------------------------------------------+ |
|                          |                                        |
|                          | JSON / XML / text                      |
|                          v                                        |
|  Static SPA (Vite + React 19 + TypeScript)                        |
|  +--------------------------------------------------------------+ |
|  |                                                              | |
|  |  3D Scene Layer (React Three Fiber + drei)                   | |
|  |  +------ Canvas ----------------------------------------+    | |
|  |  |  Earth         -- textured sphere + atmosphere glow  |    | |
|  |  |  Moon          -- textured sphere, JPL-positioned    |    | |
|  |  |  Orion         -- emissive marker + Html label       |    | |
|  |  |  Trajectory    -- Line: past=solid, future=dashed    |    | |
|  |  |  Stars         -- Points geometry (5000 particles)   |    | |
|  |  |  DataDriver    -- useFrame interpolation (no render) |    | |
|  |  |  CameraController -- OrbitControls + presets         |    | |
|  |  +------------------------------------------------------+    | |
|  |                                                              | |
|  |  HUD Overlay (React + Framer Motion)                         | |
|  |  +------------------------------------------------------+    | |
|  |  |  Velocity gauge      | Earth distance | Moon distance |    | |
|  |  |  Mission elapsed time | Progress bar  | DSN status    |    | |
|  |  |  Camera preset buttons                                |    | |
|  |  +------------------------------------------------------+    | |
|  |                                                              | |
|  |  Chat Panel (React)                                          | |
|  |  +------------------------------------------------------+    | |
|  |  |  Quick-answer buttons (client-side, no API call)      |    | |
|  |  |  Free-text input --> /api/chat --> Gemini Flash        |    | |
|  |  |  Message history (user + assistant bubbles)            |    | |
|  |  +------------------------------------------------------+    | |
|  |                                                              | |
|  |  Data Layer (Zustand + custom hooks)                         | |
|  |  +------------------------------------------------------+    | |
|  |  |  useOEM()        -- fetch, parse, store, poll 5 min   |    | |
|  |  |  useDSN()        -- poll XML, parse targets, 30 sec   |    | |
|  |  |  useMission()    -- elapsed time, phase, progress %   |    | |
|  |  |  useSpacecraft() -- derived metrics (speed, distances) |    | |
|  |  |  useChat()       -- message history, send, streaming   |    | |
|  |  +------------------------------------------------------+    | |
|  |                                                              | |
|  +--------------------------------------------------------------+ |
+------------------------------------------------------------------+
```

---

## 3. Tech Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Build | Vite | 6.x | Dev server with sub-second HMR, production bundler |
| UI Framework | React | 19.x | Component model for UI and 3D scene |
| Language | TypeScript | 5.x | Type safety across data pipeline and components |
| 3D Engine | Three.js | r170+ | WebGL rendering engine |
| 3D React Binding | @react-three/fiber | 9.x | Declarative React wrapper for Three.js |
| 3D Helpers | @react-three/drei | 9.x | OrbitControls, Html overlay, effects, loaders |
| Post-processing | @react-three/postprocessing | 3.x | Bloom and glow effects |
| Animation | Framer Motion | 12.x | HUD animated counters, spring physics transitions |
| State Management | Zustand | 5.x | Lightweight global store, accessible inside render loop |
| Styling | Tailwind CSS | 4.x | Utility-first CSS, CSS-only config via @theme |
| Hosting | Vercel | -- | Static SPA hosting + serverless functions (free tier) |
| Serverless Runtime | @vercel/node | -- | TypeScript types for VercelRequest/VercelResponse |
| AI Chatbot | Google Gemini 2.5 Flash | -- | Free-tier LLM for mission Q&A (15 RPM, 1,000 RPD) |
| Testing | Vitest | -- | Unit tests for parser and interpolator |

---

## 4. Data Pipeline

### 4.1 OEM Ephemeris (Primary Trajectory Source)

```
Fetch /api/oem (poll every 5 minutes)
  |
  v
Raw CCSDS OEM text
  |
  v
oem-parser.ts
  - Skip META_START/META_STOP blocks and COMMENT lines
  - Parse header: OBJECT_NAME, REF_FRAME, TIME_SYSTEM, INTERPOLATION_DEGREE
  - Parse state vectors: { epoch, x, y, z, vx, vy, vz } (km, km/s)
  - Handle multiple segments and epoch format variations
  |
  v
StateVector[] stored in Zustand
  |
  v
DataDriver.tsx (useFrame -- runs every animation frame)
  - Lagrange interpolate (degree 8) to current UTC
  - Select nearest 9 state vectors as interpolation window
  - Compute interpolated position (x, y, z) and velocity (vx, vy, vz)
  |
  v
Derived metrics (useSpacecraft):
  - speed = sqrt(vx^2 + vy^2 + vz^2) * 3600   (km/s --> km/h)
  - earthDist = sqrt(x^2 + y^2 + z^2)          (km)
  - moonDist = distance(orionPos, moonPos)      (km)
  |
  v
3D Scene: Orion marker position (scaled)
HUD: Velocity, Earth distance, Moon distance
```

**Polling interval**: 5 minutes (OEM files update periodically, not continuously).

### 4.2 DSN Now XML (Real-Time Communications)

```
Poll /api/dsn every 30 seconds
  |
  v
Raw XML from eyes.nasa.gov
  |
  v
dsn-parser.ts (DOMParser)
  - Filter for Artemis II spacecraft target
  - Extract: dish name, azimuth, elevation, range, signal strength, data rate
  |
  v
DsnStation[] + DsnTarget[] stored in Zustand
  |
  v
HUD: Antenna status indicators (Goldstone, Canberra, Madrid)
Cross-validation: Compare DSN downlegRange with OEM-interpolated Earth distance
  - Log warning if delta > 1,000 km
```

**Polling interval**: 30 seconds (upstream refreshes every 5 seconds, but 30 seconds is sufficient for a frontend).

### 4.3 JPL Horizons (Moon Position)

```
Fetch /api/horizons on load, then every 30 minutes
  |
  v
JSON response from ssd.jpl.nasa.gov/api/horizons.api
  - command='301' (Moon)
  - center='500@399' (Earth geocenter)
  - ephem_type='VECTORS'
  |
  v
Moon state vector (x, y, z in km)
  |
  v
Zustand store --> Moon.tsx (scaled position in 3D scene)
```

**Polling interval**: 30 minutes (Moon position changes slowly relative to visualization scale).

### 4.4 DONKI Space Weather (Supplementary)

```
Fetch /api/donki on load, then every 15 minutes
  |
  v
JSON from api.nasa.gov/DONKI
  - Check for active solar flares, CMEs, radiation storms
  |
  v
HUD: Alert badge if active space weather event detected
```

**Polling interval**: 15 minutes.

---

## 5. Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Build tool | Vite (not Next.js) | Client-side SPA needs no SSR. Vite provides sub-second HMR, smaller bundle (~200KB less than Next.js), and faster TTI. Next.js adds hydration complexity unnecessary for a WebGL visualization. |
| 3D rendering | React Three Fiber (not vanilla Three.js) | R3F provides a React component model for Three.js, enabling declarative scene composition. The drei ecosystem (OrbitControls, Html, effects) accelerates development. Vanilla Three.js would require manual state management and lose HMR for scene components. |
| State management | Zustand (not Redux) | Zustand works outside the React tree, which is critical for accessing state inside the Three.js render loop (useFrame). It has zero boilerplate compared to Redux. The store is simple enough (OEM data, DSN data, spacecraft state, camera mode) that Redux's middleware and devtools overhead is unjustified. |
| Chatbot approach | System prompt stuffing (not RAG) | The entire Artemis II knowledge base is approximately 2,000--4,000 tokens, which fits comfortably in a single system prompt. RAG adds a vector database, embedding pipeline, and chunking strategy -- engineering complexity that is unjustifiable when the full corpus is smaller than a typical LLM context window. System prompt stuffing also eliminates retrieval errors. |
| Chatbot LLM | Gemini 2.5 Flash (not Claude) | Gemini Flash offers a genuinely free tier (15 RPM, 1,000 RPD, no credit card required). Claude Haiku provides higher quality but requires $5 starter credits. For FAQ-style Q&A about a well-defined mission, Gemini Flash quality is sufficient and meets the $0 budget constraint. |
| Interpolation | Lagrange degree 8 (not Runge-Kutta) | OEM metadata specifies INTERPOLATION_DEGREE=8 for the ephemeris data. Lagrange polynomial interpolation bridges the 4-minute data point intervals for smooth 60fps rendering. Runge-Kutta is a numerical ODE integrator for orbital propagation -- it solves a different problem (computing orbits from forces) and is out of scope when authoritative trajectory data already exists in the OEM file. |
| Coordinate frame | J2000/EME2000, Earth-centered | Matches the OEM REF_FRAME. Earth at origin simplifies the 3D scene. Scale factor of 1 unit = 10,000 km keeps the scene manageable. |
| HUD animation | Framer Motion | Spring-physics animated counters provide smooth number transitions between data updates. Prevents jarring jumps when telemetry values change. |

---

## 6. Coordinate System

The visualization uses the **J2000 (EME2000) Earth-centered inertial frame**, matching the coordinate system specified in the OEM ephemeris files.

- **Origin**: Earth center of mass
- **Reference frame**: Earth Mean Equator and Equinox of J2000.0
- **Units in OEM data**: kilometers (position), kilometers per second (velocity)
- **Scale factor in 3D scene**: **1 unit = 10,000 km**
  - Earth radius (~6,371 km) renders as ~0.637 units
  - Moon distance (~384,400 km) renders as ~38.4 units
  - Lunar flyby altitude (~6,600 km beyond far side) is visually discernible
- **Earth sphere**: radius = 0.637 units (true to-scale). Emissive intensity 3.5 to compensate for small apparent size.
- **Moon sphere**: positioned via bundled JPL Horizons ephemeris (37 geocentric J2000 data points at 6-hour intervals, April 2-11 2026). Linear interpolation at simulation time. See `src/data/moon-ephemeris.ts`.
- **Orion sprite**: distance-adaptive scaling — lerps from 1.0x at close zoom (<5 su) to 0.1x at overview zoom (>40 su). Label/hover visibility gated at 25 su.
- **Conversion**: `scenePosition = oemPosition / 10000`

> **Design Decision (Session 5)**: Moon position was initially computed via a circumcenter algorithm (center of the osculating circle of the trajectory arc). After 7 investigations, this was proven incorrect — the osculating circle center is 5,034 km from the Moon's actual gravitational center. Replaced with bundled JPL Horizons ephemeris data, which gives 8,357 km trajectory clearance at perilune.

---

## 7. File Structure

```
artemis-tracker/
|-- public/
|   |-- textures/
|   |   |-- earth-day.jpg           # NASA Blue Marble 2K texture
|   |   |-- earth-night.jpg         # Earth city lights (post-MVP)
|   |   |-- earth-clouds.png        # Cloud layer, transparent (post-MVP)
|   |   |-- moon.jpg                # Lunar surface texture
|   |   +-- star-particle.png       # Star sprite (post-MVP)
|   +-- favicon.svg
|-- src/
|   |-- components/
|   |   |-- Scene.tsx               # R3F Canvas + Suspense + scene composition
|   |   |-- Earth.tsx               # Textured sphere + atmosphere glow
|   |   |-- Moon.tsx                # Textured sphere, positioned from store
|   |   |-- Spacecraft.tsx          # Orion emissive marker + Html label
|   |   |-- Trajectory.tsx          # OEM trajectory line (past/future split)
|   |   |-- Stars.tsx               # Points geometry background star field
|   |   |-- DataDriver.tsx          # useFrame interpolation (renders null)
|   |   +-- CameraController.tsx    # OrbitControls + camera preset animations
|   |-- hud/
|   |   |-- HUD.tsx                 # Overlay container (absolute, pointer-events: none, isolate stacking)
|   |   |-- TelemetryCard.tsx       # Animated number counter card
|   |   |-- MissionClock.tsx        # M+ DD:HH:MM:SS live counter
|   |   |-- ProgressBar.tsx         # Mission progress percentage bar with 19 milestone markers
|   |   |-- DSNStatus.tsx           # Antenna status indicators
|   |   |-- CameraControls.tsx      # Camera preset buttons
|   |   |-- MissionEventsPanel.tsx  # Hamburger menu with 19 milestones, auto-scroll
|   |   |-- CrewPanel.tsx           # Crew dropdown (4 astronauts)
|   |   |-- SpaceWeatherPanel.tsx   # Kp index, solar wind, radiation zone indicators
|   |   |-- AlertsBanner.tsx        # Auto-dismiss alert banner (timer per alert)
|   |   +-- AlertItem.tsx           # Individual alert display
|   |-- chat/
|   |   |-- ChatPanel.tsx           # Floating chat panel with toggle button
|   |   |-- ChatMessage.tsx         # User/assistant message bubble (DOMPurify sanitized)
|   |   |-- ChatVideo.tsx           # YouTube video embed (videoId validated)
|   |   +-- QuickAnswers.tsx        # Clickable quick-answer pill buttons
|   |-- data/
|   |   |-- oem-parser.ts           # CCSDS OEM file parser (~50 lines)
|   |   |-- interpolator.ts         # Lagrange interpolation (degree 8)
|   |   |-- dsn-parser.ts           # DSN XML parser (DOMParser-based)
|   |   |-- mission-config.ts       # Launch epoch, crew (4), milestones (19), phases
|   |   |-- moon-ephemeris.ts       # Bundled JPL Horizons Moon ephemeris (37 J2000 points)
|   |   +-- artemis-knowledge.ts    # System prompt content + quick-answer Q&A pairs
|   |-- hooks/
|   |   |-- useOEM.ts               # Fetch /api/oem, parse, store, poll every 5 min
|   |   |-- useDSN.ts               # Fetch /api/dsn, parse XML, poll every 30 sec
|   |   |-- useSpacecraft.ts        # Derived metrics (speed, earthDist, moonDist)
|   |   |-- useMission.ts           # Elapsed time, current phase, progress %
|   |   |-- useChat.ts              # Chat state, message history, quick-answer resolution
|   |   +-- useAlerts.ts            # 2 effects: weather alerts + milestone notifications
|   |-- store/
|   |   +-- mission-store.ts        # Zustand store (OEM, DSN, spacecraft, camera, chat)
|   |-- App.tsx                     # Root layout: Canvas + HUD + ChatPanel
|   |-- main.tsx                    # React entry point
|   +-- index.css                   # Tailwind @import + @theme (space colors, mono font)
|-- api/
|   |-- oem.ts                      # Vercel serverless: OEM file proxy
|   |-- dsn.ts                      # Vercel serverless: DSN XML proxy
|   |-- horizons.ts                 # Vercel serverless: JPL Horizons proxy
|   |-- donki.ts                    # Vercel serverless: DONKI space weather proxy
|   +-- chat.ts                     # Vercel serverless: Gemini Flash chat proxy
|-- tests/
|   |-- oem-parser.test.ts          # Unit tests for OEM parsing
|   +-- interpolator.test.ts        # Unit tests for Lagrange interpolation accuracy
|-- package.json
|-- tsconfig.json
|-- vite.config.ts                  # React plugin, Tailwind v4 plugin, manual chunks
|-- vercel.json                     # API route rewrites, SPA fallback, cache headers
|-- .env.example                    # NASA_API_KEY, GEMINI_API_KEY placeholders
+-- .gitignore
```

---

## 8. Serverless Functions

Each API route is a Vercel serverless function that proxies an upstream NASA endpoint, adding CORS headers and response caching. All functions live in the `api/` directory at the project root (Vercel convention).

| Route | Upstream Endpoint | Returns | Cache TTL | Notes |
|-------|-------------------|---------|-----------|-------|
| `/api/oem` | `nasa.gov` OEM file URL | Raw text (CCSDS OEM format) | 5 minutes | Primary trajectory source. Returns state vectors at 4-min intervals. |
| `/api/dsn` | `eyes.nasa.gov/apps/dsn-now/dsn.xml` | XML | 30 seconds | Real-time Deep Space Network status. Filter client-side for Artemis II target. |
| `/api/horizons` | `ssd.jpl.nasa.gov/api/horizons.api` | JSON | 30 minutes | Moon position (command=301, center=500@399, ephem_type=VECTORS). No auth required. |
| `/api/donki` | `api.nasa.gov/DONKI/*` | JSON | 15 minutes | Space weather events (solar flares, CMEs). Uses NASA_API_KEY from env (DEMO_KEY for dev). |
| `/api/chat` | `generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent` | JSON | None | Proxies chat messages with Artemis II system prompt prepended. Uses GEMINI_API_KEY from env. Non-streaming for MVP. |

All functions use `VercelRequest` / `VercelResponse` types from `@vercel/node`. Each function sets:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, OPTIONS`
- `Cache-Control: s-maxage=<TTL>, stale-while-revalidate` (except `/api/chat`)

The `api/` directory cannot import from `src/` -- Vercel bundles serverless functions separately from the SPA build. The system prompt for the chatbot must be inlined in `api/chat.ts`.

---

## 9. 3D Scene Components

All 3D components live inside the R3F `<Canvas>` element rendered by `Scene.tsx`. They are standard React components that use R3F hooks (`useFrame`, `useThree`) and Three.js primitives.

### Earth (`Earth.tsx`)
- `SphereGeometry(1, 64, 64)` with NASA Blue Marble 2K day texture
- Atmosphere glow via bloom post-processing or emissive outer shell
- Positioned at origin (0, 0, 0) -- the coordinate system is Earth-centered
- Ambient light + directional light simulating the Sun

### Moon (`Moon.tsx`)
- `SphereGeometry(0.27, 32, 32)` with lunar surface texture
- To-scale radius ratio with Earth sphere (Moon radius / Earth radius ~ 0.27)
- Position read from Zustand store, sourced from JPL Horizons data
- Scaled: `position = horizonsVector / 10000`
- Correct phase lighting from Sun direction

### Orion Spacecraft (`Spacecraft.tsx`)
- Small emissive sphere or `Sprite` with bloom glow effect
- Position from Lagrange-interpolated OEM state vector, scaled by 1/10000
- drei `Html` component for "ORION" label overlay (clickable for details)
- Pulsing animation to draw visual attention

### Trajectory (`Trajectory.tsx`)
- `Line` geometry from all OEM state vector positions (scaled)
- Split at current epoch into two segments:
  - Past: solid line, warm color (orange/gold)
  - Future: dashed line, cool color (blue/cyan)
- Current position highlighted with radial glow marker

### Stars (`Stars.tsx`)
- `Points` geometry with approximately 5,000 randomly distributed positions
- Star sprite texture for each point
- Large bounding sphere so stars remain in background at all camera distances

### DataDriver (`DataDriver.tsx`)
- Renders `null` (no visual output)
- Runs `useFrame` to perform Lagrange interpolation on every animation frame
- Computes derived metrics (speed, Earth distance, Moon distance)
- Writes results to Zustand store for consumption by HUD components
- Exists because `useFrame` can only be called inside `<Canvas>` children

### CameraController (`CameraController.tsx`)
- drei `OrbitControls` for free mouse/touch navigation (rotate, zoom, pan)
- Camera preset functions triggered from HUD buttons:
  - Follow Orion: camera tracks behind spacecraft, looking toward Moon
  - Earth View: camera near Earth surface, looking outward at trajectory
  - Moon View: camera at Moon, looking back at approaching Orion
  - Free Orbit: standard OrbitControls, user navigates freely
- Smooth camera transitions via Framer Motion or lerp in useFrame

---

## 10. Important Technical Notes

These are practical constraints and gotchas discovered during design and planning.

### useFrame Must Be Inside Canvas
The R3F `useFrame` hook can only be called inside components that are children of `<Canvas>`. This is why `DataDriver.tsx` exists as a render-null component inside the 3D scene -- it runs per-frame interpolation and writes to Zustand, which HUD components (outside Canvas) then read. Do not attempt to call `useFrame` in HUD components or App.tsx.

### api/ Cannot Import src/
Vercel bundles serverless functions (`api/`) separately from the Vite SPA build (`src/`). Any shared code (such as the Artemis II system prompt for the chatbot) must be inlined directly in the serverless function file. Attempting to import from `src/data/artemis-knowledge.ts` in `api/chat.ts` will fail at deploy time.

### Tailwind CSS v4 Uses CSS-Only Configuration
Tailwind v4 does not use a `tailwind.config.ts` file. All theme customization is done via `@theme` directives directly in `src/index.css`. The Tailwind Vite plugin (`@tailwindcss/vite`) handles integration. Do not create a `tailwind.config.ts` file.

### Gemini API Role Naming
The Gemini API uses `"role": "model"` for assistant messages, not `"role": "assistant"` as used by Claude and OpenAI. The system prompt is passed via the top-level `system_instruction` field in the request body, not as a message with `"role": "system"`. Failing to use the correct role names will cause API errors.

### Three.js Bundle Size
Three.js adds approximately 500KB+ to the JavaScript bundle. Use Vite's `manualChunks` in `vite.config.ts` to split Three.js into a separate chunk, preventing it from blocking initial page render. The target is to keep the initial JS bundle under 500KB gzipped (textures load separately via HTTP).

### Coordinate Scale
All OEM positions are in kilometers. Divide by 10,000 before placing objects in the 3D scene. Forgetting this scale conversion will result in objects being placed millions of units from the camera, rendering them invisible.

### Cross-Validation
Compare the OEM-interpolated Earth distance against the DSN `downlegRange` value. If the delta exceeds 1,000 km, log a warning. This catches interpolation errors and stale OEM data. A community Artemis II tracker was publicly criticized for showing incorrect distances -- data accuracy is non-negotiable.

### Vercel for Vite SPAs
Vite SPAs on Vercel require a `vercel.json` rewrite rule to handle client-side routing: all non-API, non-asset routes must fall back to `index.html`. Serverless functions use `VercelRequest` and `VercelResponse` types from `@vercel/node` (install as devDependency).

### Non-Streaming Chat for MVP
The `/api/chat` endpoint uses Gemini's non-streaming `generateContent` method for the MVP. Responses typically arrive in 1--3 seconds, which is acceptable for FAQ-style Q&A. Streaming can be added post-MVP if latency becomes a concern.
