**2026-04-03 21:40 UTC**

# Chatbot Security & Quality -- Findings Tracker

**Created**: 2026-04-03 21:40 UTC
**Last Updated**: 2026-04-04 00:30 UTC
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
| F8 | Curated YouTube video IDs are unavailable — "Video unavailable" on every video request | Defect | **Medium** | Resolved | Resolved | [Report](2026-04-04_0030_chatbot_video_ids_broken.md) |
| F9 | Text responses truncated mid-sentence — maxOutputTokens too low | Defect | **Medium** | Resolved | Resolved | [Report](2026-04-04_0030_chatbot_text_truncation.md) |

**Status legend**: `Open` -> `In Progress` -> `Resolved` -> `Verified`
**Stage legend**: `Open` -> `Investigating` / `Designing` -> `RCA Complete` / `Blueprint Ready` -> `Planned` -> `Implementing` -> `Reviewed` -> `Resolved` -> `Verified`

---

## Dependency Map

```
F1 (XSS) is CRITICAL — fix first
F2-F6 are independent Medium defects, can be fixed in any order
F4 (video data drift) and F5 (type divergence) share the same root cause (api/ cannot import from src/)
F7 is independent of F1-F6; relates to input validation path in F3's vicinity
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

- [ ] **F8.1**: RCA + fix — replace all 7 video IDs with verified working NASA YouTube IDs (-> /rca-bugfix -> Stage: RCA Complete)
- [ ] **F8.2**: Implement fix (Stage: Implementing -> Resolved)
- [ ] **F8.3**: Verify fix (Stage: Verified)

**Recommended approach**: `/rca-bugfix` — root cause is clear, verified replacement IDs documented in finding report.

**Status**: Open
**Stage**: Open
**Resolved in session**: --
**Verified in session**: --
**GitHub Issue**: --
**Project Item ID**: --

**Lifecycle**:
| Stage | Timestamp | Session | Artifact |
|-------|-----------|---------|----------|
| Open | 2026-04-04 00:30 UTC | 3 | [Finding Report](2026-04-04_0030_chatbot_video_ids_broken.md) |

---

## F9: Text Responses Truncated Mid-Sentence (Medium Defect)

**Summary**: AI text responses cut off mid-sentence on live deployment. `api/chat.ts:121` sets `maxOutputTokens: 500` which is insufficient for conversational responses.

**Root cause**: Token limit set too low during MVP implementation. 500 tokens results in incomplete responses.

**Resolution tasks**:

- [ ] **F9.1**: RCA + fix — increase maxOutputTokens to 1024 (-> /rca-bugfix -> Stage: RCA Complete)
- [ ] **F9.2**: Implement fix (Stage: Implementing -> Resolved)
- [ ] **F9.3**: Verify fix (Stage: Verified)

**Recommended approach**: `/rca-bugfix` — root cause is clear, single-line fix.

**Status**: Open
**Stage**: Open
**Resolved in session**: --
**Verified in session**: --
**GitHub Issue**: --
**Project Item ID**: --

**Lifecycle**:
| Stage | Timestamp | Session | Artifact |
|-------|-----------|---------|----------|
| Open | 2026-04-04 00:30 UTC | 3 | [Finding Report](2026-04-04_0030_chatbot_text_truncation.md) |

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
