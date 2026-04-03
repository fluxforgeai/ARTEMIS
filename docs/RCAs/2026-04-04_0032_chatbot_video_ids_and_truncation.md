# Root Cause Analysis: Broken Video IDs + Truncated Text Responses (F8, F9)

**Date**: 2026-04-04
**Severity**: Medium (both)
**Status**: Identified
**Findings**: F8, F9 in `docs/findings/2026-04-03_2140_chatbot_security_quality_FINDINGS_TRACKER.md`

## Problem Statement

Two live chatbot defects: (1) every video intent shows "Video unavailable" in the YouTube embed, (2) text responses are truncated mid-sentence.

## Symptoms

- F8: YouTube iframe renders but displays "Video unavailable — This video is unavailable" for all video requests
- F9: AI responses cut off mid-sentence: "incredible progress on their", "Here are the"

## Root Cause

**F8**: The `CURATED_VIDEOS` array in `api/chat.ts:25-33` uses two video IDs (`nB1PWhXmqFk`, `dOxDfn2re0o`) that are not valid YouTube videos. Verified via YouTube oembed API — both return errors. These were placeholder IDs from Session 2 that were never replaced.

**F9**: `api/chat.ts:121` sets `generationConfig.maxOutputTokens: 500`. This is insufficient for conversational responses. Gemini truncates output at the token limit, producing incomplete sentences.

## Evidence

**F8** — oembed verification:
```bash
$ curl -s "https://www.youtube.com/oembed?url=...&v=nB1PWhXmqFk" → UNAVAILABLE
$ curl -s "https://www.youtube.com/oembed?url=...&v=dOxDfn2re0o" → UNAVAILABLE
```

**F9** — code at api/chat.ts:121:
```typescript
generationConfig: { temperature: 0.7, maxOutputTokens: 500, topP: 0.9 },
```

## Resolution

### F8: Replace all video IDs with verified NASA YouTube videos

Verified via oembed API on 2026-04-04:

| Keywords | Old ID | New ID | New Title |
|----------|--------|--------|-----------|
| launch, liftoff, takeoff, sls | nB1PWhXmqFk | _eeZQw9PBc0 | Artemis II Launches Astronauts to the Moon (Official NASA Recap) |
| tli, translunar, injection, burn | nB1PWhXmqFk | Ke6XX8FHOHM | Artemis II to the Moon: Launch to Splashdown (NASA Mission Animation) |
| crew, astronaut, wiseman, glover, koch, hansen | dOxDfn2re0o | lPyl6d2FJGw | Artemis II: Meet the Astronauts Who will Fly Around the Moon |
| moon, lunar, flyby | nB1PWhXmqFk | 6RwfNBtepa4 | NASA's Artemis II Live Views from Orion |
| orion, spacecraft | dOxDfn2re0o | 0uWzj4AiiZ8 | Artemis II Astronauts' First Look at Their Lunar Spacecraft |
| splashdown, return, reentry | nB1PWhXmqFk | Vg-EQ7MOu6I | Around the Moon for All Humanity: Artemis II (Official Launch Trailer) |
| artemis, program, overview, mission | nB1PWhXmqFk | 7XzhtWcepos | Artemis II: Mission Overview |

### F9: Increase maxOutputTokens

Change `maxOutputTokens: 500` to `maxOutputTokens: 1024` at `api/chat.ts:121`.

## Debug Strategy

- **Self-debug**: enabled
- **Verifier**: `npm run build && npm run test -- --run`
- **Max iterations**: 2
- **Completion criteria**: Build passes, all tests pass, no placeholder video IDs remain
- **Invoke with**: `/wrought-rca-fix`
