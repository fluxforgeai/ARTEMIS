**2026-04-03 21:40 UTC**

# Chatbot Security & Quality -- Findings Tracker

**Created**: 2026-04-03 21:40 UTC
**Last Updated**: 2026-04-03 21:43 UTC
**Origin**: `/forge-review --scope=diff` of multimodal chatbot implementation
**Session**: 2
**Scope**: Security vulnerabilities and quality issues in the chatbot pipeline (api/chat.ts, ChatMessage.tsx, ChatVideo.tsx)

---

## Overview

Tracking security and quality remediation for the multimodal chatbot, sourced from forge-review report `docs/reviews/2026-04-03_2137_diff.md`.

| # | Finding | Type | Severity | Status | Stage | Report |
|---|---------|------|----------|--------|-------|--------|
| F1 | XSS via dangerouslySetInnerHTML on AI responses | Vulnerability | **Critical** | In Progress | RCA Complete | [Report](2026-04-03_2140_chatbot_security_quality.md) |
| F2 | API key in URL query parameter | Defect | **Medium** | Open | Open | [Report](2026-04-03_2140_chatbot_security_quality.md) |
| F3 | No input validation on messages array | Defect | **Medium** | Open | Open | [Report](2026-04-03_2140_chatbot_security_quality.md) |
| F4 | Duplicated and drifting video data | Defect | **Medium** | Open | Open | [Report](2026-04-03_2140_chatbot_security_quality.md) |
| F5 | ChatPart type divergence server/client | Defect | **Medium** | Open | Open | [Report](2026-04-03_2140_chatbot_security_quality.md) |
| F6 | Unsanitized videoId in iframe src | Defect | **Medium** | Open | Open | [Report](2026-04-03_2140_chatbot_security_quality.md) |

**Status legend**: `Open` -> `In Progress` -> `Resolved` -> `Verified`
**Stage legend**: `Open` -> `Investigating` / `Designing` -> `RCA Complete` / `Blueprint Ready` -> `Planned` -> `Implementing` -> `Reviewed` -> `Resolved` -> `Verified`

---

## Dependency Map

```
F1 (XSS) is CRITICAL — fix first
F2-F6 are independent Medium defects, can be fixed in any order
F4 (video data drift) and F5 (type divergence) share the same root cause (api/ cannot import from src/)
```

---

## F1: XSS via dangerouslySetInnerHTML (Critical Vulnerability)

**Summary**: `ChatMessage.tsx` injects Gemini API response text as raw HTML via `dangerouslySetInnerHTML` without sanitization. `renderMarkdown()` preserves any HTML in the input. XSS payloads in AI responses execute in the user's browser.

**Root cause**: `renderMarkdown()` uses regex substitution to convert markdown to HTML but performs no sanitization or escaping of non-markdown HTML.

**Resolution tasks**:

- [x] **F1.1**: RCA + fix — add DOMPurify sanitization (-> /rca-bugfix -> Stage: RCA Complete)
- [ ] **F1.2**: Implementation plan (-> /plan -> Stage: Planned)
- [ ] **F1.3**: Implement fix (Stage: Implementing -> Resolved)
- [ ] **F1.4**: Code review (-> /forge-review -> Stage: Reviewed)
- [ ] **F1.5**: Verify fix (Stage: Verified)

**Recommended approach**: `/rca-bugfix` — root cause is clear: add `DOMPurify.sanitize()` around `renderMarkdown()` output at both injection points.

**Status**: Open
**Stage**: Open
**Resolved in session**: --
**Verified in session**: --
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

- [ ] **F2.1**: RCA + fix (-> /rca-bugfix -> Stage: RCA Complete)
- [ ] **F2.2**: Implement fix (Stage: Implementing -> Resolved)
- [ ] **F2.3**: Verify fix (Stage: Verified)

**Recommended approach**: `/rca-bugfix` — switch to `x-goog-api-key` header.

**Status**: Open
**Stage**: Open
**Resolved in session**: --
**Verified in session**: --
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

- [ ] **F3.1**: RCA + fix (-> /rca-bugfix -> Stage: RCA Complete)
- [ ] **F3.2**: Implement fix (Stage: Implementing -> Resolved)
- [ ] **F3.3**: Verify fix (Stage: Verified)

**Recommended approach**: `/rca-bugfix` — add message count cap (20), text length cap (2000 chars).

**Status**: Open
**Stage**: Open
**Resolved in session**: --
**Verified in session**: --
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

- [ ] **F4.1**: RCA + fix (-> /rca-bugfix -> Stage: RCA Complete)
- [ ] **F4.2**: Implement fix (Stage: Implementing -> Resolved)
- [ ] **F4.3**: Verify fix (Stage: Verified)

**Recommended approach**: `/rca-bugfix` — consolidate: move video intent detection to client-side, or use a shared JSON file.

**Status**: Open
**Stage**: Open
**Resolved in session**: --
**Verified in session**: --
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

- [ ] **F5.1**: RCA + fix (-> /rca-bugfix -> Stage: RCA Complete)
- [ ] **F5.2**: Implement fix (Stage: Implementing -> Resolved)
- [ ] **F5.3**: Verify fix (Stage: Verified)

**Recommended approach**: `/rca-bugfix` — tighten server-side interface with explicit fields per variant.

**Status**: Open
**Stage**: Open
**Resolved in session**: --
**Verified in session**: --
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

- [ ] **F6.1**: RCA + fix (-> /rca-bugfix -> Stage: RCA Complete)
- [ ] **F6.2**: Implement fix (Stage: Implementing -> Resolved)
- [ ] **F6.3**: Verify fix (Stage: Verified)

**Recommended approach**: `/rca-bugfix` — validate videoId matches `/^[a-zA-Z0-9_-]{11}$/`.

**Status**: Open
**Stage**: Open
**Resolved in session**: --
**Verified in session**: --
**GitHub Issue**: --
**Project Item ID**: --

**Lifecycle**:
| Stage | Timestamp | Session | Artifact |
|-------|-----------|---------|----------|
| Open | 2026-04-03 21:40 UTC | 2 | [Finding Report](2026-04-03_2140_chatbot_security_quality.md) |

---

## Changelog

| Date | Session | Action |
|------|---------|--------|
| 2026-04-03 21:40 UTC | 2 | Created tracker. F1-F6 logged from forge-review. F1: Critical Vulnerability (XSS). F2-F6: Medium Defects. |

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
