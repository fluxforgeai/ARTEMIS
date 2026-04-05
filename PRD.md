# ARTEMIS -- Product Requirements Document

**Version**: 1.0
**Date**: 2026-04-03
**Author**: FluxForge AI
**Status**: Draft

---

## 1. Product Overview

### What Is ARTEMIS?

ARTEMIS (Artemis Real-Time Earth-Moon Interactive System) is an interactive 3D web application that visualizes the Artemis II lunar flyby mission in real time. It combines data from multiple NASA sources -- OEM ephemeris files, DSN Now XML, JPL Horizons API, and DONKI space weather feeds -- into a single, visually compelling experience that lets anyone explore the mission as it happens.

### Why Does It Exist?

NASA does not provide a unified real-time telemetry API for the Artemis II mission. The data is scattered across separate endpoints with different formats, refresh intervals, and access patterns. Existing community trackers have proven unreliable: one was publicly criticized on Hacker News for displaying distances off by over 100,000 km and velocities off by nearly double. Meanwhile, the most widely viewed tracker -- a YouTube broadcast overlay -- is entirely passive and non-interactive.

### What Problem Does It Solve?

ARTEMIS solves three problems simultaneously:

1. **Data fragmentation** -- It merges OEM trajectory data, DSN communication status, JPL ephemeris calculations, and DONKI space weather into a single coherent view.
2. **Inaccuracy of existing trackers** -- It uses Lagrange interpolation (degree 8, matching OEM metadata specifications) with cross-validation against DSN range measurements, and verifies output against NASA's official AROW tracker.
3. **Passive viewing experience** -- It replaces static broadcast overlays with a fully interactive 3D scene where users can rotate, zoom, follow the spacecraft, and ask questions via an AI chatbot.

---

## 2. Target Users

| User Segment | Description | Primary Need |
|---|---|---|
| Space enthusiasts | People following the Artemis II mission in real time | See where Orion is right now, understand the trajectory, explore the Earth-Moon system |
| Educators | Teachers using the mission as a classroom engagement tool | Demonstrate orbital mechanics, cislunar navigation, and mission operations in a visual, interactive format |
| Students | High school and university students studying STEM | Interact with real mission data rather than static textbook diagrams |
| Developers | Software engineers interested in space data visualization | Reference implementation for consuming NASA data feeds (OEM, DSN, Horizons) in a web app |
| Media and journalists | Reporters covering the Artemis II mission | Embed or reference accurate, real-time telemetry data with visual context |
| General public | Anyone curious about the Moon mission | Casual browsing without needing to understand orbital mechanics |

---

## 3. User Stories

**US-1**: As a space enthusiast, I want to see Orion's real-time position in a 3D Earth-Moon scene so I can understand where the spacecraft is in its trajectory relative to Earth and the Moon.

**US-2**: As an educator, I want to display live telemetry data (speed, distance from Earth, distance to Moon, mission elapsed time) on screen so I can use it as a teaching aid during class.

**US-3**: As a student, I want to rotate, zoom, and pan the 3D visualization freely so I can explore the spatial relationship between Earth, Moon, and Orion from any angle.

**US-4**: As a casual visitor, I want to ask questions about the mission in plain language (e.g., "Who are the crew?" or "How far will they go?") and get accurate answers so I can learn without searching multiple websites.

**US-5**: As a space enthusiast, I want to see the full trajectory path (past and future) so I can understand the complete mission profile, including the lunar flyby and return.

**US-6**: As a developer, I want to see which DSN antennas are currently communicating with Orion so I can understand the real-time ground network supporting the mission.

**US-7**: As a journalist, I want to see a mission progress indicator so I can quickly report how far along the mission is without performing date calculations.

---

## 4. Functional Requirements

### 4.1 3D Visualization

