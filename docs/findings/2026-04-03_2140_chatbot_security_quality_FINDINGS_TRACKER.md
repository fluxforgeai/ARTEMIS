**2026-04-03 21:40 UTC**

# Chatbot Security & Quality -- Findings Tracker

**Created**: 2026-04-03 21:40 UTC
**Last Updated**: 2026-04-10 12:45 UTC
**Origin**: `/forge-review --scope=diff` of multimodal chatbot implementation
**Session**: 2
**Scope**: Security vulnerabilities and quality issues in the chatbot pipeline (api/chat.ts, ChatMessage.tsx, ChatVideo.tsx)

---

## Overview

Tracking security and quality remediation for the multimodal chatbot, sourced from forge-review report `docs/reviews/2026-04-03_2137_diff.md`.

| # | Finding | Type | Severity | Status | Stage | Report |
|---|---------|------|----------|--------|-------|--------|
| F1 | XSS via dangerouslySetInnerHTML on AI responses | Vulnerability | **Critical** | Verified | Verified | [Report](2026-04-03_2140_chatbot_security_quality.md) |
| F2 | API key in URL query parameter | Defect | **Medium** | Verified | Verified | [Report](2026-04-03_2140_chatbot_security_quality.md) |
| F3 | No input validation on messages array | Defect | **Medium** | Verified | Verified | [Report](2026-04-03_2140_chatbot_security_quality.md) |
| F4 | Duplicated and drifting video data | Defect | **Medium** | Verified | Verified | [Report](2026-04-03_2140_chatbot_security_quality.md) |
| F5 | ChatPart type divergence server/client | Defect | **Medium** | Verified | Verified | [Report](2026-04-03_2140_chatbot_security_quality.md) |
| F6 | Unsanitized videoId in iframe src | Defect | **Medium** | Verified | Verified | [Report](2026-04-03_2140_chatbot_security_quality.md) |
| F7 | Message sanitization filter runs over unbounded input before slice | Defect | **Medium** | Verified | Verified | [Report](../reviews/2026-04-04_0004_diff.md) |
| F8 | Curated YouTube video IDs are unavailable — "Video unavailable" on every video request | Defect | **Medium** | Verified | Verified | [Report](2026-04-04_0030_chatbot_video_ids_broken.md) |
| F9 | Text responses truncated mid-sentence — maxOutputTokens too low | Defect | **Medium** | Verified | Verified | [Report](2026-04-04_0030_chatbot_text_truncation.md) |
| F10 | Image intent routes general requests to failing Gemini instead of NASA search | Defect | **Medium** | Verified | Verified | [Report](2026-04-04_0045_chatbot_image_intent_mismatch.md) |
| F11 | Chatbot provides limited information — stale system prompt, wrong phase boundaries, no web search | Gap | **Medium** | Resolved | Resolved | [Investigation](../investigations/2026-04-06_1430_chatbot_llm_model_upgrade.md) |
| F12 | No fetch timeout on external API calls | Gap | **Medium** | Resolved | Resolved | [Report](2026-04-06_1656_fetch_timeout_missing.md) |
| F13 | Search grounding response discarded -- no citations, no sources, quick answer over-matching | Defect | **High** | Resolved | Resolved | [Investigation](../investigations/2026-04-06_1800_chatbot_web_search_upgrade.md) |
| F14 | Chatbot intermittent API failure — Gemini 500s with no retry, generic error UX | Defect | **High** | Resolved | Resolved | [RCA](../RCAs/2026-04-10_1225_chatbot_intermittent_api_failure.md) |
| F15 | Cumulative 31s worst-case latency across retry chain | Debt | **Medium** | Resolved | Resolved | [RCA](../RCAs/2026-04-10_1300_retry_chain_cumulative_latency.md) |

**Status legend**: `Open` -> `In Progress` -> `Resolved` -> `Verified`
**Stage legend**: `Open` -> `Investigating` / `Designing` -> `RCA Complete` / `Blueprint Ready` -> `Planned` -> `Implementing` -> `Reviewed` -> `Resolved` -> `Verified`

---

## Dependency Map

```
F1 (XSS) is CRITICAL — fix first
F2-F6 are independent Medium defects, can be fixed in any order
F4 (video data drift) and F5 (type divergence) share the same root cause (api/ cannot import from src/)
F7 is independent of F1-F6; relates to input validation path in F3's vicinity
F11 (limited info) depends on F9 (maxOutputTokens was 500→1024, now going to 2048)
F12 (fetch timeout) is independent of all other findings; affects same file (api/chat.ts) as F2, F3, F7, F11
```

---

## F1: XSS via dangerouslySetInnerHTML (Critical Vulnerability)

**Summary**: `ChatMessage.tsx` injects Gemini API response text as raw HTML via `dangerouslySetInnerHTML` without sanitization. `renderMarkdown()` preserves any HTML in the input. XSS payloads in AI responses execute in the user's browser.

