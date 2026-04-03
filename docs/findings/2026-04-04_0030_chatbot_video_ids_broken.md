# Finding: Broken YouTube Video IDs in Curated Videos

**Date**: 2026-04-04
**Found by**: Visual verification on live deployment
**Classification**: Defect | Medium

## What Was Found

All curated YouTube video IDs in `api/chat.ts:25-33` are unavailable. The YouTube embed renders correctly but shows "Video unavailable" for every video intent request.

- `nB1PWhXmqFk` — used in 5 of 7 entries (launch, TLI, lunar flyby, splashdown, overview): **UNAVAILABLE**
- `dOxDfn2re0o` — used in 2 of 7 entries (crew, Orion spacecraft): **UNAVAILABLE**

Verified via YouTube oembed API: both IDs return HTTP errors.

## Evidence

Screenshot from live deployment showing "Video unavailable - This video is unavailable" in the YouTube iframe embed after requesting "Show me a video of the launch".

## Scope

All 7 curated video entries in `CURATED_VIDEOS` array at `api/chat.ts:25-33`.

## Preliminary Assessment

- **Likely cause**: Placeholder video IDs were used during Session 2 implementation and were never replaced with real YouTube video IDs
- **Impact**: Every video intent request shows a broken embed
- **Affected components**: `api/chat.ts` (CURATED_VIDEOS data)

## Verified Working NASA Artemis II Video IDs

Found via NASA YouTube channel search and verified via oembed API:

| Video ID | Title | Best for |
|----------|-------|----------|
| `_eeZQw9PBc0` | Artemis II Launches Astronauts to the Moon (Official NASA Recap) | launch, liftoff |
| `Ke6XX8FHOHM` | Artemis II to the Moon: Launch to Splashdown (NASA Mission Animation) | TLI, mission overview |
| `lPyl6d2FJGw` | Artemis II: Meet the Astronauts Who will Fly Around the Moon (Official NASA Video) | crew, astronauts |
| `7XzhtWcepos` | Artemis II: Mission Overview | overview, artemis program |
| `0uWzj4AiiZ8` | Artemis II Astronauts' First Look at Their Lunar Spacecraft | orion, spacecraft |
| `6RwfNBtepa4` | NASA's Artemis II Live Views from Orion | moon, lunar, flyby |
| `Vg-EQ7MOu6I` | Around the Moon for All Humanity: Artemis II (Official Launch Trailer) | splashdown, return |