| ID | Requirement | Priority |
|---|---|---|
| VIZ-01 | Render Earth as a textured sphere (NASA Blue Marble, 2K resolution) with correct rotation | MVP |
| VIZ-02 | Render Moon as a textured sphere (NASA CGI Moon Kit), positioned from JPL Horizons data | MVP |
| VIZ-03 | Render Orion spacecraft as a glowing marker at its interpolated OEM position, with a text label | MVP |
| VIZ-04 | Display trajectory line from OEM state vectors: solid orange for past path, dashed cyan for future path | MVP |
| VIZ-05 | Render star field background (~5,000 particles) | MVP |
| VIZ-06 | Provide OrbitControls for free camera navigation (rotate, zoom, pan) via mouse and touch | MVP |
| VIZ-07 | Support camera presets: Follow Orion, Earth View, Moon View, Free Orbit | Completed (Session 2) |
| VIZ-08 | Apply bloom/glow post-processing effects to Orion marker and Earth atmosphere | Completed (Session 4) |
| VIZ-09 | Render Earth atmosphere glow and day/night terminator | Post-MVP |
| VIZ-10 | Correct directional lighting from Sun position | MVP |

### 4.2 Live Telemetry HUD

| ID | Requirement | Priority |
|---|---|---|
| HUD-01 | Display current speed in km/h with animated counter transitions | MVP |
| HUD-02 | Display distance from Earth in km with animated counter transitions | MVP |
| HUD-03 | Display distance to Moon in km with animated counter transitions | MVP |
| HUD-04 | Display mission elapsed time as M+ DD:HH:MM:SS, updating every second | MVP |
| HUD-05 | Display mission progress as a percentage bar | MVP |
| HUD-06 | Show "last updated" timestamp for data freshness | MVP |
| HUD-07 | Animate telemetry numbers smoothly between data updates (no jarring jumps) | MVP |
| HUD-08 | Display crew activity timeline showing current and upcoming activities | Completed (Session 4) |

### 4.3 AI Mission Chatbot

| ID | Requirement | Priority |
|---|---|---|
| CHAT-01 | Provide a floating chat panel toggled by a button in the bottom-right corner | MVP |
| CHAT-02 | Display 10-15 quick-answer buttons for common questions (e.g., "Who are the crew?", "How long is the mission?") | MVP |
| CHAT-03 | Resolve quick-answer button presses client-side from pre-written answers without any API call | MVP |
| CHAT-04 | Accept free-text questions and route them to Gemini 2.5 Flash via a serverless API proxy | MVP |
| CHAT-05 | Include a system prompt containing ~2,000-4,000 tokens of verified Artemis II mission facts | MVP |
| CHAT-06 | Instruct the model to answer only from provided facts and respond "I don't have that information" for unknown questions | MVP |
| CHAT-07 | Never expose the Gemini API key in the client-side bundle; proxy all requests through /api/chat | MVP |
| CHAT-08 | Stream responses to the chat UI for perceived responsiveness | MVP |

### 4.4 DSN Status

| ID | Requirement | Priority |
|---|---|---|
| DSN-01 | Display antenna status indicators for Goldstone, Canberra, and Madrid | Post-MVP |
| DSN-02 | Show which DSN dishes are actively communicating with Orion (green = active, gray = inactive) | Post-MVP |
| DSN-03 | Degrade gracefully to "No DSN contact" if Artemis II is not listed in the feed | Post-MVP |

### 4.5 Data Pipeline

