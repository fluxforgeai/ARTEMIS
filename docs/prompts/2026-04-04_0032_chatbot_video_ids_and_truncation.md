# Implementation Prompt: Fix Broken Video IDs + Text Truncation (F8, F9)

**RCA Reference**: docs/RCAs/2026-04-04_0032_chatbot_video_ids_and_truncation.md

## Context

Two live chatbot defects: placeholder YouTube video IDs and insufficient maxOutputTokens causing mid-sentence truncation.

## Goal

Fix both defects in a single batch.

## Requirements

1. **F8**: Replace all 7 CURATED_VIDEOS entries with verified NASA YouTube video IDs and updated titles
2. **F9**: Increase `maxOutputTokens` from 500 to 1024

## Files Likely Affected

- `api/chat.ts` — CURATED_VIDEOS array (lines 25-33) and generationConfig (line 121)

## Acceptance Criteria

- [ ] No placeholder video IDs (`nB1PWhXmqFk`, `dOxDfn2re0o`) remain in the codebase
- [ ] All 7 video entries use verified NASA YouTube IDs
- [ ] `maxOutputTokens` is 1024
- [ ] Build passes, all tests pass

---

## Plan Output Instructions

1. Call `EnterPlanMode`
2. Write plan to `docs/plans/2026-04-04_0032_chatbot_video_ids_and_truncation.md`
3. Call `ExitPlanMode`
4. After approval, invoke `/wrought-rca-fix`