**Root cause**: `renderMarkdown()` uses regex substitution to convert markdown to HTML but performs no sanitization or escaping of non-markdown HTML.

**Resolution tasks**:

- [x] **F1.1**: RCA + fix — add DOMPurify sanitization (-> /rca-bugfix -> Stage: RCA Complete)
- [x] **F1.2**: Implementation plan (-> /plan -> Stage: Planned)
- [x] **F1.3**: Implement fix (Stage: Implementing -> Resolved)
- [x] **F1.4**: Code review (-> /forge-review -> Stage: Reviewed)
- [x] **F1.5**: Verify fix (Stage: Verified)

**Recommended approach**: `/rca-bugfix` — root cause is clear: add `DOMPurify.sanitize()` around `renderMarkdown()` output at both injection points.

**Status**: Verified
**Stage**: Verified
**Resolved in session**: 3
**Verified in session**: 3
**Notes**: CRITICAL — fix before next session. Also fix structurally invalid `<li>` without `<ul>`/`<ol>` wrappers.
**GitHub Issue**: --
**Project Item ID**: --

**Lifecycle**:
| Stage | Timestamp | Session | Artifact |
|-------|-----------|---------|----------|
| Open | 2026-04-03 21:40 UTC | 2 | [Finding Report](2026-04-03_2140_chatbot_security_quality.md) |

---

## F2: API Key in URL Query Parameter (Medium Defect)

**Summary**: `api/chat.ts:123,143` passes `GEMINI_API_KEY` as `?key=` URL parameter. Query parameters appear in logs and error traces.

**Root cause**: Follows Gemini docs pattern; header-based auth (`x-goog-api-key`) not used.

**Resolution tasks**:

- [x] **F2.1**: RCA + fix (-> /rca-bugfix -> Stage: RCA Complete)
- [x] **F2.2**: Implement fix (Stage: Implementing -> Resolved)
- [x] **F2.3**: Verify fix (Stage: Verified)

**Recommended approach**: `/rca-bugfix` — switch to `x-goog-api-key` header.

**Status**: Verified
**Stage**: Verified
**Resolved in session**: 3
**Verified in session**: 3
**GitHub Issue**: --
**Project Item ID**: --

**Lifecycle**:
| Stage | Timestamp | Session | Artifact |
|-------|-----------|---------|----------|
| Open | 2026-04-03 21:40 UTC | 2 | [Finding Report](2026-04-03_2140_chatbot_security_quality.md) |

---

## F3: No Input Validation on Messages Array (Medium Defect)

**Summary**: `api/chat.ts:215-221` — `messages` array forwarded to Gemini without validation on count, text length, or payload size.

**Root cause**: No input validation added during MVP implementation.

**Resolution tasks**:

- [x] **F3.1**: RCA + fix (-> /rca-bugfix -> Stage: RCA Complete)
- [x] **F3.2**: Implement fix (Stage: Implementing -> Resolved)
- [x] **F3.3**: Verify fix (Stage: Verified)

**Recommended approach**: `/rca-bugfix` — add message count cap (20), text length cap (2000 chars).

**Status**: Verified
**Stage**: Verified
**Resolved in session**: 3
**Verified in session**: 3
**GitHub Issue**: --
**Project Item ID**: --

**Lifecycle**:
| Stage | Timestamp | Session | Artifact |
|-------|-----------|---------|----------|
| Open | 2026-04-03 21:40 UTC | 2 | [Finding Report](2026-04-03_2140_chatbot_security_quality.md) |

---

## F4: Duplicated and Drifting Video Data (Medium Defect)

**Summary**: `CURATED_VIDEOS` in `api/chat.ts` (7 entries) duplicates `ARTEMIS_VIDEOS` in `src/data/artemis-videos.ts` (10 entries) with different titles and entry counts.

**Root cause**: Vercel serverless cannot import from `src/`, so data was duplicated.

**Resolution tasks**:

- [x] **F4.1**: RCA + fix (-> /rca-bugfix -> Stage: RCA Complete)
- [x] **F4.2**: Implement fix (Stage: Implementing -> Resolved)
- [x] **F4.3**: Verify fix (Stage: Verified)

**Recommended approach**: `/rca-bugfix` — consolidate: move video intent detection to client-side, or use a shared JSON file.

**Status**: Verified
**Stage**: Verified
**Resolved in session**: 3
**Verified in session**: 3
**GitHub Issue**: --
**Project Item ID**: --

**Lifecycle**:
| Stage | Timestamp | Session | Artifact |
|-------|-----------|---------|----------|
| Open | 2026-04-03 21:40 UTC | 2 | [Finding Report](2026-04-03_2140_chatbot_security_quality.md) |

---

## F5: ChatPart Type Divergence Server/Client (Medium Defect)