| ID | Requirement | Priority |
|---|---|---|
| DATA-01 | Parse CCSDS OEM text files into typed state vector arrays (epoch, x, y, z, vx, vy, vz) | MVP |
| DATA-02 | Implement Lagrange interpolation (degree 8) to compute position and velocity at arbitrary UTC epochs | MVP |
| DATA-03 | Fetch OEM data via /api/oem serverless proxy, polling every 5 minutes | MVP |
| DATA-04 | Parse DSN Now XML via /api/dsn serverless proxy, polling every 30 seconds | MVP |
| DATA-05 | Fetch Moon position from JPL Horizons via /api/horizons serverless proxy, polling every 30 minutes | MVP |
| DATA-06 | Fetch space weather events from DONKI via /api/donki serverless proxy, polling every 15 minutes | Post-MVP |
| DATA-07 | Cross-validate OEM-interpolated Earth distance against DSN downlegRange; log warnings if delta exceeds 1,000 km | MVP |
| DATA-08 | Apply response caching on serverless proxies (OEM: 5 min, DSN: 30 sec, Horizons: 30 min, DONKI: 15 min) | MVP |
| DATA-09 | Use J2000/EME2000 Earth-centered coordinate frame; scale 1 unit = 10,000 km | MVP |

---

## 5. Non-Functional Requirements

### 5.1 Performance

| ID | Requirement | Target |
|---|---|---|
| PERF-01 | 3D scene must render at 60 fps on mid-range hardware (e.g., M1 MacBook, GTX 1060) | 60 fps |
| PERF-02 | Initial page load to interactive 3D scene | < 3 seconds on broadband |
| PERF-03 | JavaScript bundle size (gzipped, excluding textures) | < 500 KB |
| PERF-04 | Telemetry HUD update latency from data fetch to display | < 1 second |
| PERF-05 | Chatbot response latency (free-text, end-to-end) | < 3 seconds |
| PERF-06 | Quick-answer button response time | < 100 ms (client-side) |

### 5.2 Accuracy

| ID | Requirement | Target |
|---|---|---|
| ACC-01 | Displayed speed must be within 5% of NASA AROW value | <= 5% deviation |
| ACC-02 | Displayed Earth distance must be within 5% of NASA AROW value | <= 5% deviation |
| ACC-03 | Displayed Moon distance must be within 5% of NASA AROW value | <= 5% deviation |
| ACC-04 | Chatbot must not hallucinate mission facts; must refuse unknown questions | Zero hallucination on verifiable facts |

### 5.3 Cost

| ID | Requirement | Target |
|---|---|---|
| COST-01 | Total operational cost for hosting and APIs | $0 |
| COST-02 | Vercel hosting tier | Free |
| COST-03 | NASA API access (OEM, DSN, Horizons, DONKI) | Free (public, no auth or DEMO_KEY) |
| COST-04 | LLM API for chatbot | $0 (Gemini 2.5 Flash free tier: 15 RPM, 1,000 RPD) |

### 5.4 Browser Support

| ID | Requirement | Target |
|---|---|---|
| COMPAT-01 | Chrome, Firefox, Safari, Edge (latest 2 versions) | Full support |
| COMPAT-02 | WebGL2 required for 3D rendering | Detect and show fallback message if unsupported |
| COMPAT-03 | Responsive layout for tablets and mobile devices | In Progress (15 open findings) |

---

## 6. MVP vs Post-MVP

### MVP (Sprint 1 -- Ship in 1-2 days)

The MVP delivers a functional, accurate, and visually compelling tracker with the core interactive experience.

- Project scaffold: Vite + React 19 + TypeScript + Tailwind CSS 4
- Vercel serverless API proxies for OEM, DSN, Horizons (with CORS headers and caching)
- OEM parser and Lagrange interpolator (degree 8) with unit tests
- 3D scene: Earth (textured), Moon (textured, positioned), Orion (glowing marker), trajectory line (past/future), star field, directional lighting
- HUD overlay: speed, Earth distance, Moon distance, mission elapsed time, mission progress bar, last-updated timestamp
- Animated telemetry counters (Framer Motion spring physics)
- Camera controls: OrbitControls for free navigation
- AI chatbot: floating panel, quick-answer buttons (client-side), free-text via Gemini Flash (/api/chat proxy)
- Loading screen while OEM data is fetched
- Cross-validation of interpolated data against DSN range
- Vercel deployment

