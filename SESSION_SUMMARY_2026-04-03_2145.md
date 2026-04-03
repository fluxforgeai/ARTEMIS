# Session 2 Summary

**Date**: 2026-04-03
**Duration**: ~3 hours (18:48 - 21:45 UTC)
**Session**: 2

---

## Accomplished

### Data Pipeline
1. **F1 Verified** — Live deployment telemetry matches NASA OEM data within 0.003% and ABC News AROW cross-check within 3.4%
2. **F2 Fixed + Verified** — OEM API 502 caused by ZIP parser data descriptor bug (bit 3 flag). Added central directory fallback. Deployed and confirmed 200.
3. **F3 Resolved** — Added dynamic OEM URL discovery (`discoverLatestOemUrl()`). Probes NASA URL pattern for last 7 days. Updated fallback to post-TLI data.

### Camera System
4. **Camera F1 Resolved** — Rewrote all 4 presets with scene-aware strategies: velocity-aligned chase cam, Earth-centric tracking, orbital-normal Moon view
5. **Camera F2 Resolved** — Fixed 3 visual bugs: replaced drei `<Html>` with direct DOM for debug overlay, added camera `up` vector for horizontal trajectory, all presets use full bounding box distance

### Visual Polish
6. Earth: doubled radius, lighter blue emissive, brighter atmosphere
7. Moon: brighter white emissive
8. Chat: markdown rendering for AI responses

### Chatbot
9. **DateTime fix** — System prompt now injects current UTC, MET, mission phase, user timezone
10. **Multimodal chatbot** — Added 4 content sources (Gemini Image, NASA Photos, Recharts, YouTube). Keyword intent detection. Structured `{ parts: ChatPart[] }` response format.

### Documentation
11. README: linked Wrought references to https://wrought-web.vercel.app

---

## Issues Encountered

1. **OEM API 502**: Initially misdiagnosed as Vercel network/WAF issue. Investigation proved it was a ZIP parser bug (data descriptor flag).
2. **Camera vertical orientation**: Orbital plane normal made trajectory vertical on landscape screens. Fixed with camera `up` vector computation.
3. **Debug overlay unreliable**: drei's `<Html fullscreen>` component blocked clicks and didn't render consistently across camera modes. Replaced with direct DOM manipulation.
4. **Chatbot thought mission hadn't launched**: System prompt had no current date/time context. Fixed with dynamic injection.
5. **XSS in chat**: `dangerouslySetInnerHTML` on AI responses without sanitization. Logged as Critical — deferred to Session 3.
6. **Recharts TypeScript**: Tooltip formatter type mismatch on first build. Fixed with `Number()` cast.

---

## Decisions Made

1. **URL pattern probing over HTML scraping** for OEM discovery — more reliable, no DOM parsing fragility
2. **Direct DOM manipulation over drei `<Html>`** for debug overlay — avoids R3F lifecycle issues
3. **Scene-aware presets over fixed offsets** — each preset shows full trajectory from different angle using bounding box distance
4. **Hybrid multi-source over single-source** for multimodal chatbot — Gemini Image + NASA API + Recharts + YouTube
5. **Keyword-based over LLM-based** intent detection — instant, no API cost, handles 90% of cases
6. **DOMPurify over custom sanitization** for XSS fix — industry standard, well-maintained (deferred to Session 3)

---

## Metrics

| Metric | Value |
|--------|-------|
| Commits | 8 |
| Lines added | ~3,500 |
| Lines removed | ~250 |
| New files | ~20 |
| Tests | 15/15 passing |
| Findings created | 15 (across 4 trackers) |
| Findings resolved | 10 |
| Findings verified | 3 |
| Forge reviews | 3 |
| Deployments | 8 (all successful) |
| Critical findings open | 1 (XSS — F1 in Security Tracker) |

---

## Active Trackers

| Tracker | Findings | Open | Resolved | Verified |
|---------|----------|------|----------|----------|
| Viz (OEM/data) | F1-F3 | 0 | 1 (F3) | 2 (F1, F2) |
| Camera (UX) | F1-F2 | 0 | 2 | 0 |
| Multimodal (chatbot) | F1 | 0 | 1 | 0 |
| **Security (chatbot)** | **F1-F6** | **6** | **0** | **0** |

---

## Handoff to Session 3

**Priority 1**: Fix Critical XSS (F1) + batch F2-F6 security fixes. RCA is done, prompt is ready at `docs/prompts/2026-04-03_2143_chatbot_xss_security.md`. Run `/plan` then `/wrought-rca-fix`.