**Summary**: Server-side `ChatPart` in `api/chat.ts:106` uses `[key: string]: unknown` index signature. Client-side in `src/hooks/useChat.ts:4-9` uses a proper discriminated union. Independent definitions can drift.

**Root cause**: Same Vercel `api/` cannot import from `src/` constraint.

**Resolution tasks**:

- [x] **F5.1**: RCA + fix (-> /rca-bugfix -> Stage: RCA Complete)
- [x] **F5.2**: Implement fix (Stage: Implementing -> Resolved)
- [x] **F5.3**: Verify fix (Stage: Verified)

**Recommended approach**: `/rca-bugfix` — tighten server-side interface with explicit fields per variant.

**Status**: Verified
**Stage**: Verified
**Resolved in session**: 3
**Verified in session**: 3
**GitHub Issue**: --
**Project Item ID**: --

**Lifecycle**:
| Stage | Timestamp | Session | Artifact |
|-------|-----------|---------|----------|
| Open | 2026-04-03 21:40 UTC | 2 | [Finding Report](2026-04-03_2140_chatbot_security_quality.md) |

---

## F6: Unsanitized videoId in Iframe Src (Medium Defect)

**Summary**: `ChatVideo.tsx:12` — `part.videoId` interpolated directly into iframe `src` URL without validation.

**Root cause**: No input validation on videoId before rendering.

**Resolution tasks**:

- [x] **F6.1**: RCA + fix (-> /rca-bugfix -> Stage: RCA Complete)
- [x] **F6.2**: Implement fix (Stage: Implementing -> Resolved)
- [x] **F6.3**: Verify fix (Stage: Verified)

**Recommended approach**: `/rca-bugfix` — validate videoId matches `/^[a-zA-Z0-9_-]{11}$/`.

**Status**: Verified
**Stage**: Verified
**Resolved in session**: 3
**Verified in session**: 3
**GitHub Issue**: --
**Project Item ID**: --

**Lifecycle**:
| Stage | Timestamp | Session | Artifact |
|-------|-----------|---------|----------|
| Open | 2026-04-03 21:40 UTC | 2 | [Finding Report](2026-04-03_2140_chatbot_security_quality.md) |

---

## F7: Message Sanitization Filter Runs Over Unbounded Input Before Slice (Medium Defect)

**Summary**: `api/chat.ts:226-229` — the `.filter().slice(-20).map()` chain runs `.filter()` over the entire unbounded input `messages` array before `.slice(-20)` truncates it. An attacker could send thousands of messages to force unnecessary iteration.

**Root cause**: `.filter()` is applied before `.slice(-20)`, meaning the full unbounded array is iterated even though only the last 20 messages are used.

**Resolution tasks**:

- [x] **F7.1**: RCA + fix — reorder to `messages.slice(-20).filter(...).map(...)` to bound iteration upfront (-> /rca-bugfix -> Stage: RCA Complete)
- [x] **F7.2**: Implement fix (Stage: Implementing -> Resolved)
- [x] **F7.3**: Verify fix (Stage: Verified)

**Recommended approach**: `/rca-bugfix` — reorder to `messages.slice(-20).filter(...).map(...)` to bound iteration upfront.

**Status**: Verified
**Stage**: Verified
**Resolved in session**: 3
**Verified in session**: 3
**Notes**: Sourced from `/forge-review` report W1. Related to F3 (input validation) but affects a different code path.
**GitHub Issue**: --
**Project Item ID**: --

**Lifecycle**:
| Stage | Timestamp | Session | Artifact |
|-------|-----------|---------|----------|
| Open | 2026-04-04 00:04 UTC | 3 | [Forge-review W1](../reviews/2026-04-04_0004_diff.md) |
| Resolved | 2026-04-04 00:07 UTC | 3 | [RCA](../RCAs/2026-04-04_0006_unbounded_filter_iteration.md) — reordered `.slice(-20)` before `.filter()`. Build passes, 15/15 tests pass. |

---

## F8: Curated YouTube Video IDs Are Unavailable (Medium Defect)

**Summary**: All 7 curated video entries in `api/chat.ts:25-33` use YouTube video IDs (`nB1PWhXmqFk`, `dOxDfn2re0o`) that return "Video unavailable". Every video intent shows a broken embed.

**Root cause**: Placeholder video IDs were used during Session 2 implementation and never replaced with real NASA YouTube video IDs.

**Resolution tasks**:

- [x] **F8.1**: RCA + fix — replace all 7 video IDs with verified working NASA YouTube IDs (-> /rca-bugfix -> Stage: RCA Complete)
- [x] **F8.2**: Implement fix (Stage: Implementing -> Resolved)
- [x] **F8.3**: Verify fix (Stage: Verified)

**Recommended approach**: `/rca-bugfix` — root cause is clear, verified replacement IDs documented in finding report.