### Post-MVP (Sprint 2 -- Days 3-7)

Post-MVP features add polish, depth, and broader device support, but the tracker is fully usable without them.

**Completed**:
- ~~DSN antenna status indicators~~ (Session 1)
- ~~Camera presets with smooth animation (Follow Orion, Earth View, Moon View)~~ (Session 2)
- ~~Bloom/glow post-processing effects~~ (Session 4)
- ~~Crew activity timeline~~ (Session 4)
- ~~Space weather alerts (DONKI integration)~~ (Session 4)

**Remaining**:
- Earth atmosphere shader and day/night terminator
- Mobile responsive layout (15 open findings — chat overflow, HUD stack, touch targets, z-index)
- Mission branding and visual polish

---

## 7. Success Metrics

| Metric | Target | Measurement Method |
|---|---|---|
| Data accuracy vs AROW | Speed, Earth distance, Moon distance all within 5% of NASA AROW values | Manual comparison against https://www.nasa.gov/trackartemis on first deploy and daily thereafter |
| Initial load time | < 3 seconds to interactive 3D scene on broadband | Lighthouse performance audit; Chrome DevTools network timing |
| 3D frame rate | Sustained 60 fps on mid-range hardware | Chrome DevTools Performance panel; requestAnimationFrame timing |
| Build success | Zero TypeScript errors, zero build warnings | `npm run build` exit code 0 |
| Unit test pass rate | 100% pass for OEM parser and interpolator tests | `npm run test` via Vitest |
| Chatbot accuracy | Zero hallucinated mission facts in manual testing (10 questions) | Manual test: ask 10 factual questions, verify answers against NASA sources |
| Deployment uptime | Available throughout remaining mission duration (~7 days) | Vercel status dashboard; manual spot checks |
| Bundle size | < 500 KB gzipped (JS only, excluding textures) | Vite build output; `gzip -k` on dist assets |

---

## 8. Constraints

| Constraint | Detail |
|---|---|
| Time | The Artemis II mission launched April 1, 2026 and has approximately 7 days remaining. The tracker must ship within 1-2 days to be relevant for live tracking. |
| Budget | $0 total. All hosting, APIs, and services must use free tiers. No paid subscriptions, no credit card required. |
| Team | Solo developer. No separate design, QA, or DevOps support. |
| Mission-duration relevance | The tracker's primary value is during the active mission. After splashdown (~April 10-11), the tool becomes an archive/replay rather than a live tracker. |
| No unified NASA API | NASA does not provide a single real-time telemetry endpoint. Data must be assembled from OEM files (trajectory), DSN XML (communications), Horizons (ephemeris), and DONKI (space weather). |
| Cislunar trajectory limitations | Standard TLE/SGP4 satellite tracking does not work beyond Earth orbit. OEM-based interpolation with multi-body-aware data is required for accurate cislunar positioning. |
| Texture licensing | Only NASA public domain imagery (Blue Marble, CGI Moon Kit) may be used. No licensed or copyrighted textures. |
| API key security | LLM API keys must never appear in client-side bundles. All LLM requests must proxy through serverless functions. |

---

## 9. Dependencies

### External Data Sources

| Dependency | Endpoint | Auth Required | Refresh Rate | Criticality |
|---|---|---|---|---|
| AROW OEM files | https://www.nasa.gov/trackartemis (downloadable) | None | Periodic (file updates) | Critical -- primary trajectory source |
| DSN Now XML | https://eyes.nasa.gov/apps/dsn-now/dsn.xml | None | 5-second intervals | Medium -- communications status and range cross-validation |
| JPL Horizons API | https://ssd.jpl.nasa.gov/api/horizons.api | None | On-demand | Medium -- Moon positioning and trajectory validation |
| DONKI Space Weather | https://api.nasa.gov/DONKI/ | DEMO_KEY or registered key | On-demand | Low -- supplementary space weather context |

### External Services

