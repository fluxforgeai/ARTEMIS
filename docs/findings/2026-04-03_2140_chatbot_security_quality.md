# Finding: XSS Vulnerability + Security/Quality Issues in Multimodal Chatbot

**Date**: 2026-04-03
**Discovered by**: `/forge-review --scope=diff` (Session 2)
**Type**: Vulnerability (C1), Defect (W1-W5)
**Severity**: Critical (C1), Medium (W1-W5)
**Status**: Open

---

## What Was Found

### C1: XSS via dangerouslySetInnerHTML (Critical)

`src/chat/ChatMessage.tsx:20,52` — `renderMarkdown()` applies regex-based markdown-to-HTML conversion and injects via `dangerouslySetInnerHTML`. Input comes from Gemini API responses. No HTML sanitization is performed. If the model returns `<script>`, `<img onerror=...>`, or similar payloads, they execute in the user's browser.

### W1: API key in URL query parameter (Medium)

`api/chat.ts:123,143` — Gemini API key passed as `?key=${apiKey}` in the URL. Query parameters appear in server logs and error traces.

### W2: No input validation on messages array (Medium)

`api/chat.ts:215-221` — `messages` array forwarded to Gemini with no validation on message count, individual text length, or total payload size.

### W3: Duplicated and drifting video data (Medium)

`api/chat.ts:20-28` vs `src/data/artemis-videos.ts:6-17` — Server has 7 entries, client has 10 entries with different titles.

### W4: ChatPart type divergence (Medium)

`api/chat.ts:106-109` vs `src/hooks/useChat.ts:4-9` — Server uses `[key: string]: unknown`, client uses discriminated union.

### W5: Unsanitized videoId in iframe src (Medium)

`src/chat/ChatVideo.tsx:12` — `part.videoId` interpolated directly into iframe URL without validation.

---

## Affected Components

- `src/chat/ChatMessage.tsx` — C1 (XSS)
- `api/chat.ts` — W1, W2, W3, W4
- `src/chat/ChatVideo.tsx` — W5
- `src/data/artemis-videos.ts` — W3

---

## Preliminary Assessment

**Likely cause**: Multimodal chatbot was implemented for speed during Session 2. Security hardening (sanitization, input validation, CORS restriction) was deferred.

**Likely scope**: C1 (XSS) affects all AI-generated chat responses. W1-W5 are isolated to specific files.

**Likely impact**: C1 is exploitable if the Gemini model returns HTML payloads (unlikely in normal use but possible via prompt injection). W1-W5 are lower risk but represent security hygiene gaps.

---

## Classification Rationale

**Type: Vulnerability (C1)** — XSS is an OWASP Top 10 vulnerability with direct user impact.
**Type: Defect (W1-W5)** — Security/quality gaps that should be remediated.

**Severity: Critical (C1)** — Active XSS exposure via AI-generated content.
**Severity: Medium (W1-W5)** — Workarounds exist, not immediately dangerous.

---

**Finding Logged**: 2026-04-03 21:40 UTC