**Status**: Verified
**Stage**: Verified
**Resolved in session**: 3
**Verified in session**: 3
**GitHub Issue**: --
**Project Item ID**: --

**Lifecycle**:
| Stage | Timestamp | Session | Artifact |
|-------|-----------|---------|----------|
| Open | 2026-04-04 00:30 UTC | 3 | [Finding Report](2026-04-04_0030_chatbot_video_ids_broken.md) |
| Resolved | 2026-04-04 00:35 UTC | 3 | Replaced all 7 video IDs with verified NASA YouTube videos |
| Verified | 2026-04-04 00:40 UTC | 3 | Live deployment verified |

---

## F9: Text Responses Truncated Mid-Sentence (Medium Defect)

**Summary**: AI text responses cut off mid-sentence on live deployment. `api/chat.ts:121` sets `maxOutputTokens: 500` which is insufficient for conversational responses.

**Root cause**: Token limit set too low during MVP implementation. 500 tokens results in incomplete responses.

**Resolution tasks**:

- [x] **F9.1**: RCA + fix — increase maxOutputTokens to 1024 (-> /rca-bugfix -> Stage: RCA Complete)
- [x] **F9.2**: Implement fix (Stage: Implementing -> Resolved)
- [x] **F9.3**: Verify fix (Stage: Verified)

**Recommended approach**: `/rca-bugfix` — root cause is clear, single-line fix.

**Status**: Verified
**Stage**: Verified
**Resolved in session**: 3
**Verified in session**: 3
**GitHub Issue**: --
**Project Item ID**: --

**Lifecycle**:
| Stage | Timestamp | Session | Artifact |
|-------|-----------|---------|----------|
| Open | 2026-04-04 00:30 UTC | 3 | [Finding Report](2026-04-04_0030_chatbot_text_truncation.md) |
| Resolved | 2026-04-04 00:35 UTC | 3 | maxOutputTokens increased from 500 to 1024 |
| Verified | 2026-04-04 00:40 UTC | 3 | Live deployment verified — text responses complete |

---

## F10: Image Intent Routes General Requests to Failing Gemini Instead of NASA Search (Medium Defect)

**Summary**: `NASA_IMAGE_RE` is too narrow and `IMAGE_RE` is too broad. General image requests like "show me the Moon" route to Gemini (which fails) instead of NASA Image search. Only explicitly photographic language triggers NASA search.

**Root cause**: `NASA_IMAGE_RE` only matches photographic terms. `IMAGE_RE` matches generative terms like "draw" and "create" but also catches broad visual requests. The `detectIntent()` function checks `IMAGE_RE` before `NASA_IMAGE_RE`, routing ambiguous requests to the failing Gemini path.

**Resolution tasks**:

- [x] **F10.1**: RCA + fix — reorder intent detection and broaden NASA_IMAGE_RE to catch visual requests (-> /rca-bugfix -> Stage: RCA Complete)
- [x] **F10.2**: Implement fix (Stage: Implementing -> Resolved)
- [x] **F10.3**: Verify fix (Stage: Verified)

**Status**: Verified
**Stage**: Verified
**Resolved in session**: 3
**Verified in session**: 3
**GitHub Issue**: --
**Project Item ID**: --

**Lifecycle**:
| Stage | Timestamp | Session | Artifact |
|-------|-----------|---------|----------|
| Open | 2026-04-04 00:45 UTC | 3 | Live testing finding |
| Resolved | 2026-04-04 00:50 UTC | 3 | NASA_IMAGE_RE broadened, IMAGE_RE scoped to generative terms |
| Verified | 2026-04-04 00:50 UTC | 3 | Live deployment verified |

---

## F11: Chatbot Provides Limited Information — Stale System Prompt, Wrong Phase Boundaries, No Web Search (Medium Gap)

**Summary**: The ARTEMIS AI chatbot provides limited information quality. The `MISSION_FACTS` system prompt contains stale data ("approximately 10 days" vs actual 9.064 days), phase boundaries in `buildSystemPrompt()` don't match NASA-verified milestone timings, quick answers have the same errors, and there is no web search capability for real-time information. User proposed switching to OpenAI GPT-5.4-nano — investigation confirmed the limitation but determined GPT-5.4-nano is the wrong remedy ($0 budget violated, wrong model class, breaks multimodal pipeline).

**Root cause**: System prompt was written once in Session 1 with approximate values and never updated after NASA-verified timings were established in Session 6. Phase boundaries are hardcoded magic numbers. Quick answers duplicate the stale values. No web search capability.

**Resolution tasks**:

- [x] **F11.1**: Investigate — confirm limitation scope, evaluate GPT-5.4-nano proposal (-> /investigate -> Stage: Investigating)
- [x] **F11.2**: RCA + fix design — enrich system prompt, fix phases, add search grounding (-> /rca-bugfix -> Stage: RCA Complete)
- [x] **F11.3**: Implementation plan (-> /plan -> Stage: Planned)
- [x] **F11.4**: Implement fix (-> /wrought-rca-fix -> Stage: Implementing -> Resolved)
- [ ] **F11.5**: Code review (-> /forge-review -> Stage: Reviewed)