| Dependency | Purpose | Tier | Criticality |
|---|---|---|---|
| Vercel | Static hosting + serverless API functions | Free | Critical -- hosting and CORS proxy layer |
| Google Gemini 2.5 Flash | LLM backend for chatbot free-text questions | Free (15 RPM, 1,000 RPD) | Medium -- chatbot degrades to quick-answer-only mode without it |

### Technology Stack

| Dependency | Version | Purpose |
|---|---|---|
| Vite | 6.x | Build tooling and dev server |
| React | 19.x | UI framework |
| TypeScript | 5.x | Type safety |
| Three.js | r170+ | WebGL 3D rendering |
| @react-three/fiber | 9.x | React-Three.js integration |
| @react-three/drei | 9.x | 3D helpers (OrbitControls, Html, effects) |
| @react-three/postprocessing | 3.x | Bloom and glow effects (Post-MVP) |
| Framer Motion | 12.x | HUD animation and counter transitions |
| Zustand | 5.x | Lightweight state management |
| Tailwind CSS | 4.x | Styling |

---

## 10. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| OEM file URL changes or becomes unavailable | Medium | High | Cache last-known-good OEM data in /public as fallback; try multiple known URLs |
| Incorrect data displayed (repeating community tracker failures) | Medium | High | Unit test parser and interpolator; cross-validate OEM interpolation vs DSN range; compare against AROW before public announcement |
| Mission ends before tracker is ready | Medium | High | Focus exclusively on MVP features; defer all post-MVP work until core is deployed |
| DSN feed does not list Artemis II spacecraft target | Low | Medium | Graceful degradation to "No DSN contact" state; DSN is supplementary, not critical |
| CORS proxy rate-limited by NASA endpoints | Low | Medium | Cache responses in Vercel edge with appropriate TTLs (OEM: 5 min, DSN: 30 sec) |
| Lagrange interpolation diverges near trajectory boundaries | Low | Medium | Clamp interpolation to available epoch range; show "No data" outside range |
| Large textures slow initial load | Medium | Low | Use 2K (not 8K) textures; compress with WebP/JPEG optimization; show loading screen |
| WebGL not supported on user device | Low | Medium | Detect WebGL2 support on load; show descriptive fallback message |
| JPL Horizons returns unexpected format | Low | Medium | Parse defensively with error handling; fall back to hardcoded mean Moon distance (384,400 km) |
| Gemini API free tier rate-limited during traffic spikes | Low | Low | Quick-answer buttons handle most common questions client-side without API call; show "Please try again" on 429 responses |
| Chatbot hallucinates mission facts | Medium | Medium | System prompt instructs model to answer only from provided facts; refuse speculation; respond "I don't have that information" for unknowns |
| Gemini API key exposed in client-side bundle | Low | High | All chat requests proxied through /api/chat serverless function; API key stored exclusively in environment variables |

---

## Appendix A: Related Documents

- **Finding**: `docs/findings/2026-04-03_1054_artemis_ii_live_visualization.md`
- **Design Analysis**: `docs/design/2026-04-03_1100_artemis_ii_interactive_visualization.md`
- **Chatbot Research**: `docs/research/2026-04-03_1230_artemis_ii_chatbot_approaches.md`
- **Implementation Blueprint**: `docs/blueprints/2026-04-03_1117_artemis_ii_interactive_visualization.md`

## Appendix B: Key Reference Sources

- NASA Track Artemis II: https://www.nasa.gov/trackartemis
- NASA DSN Now: https://eyes.nasa.gov/apps/dsn-now/
- JPL Horizons API: https://ssd-api.jpl.nasa.gov/doc/horizons.html
- NASA Open APIs (DONKI): https://api.nasa.gov/
- Gemini API Pricing: https://ai.google.dev/gemini-api/docs/pricing
- HN Discussion on Tracker Accuracy: https://news.ycombinator.com/item?id=47621438