**Status**: Resolved
**Stage**: Resolved
**Resolved in session**: --
**Verified in session**: --
**Notes**: Investigation rejected GPT-5.4-nano (no free tier, wrong model class, breaks image gen). RCA recommends: (A) enrich system prompt with NASA-verified facts, (B) fix phase boundaries from mission-config.ts, (C) correct quick answers, (D) add Gemini Search Grounding, (E) increase maxOutputTokens to 2048.
**GitHub Issue**: --
**Project Item ID**: --

**Lifecycle**:
| Stage | Timestamp | Session | Artifact |
|-------|-----------|---------|----------|
| Open | 2026-04-06 14:30 UTC | 7 | [Investigation](../investigations/2026-04-06_1430_chatbot_llm_model_upgrade.md) |
| RCA Complete | 2026-04-06 16:13 UTC | 7 | [RCA](../RCAs/2026-04-06_1430_chatbot_limited_information.md), [Prompt](../prompts/2026-04-06_1430_chatbot_limited_information.md) |
| Planned | 2026-04-06 16:20 UTC | 7 | [Plan](../../.claude/plans/agile-rolling-zephyr.md) |
| Implementing | 2026-04-06 16:20 UTC | 7 | `/wrought-rca-fix` — 1 iteration, build passes |
| Resolved | 2026-04-06 16:25 UTC | 7 | All 5 fixes applied: phase boundaries, system prompt, maxOutputTokens, search grounding, quick answers |

---

## F12: No Fetch Timeout on External API Calls (Medium Gap)

**Summary**: Three external `fetch` calls in `api/chat.ts` (Gemini text L134, Gemini image L154, NASA Images L181) have no `AbortController` or timeout. If any upstream API hangs, the Vercel serverless function remains open consuming resources until platform timeout.

**Root cause**: Timeout handling was not included during MVP chatbot implementation. With Search Grounding now enabled (Session 7), there are 3 external dependencies that could hang.

**Resolution tasks**:

- [ ] **F12.1**: RCA + fix — add `AbortSignal.timeout(8000)` to all three fetch calls in `api/chat.ts` (-> /rca-bugfix -> Stage: RCA Complete)
- [ ] **F12.2**: Implement fix (Stage: Implementing -> Resolved)
- [ ] **F12.3**: Code review (-> /forge-review -> Stage: Reviewed)
- [ ] **F12.4**: Verify fix (Stage: Verified)

**Recommended approach**: `/rca-bugfix` — root cause is clear (missing timeout on all 3 fetch calls), fix is straightforward (`AbortSignal.timeout(8000)` on each call).

**Status**: Open
**Stage**: Open
**Resolved in session**: --
**Verified in session**: --
**Notes**: Pre-existing issue from Session 2. Flagged by `/forge-review` W1 in `docs/reviews/2026-04-06_1656_diff.md`. Becomes more relevant with Search Grounding adding latency and a third external dependency.
**GitHub Issue**: --
**Project Item ID**: --

**Lifecycle**:
| Stage | Timestamp | Session | Artifact |
|-------|-----------|---------|----------|
| Open | 2026-04-06 16:56 UTC | 7 | [Finding Report](2026-04-06_1656_fetch_timeout_missing.md) |

---

## F13: Search Grounding Response Discarded -- No Citations, No Sources, Quick Answer Over-Matching (High Defect)

**Summary**: The F11 fix added `tools: [{ google_search: {} }]` to the Gemini API request body but the response parser (`generateTextResponse()`) only reads `candidates[0].content.parts[0].text`, silently discarding all grounding metadata: `groundingChunks` (source URLs), `groundingSupports` (citation mappings), `searchEntryPoint` (required Google Search widget), and `webSearchQueries`. Additionally, there is no `sources` ChatPart type to render citations in the UI. The quick answer system's bidirectional `includes()` matching intercepts many questions that should go to the LLM. The net effect is a chatbot that CLAIMS to have web search but effectively cannot surface any search-grounded information to users.

**Root cause**: F11's implementation added the search grounding tool to the API request but did not modify the response parsing to handle the new response format. Same pattern as F8/F9: "added capability to request, forgot to parse the response." Additionally, `ChatPart` union has no `sources` variant and `ChatMessage` has no source renderer.

**Resolution tasks**:

- [x] **F13.1**: Investigate -- confirm scope, identify all defects (-> /investigate -> Stage: Investigating)
- [x] **F13.2**: RCA + fix design -- parse grounding metadata, add sources ChatPart, fix quick answer matching, upgrade system prompt (-> /rca-bugfix -> Stage: RCA Complete)
- [x] **F13.3**: Implementation plan (-> /plan -> Stage: Planned)
- [x] **F13.4**: Implement fix (-> /wrought-rca-fix -> Stage: Implementing -> Resolved)
- [ ] **F13.5**: Code review (-> /forge-review -> Stage: Reviewed)
- [ ] **F13.6**: Verify fix (Stage: Verified)

**Recommended approach**: `/rca-bugfix` -- root cause confirmed by investigation. Four changes needed: (1) parse grounding metadata in `generateTextResponse()`, (2) add `sources` ChatPart type + `ChatSources.tsx` renderer, (3) fix quick answer over-matching, (4) upgrade system prompt to leverage search.

**Status**: Resolved
**Stage**: Resolved
**Resolved in session**: --
**Verified in session**: --
**Notes**: User reported "this is NOT helpful at all!" after F11 fix. Investigation confirms F11 added search grounding to the request but never parsed the response. This is the same pattern as F8/F9 (Session 3). Four compounding defects identified.
**GitHub Issue**: --
**Project Item ID**: --

**Lifecycle**:
| Stage | Timestamp | Session | Artifact |
|-------|-----------|---------|----------|
| Open | 2026-04-06 18:00 UTC | 7 | User report -- chatbot still not helpful after F11 |
| Investigating | 2026-04-06 18:00 UTC | 7 | [Investigation](../investigations/2026-04-06_1800_chatbot_web_search_upgrade.md) |
| RCA Complete | 2026-04-06 18:30 UTC | 7 | [RCA](../RCAs/2026-04-06_1800_chatbot_web_search_upgrade.md), [Prompt](../prompts/2026-04-06_1800_chatbot_web_search_upgrade.md) |
| Planned | 2026-04-06 18:45 UTC | 7 | [Plan](../../.claude/plans/agile-rolling-zephyr.md) |
| Implementing | 2026-04-06 18:45 UTC | 7 | `/wrought-rca-fix` — 1 iteration, build passes |
| Resolved | 2026-04-06 18:50 UTC | 7 | All 7 tasks: grounding parser, sources ChatPart+renderer, prompt upgrade, quick answer fix |

---

## F14: Chatbot Intermittent API Failure — Gemini 500s with No Retry, Generic Error UX (High Defect)

**Summary**: The ARTEMIS AI chatbot intermittently returns "Sorry, I could not process your question right now" to users. The Gemini `gemini-3-flash-preview` API returns intermittent 500 errors (~33% observed failure rate). There is no retry logic in the API handler — a single failed request immediately returns an error. The client-side error message is generic and does not indicate the transient nature of the failure. This compounds with F12 (no fetch timeout, still Open).

**Root cause**: Three compounding issues: (1) Gemini preview model intermittent 500 errors, (2) no retry-with-backoff in `generateTextResponse()` for transient 500/503 errors, (3) generic client-side error message that does not encourage retry.

**Resolution tasks**:

- [x] **F14.1**: Investigate — confirm intermittent failure, determine scope and root cause (-> /investigate -> Stage: Investigating)
- [ ] **F14.2**: RCA + fix design — add retry logic, fetch timeout (F12), improve error UX (-> /rca-bugfix -> Stage: RCA Complete)
- [ ] **F14.3**: Implementation plan (-> /plan -> Stage: Planned)
- [ ] **F14.4**: Implement fix (-> /wrought-rca-fix -> Stage: Implementing -> Resolved)
- [ ] **F14.5**: Code review (-> /forge-review -> Stage: Reviewed)
- [ ] **F14.6**: Verify fix (Stage: Verified)

**Recommended approach**: `/rca-bugfix` — root cause confirmed: no retry logic on transient Gemini 500 errors. Fix: (1) add retry-once with 1s backoff on 500/503/429, (2) add AbortSignal.timeout(10000) to all fetch calls (incorporates F12), (3) improve client-side error message.

**Status**: In Progress
**Stage**: Investigating
**Resolved in session**: --
**Verified in session**: --
**Notes**: Observed during critical mission phase — 94.6% complete, ~11.7h before splashdown. User screenshot shows error on re-entry question. API test confirmed 1-in-3 failure rate. Incorporates F12 (fetch timeout).
**GitHub Issue**: --
**Project Item ID**: --

**Lifecycle**:
| Stage | Timestamp | Session | Artifact |
|-------|-----------|---------|----------|
| Open | 2026-04-10 12:25 UTC | 8 | User screenshot — chatbot error on re-entry question |
| Investigating | 2026-04-10 12:25 UTC | 8 | [Investigation](../investigations/2026-04-10_1225_chatbot_intermittent_api_failure.md) |

---

## F15: Cumulative 31s Worst-Case Latency Across Retry Chain (Medium Debt)

**Summary**: The retry chain in `generateTextResponse()` (`api/chat.ts:150-178`) performs up to 3 sequential HTTP requests (grounded + fallback + transient retry), each with a 10s `AbortSignal.timeout`, plus a 1s sleep. Worst case: 10s + 10s + 1s + 10s = 31s wall-clock before the serverless function responds. This exceeds Vercel Hobby plan's 10s default (fits within Pro plan's 60s). The client-side fetch in `useChat.ts:51` has no timeout.

**Root cause**: F14's retry logic added sequential retries with independent 10s timeouts. No shared time budget across the retry chain. Client-side fetch has no abort signal.

**Resolution tasks**:

- [ ] **F15.1**: RCA + fix — reduce per-request timeout to 5s (total worst-case ~16s), or add client-side `AbortSignal.timeout(20_000)` on fetch in `useChat.ts:51`, or use a shared `AbortController` with a single budget across all retries (-> /rca-bugfix -> Stage: RCA Complete)
- [ ] **F15.2**: Implement fix (Stage: Implementing -> Resolved)
- [ ] **F15.3**: Code review (-> /forge-review -> Stage: Reviewed)
- [ ] **F15.4**: Verify fix (Stage: Verified)

**Recommended approach**: `/rca-bugfix` — root cause is clear (cumulative timeout budget). Suggested: reduce per-request timeout to 5s (total worst-case ~16s), or add a shared `AbortController` with a single budget across all retries.

**Status**: In Progress
**Stage**: Investigating
**Resolved in session**: --
**Verified in session**: --
**Notes**: Sourced from `/forge-review --scope=diff` W1 for F14 retry implementation. Related to F12 (fetch timeout) and F14 (retry logic). The retry chain introduced in F14 compounds timeout risk. Investigation confirmed finding is real; also identified unbounded Retry-After parsing (429 path can reach 90s).
**GitHub Issue**: --
**Project Item ID**: --

**Lifecycle**:
| Stage | Timestamp | Session | Artifact |
|-------|-----------|---------|----------|
| Open | 2026-04-10 12:45 UTC | 8 | [Forge-review W1](../reviews/2026-04-10_1245_diff.md) |
| Investigating | 2026-04-10 13:00 UTC | 8 | [Investigation](../investigations/2026-04-10_1300_retry_chain_cumulative_latency.md) |

---

## Changelog

| Date | Session | Action |
|------|---------|--------|
| 2026-04-03 21:40 UTC | 2 | Created tracker. F1-F6 logged from forge-review. F1: Critical Vulnerability (XSS). F2-F6: Medium Defects. |
| 2026-04-04 00:02 UTC | 3 | F1-F6 all Resolved. /wrought-rca-fix completed in 1 iteration. F1: DOMPurify sanitization on both dangerouslySetInnerHTML. F2: API key moved to x-goog-api-key header. F3: Input validation (20 msg cap, 2000 char limit, role whitelist). F4: Deleted dead src/data/artemis-videos.ts. F5: Typed ChatPart union replacing loose interface. F6: videoId regex validation. Build passes, 15/15 tests pass. |
| 2026-04-04 00:04 UTC | 3 | F7 added from /forge-review W1: message sanitization filter runs over unbounded input before slice (api/chat.ts:226-229). Medium Defect, Open. |
| 2026-04-04 00:07 UTC | 3 | F7 -> Resolved. Reordered `.slice(-20)` before `.filter()` in sanitization chain. Build passes, 15/15 tests pass. |
| 2026-04-04 00:15 UTC | 3 | F1-F7 all Verified. Deployed to Vercel, DOMPurify confirmed in bundle (2 sanitize calls), API key header auth confirmed (chat API 200), all multimodal intents tested live. |
| 2026-04-04 00:30 UTC | 3 | F8-F9 added from live deployment verification. F8: Broken YouTube video IDs (Medium Defect). F9: Text response truncation (Medium Defect). |
| 2026-04-04 00:32 UTC | 3 | F8, F9 stage -> RCA Complete. Root causes confirmed: placeholder video IDs and maxOutputTokens: 500. RCA: docs/RCAs/2026-04-04_0032_chatbot_video_ids_and_truncation.md |
| 2026-04-04 00:35 UTC | 3 | F8, F9 -> Resolved. Replaced all 7 video IDs with verified NASA YouTube videos. maxOutputTokens increased to 1024. Build passes, 15/15 tests pass. |
| 2026-04-04 00:40 UTC | 3 | F8, F9 -> Verified. Deployed to Vercel. Video returns valid NASA video (_eeZQw9PBc0). Text response completes without truncation. |
| 2026-04-04 00:45 UTC | 3 | F10 added from live testing. Image intent mismatch: NASA_IMAGE_RE too narrow, IMAGE_RE too broad. RCA complete. |
| 2026-04-05 11:25 UTC | 6 | F8, F9 individual sections updated from Open → Verified (were resolved+verified in Session 3 per changelog, but individual sections never updated). F10 individual section added. |
| 2026-04-06 14:30 UTC | 7 | F11 added: chatbot limited information — stale system prompt, wrong phase boundaries, no web search. User proposed GPT-5.4-nano switch — investigation rejected (no free tier, wrong model class). |
| 2026-04-06 16:13 UTC | 7 | F11 stage -> RCA Complete. Root cause: stale MISSION_FACTS, hardcoded phase boundaries, no search grounding. Fix: enrich prompt with NASA-verified data, fix phases from mission-config.ts, add Gemini Search Grounding. RCA: docs/RCAs/2026-04-06_1430_chatbot_limited_information.md |
| 2026-04-06 16:25 UTC | 7 | F11 -> Resolved. /wrought-rca-fix completed in 1 iteration. All 5 fixes: phase boundaries (9 phases from milestones), MISSION_FACTS enriched (duration/flyby/trajectory/milestones/EVA/rules), maxOutputTokens 1024→2048, Gemini Search Grounding added, 4 quick answers corrected. Build passes. |
| 2026-04-06 16:56 UTC | 7 | F12 added from /forge-review W1: no fetch timeout on 3 external API calls in api/chat.ts (L134, L154, L181). Medium Gap, Open. |
| 2026-04-06 18:00 UTC | 7 | F13 added: Search grounding response silently discarded. High Defect. `generateTextResponse()` reads only `parts[0].text`, ignores all `groundingMetadata` (sources, citations, search widget). No `sources` ChatPart type exists. Quick answer over-matching intercepts LLM-bound queries. Same pattern as F8/F9. Investigation: docs/investigations/2026-04-06_1800_chatbot_web_search_upgrade.md |
| 2026-04-06 18:30 UTC | 7 | F13 stage -> RCA Complete. 4 root causes confirmed: (1) response parser discards groundingMetadata, (2) no sources ChatPart/renderer, (3) system prompt doesn't instruct search leverage, (4) quick answer over-matching. 6-requirement fix: parse grounding, add sources UI, upgrade prompt, fix matching. RCA: docs/RCAs/2026-04-06_1800_chatbot_web_search_upgrade.md |
| 2026-04-06 18:50 UTC | 7 | F13 -> Resolved. /wrought-rca-fix completed in 1 iteration. 7 tasks: (1) sources ChatPart client type, (2) ChatSources.tsx renderer, (3) ChatMessage.tsx wiring, (4) sources ChatPart server type, (5) grounding metadata parser (all text parts + groundingChunks), (6) system prompt RULES upgrade (search instructions, removed sentence limit), (7) quick answer unidirectional matching + 10-char threshold. Build passes, 1697 modules. |
| 2026-04-10 12:25 UTC | 8 | F14 added: Chatbot intermittent API failure. Gemini `gemini-3-flash-preview` returns 500 errors ~33% of requests. No retry logic. Generic error UX. User screenshot during Return Coast phase (94.6%). Incorporates F12 (fetch timeout). Investigation: docs/investigations/2026-04-10_1225_chatbot_intermittent_api_failure.md |
| 2026-04-10 12:45 UTC | 8 | F15 added from /forge-review W1 for F14: cumulative 31s worst-case latency across retry chain in `generateTextResponse()`. 3 sequential HTTP requests with 10s timeouts + 1s sleep = 31s. Exceeds Vercel Hobby 10s default. Client-side fetch in `useChat.ts:51` has no timeout. Medium Debt, Open. |

---

## Cross-References

| Document | Description |
|----------|-------------|
| docs/findings/2026-04-03_2140_chatbot_security_quality.md | F1-F6 finding report |
| docs/reviews/2026-04-03_2137_diff.md | Source forge-review (1C/5W/7S) |
| src/chat/ChatMessage.tsx | F1 (XSS) |
| api/chat.ts | F2, F3, F4, F5 |
| src/chat/ChatVideo.tsx | F6 |
| src/data/artemis-videos.ts | F4 |
| docs/reviews/2026-04-04_0004_diff.md | Source forge-review for F7 (W1) |
| docs/investigations/2026-04-06_1430_chatbot_llm_model_upgrade.md | F11 investigation |
| docs/RCAs/2026-04-06_1430_chatbot_limited_information.md | F11 RCA |
| docs/prompts/2026-04-06_1430_chatbot_limited_information.md | F11 implementation prompt |
| src/data/artemis-knowledge.ts | F11 (stale quick answers) |
| src/data/mission-config.ts | F11 (source of truth for NASA-verified milestones) |
| docs/findings/2026-04-06_1656_fetch_timeout_missing.md | F12 finding report |
| docs/reviews/2026-04-06_1656_diff.md | Source forge-review for F12 (W1) |
| docs/investigations/2026-04-10_1225_chatbot_intermittent_api_failure.md | F14 investigation |
