# Root Cause Analysis: XSS + Security Hardening in Multimodal Chatbot

**Date**: 2026-04-03
**Severity**: Critical (F1), Medium (F2-F6)
**Status**: Identified
**Finding**: F1-F6 in `docs/findings/2026-04-03_2140_chatbot_security_quality_FINDINGS_TRACKER.md`

## Problem Statement

The multimodal chatbot has an XSS vulnerability (C1) and 5 security/quality gaps (W1-W5) identified by forge-review.

## Symptoms

- F1: AI-generated text rendered as raw HTML via `dangerouslySetInnerHTML` without sanitization
- F2: Gemini API key visible in URL query parameters
- F3: No bounds on chat message count or text length sent to API
- F4: Video lookup data duplicated between server and client with drift
- F5: Server-side ChatPart uses loose `[key: string]: unknown` instead of typed union
- F6: YouTube videoId interpolated into iframe src without validation

## Root Cause

**F1 (Critical)**: `renderMarkdown()` in `ChatMessage.tsx` converts markdown to HTML using regex but performs no sanitization. The output is injected via `dangerouslySetInnerHTML`. If the Gemini model returns HTML payloads (via prompt injection or unexpected output), they execute in the user's browser.

**F2-F6 (Medium)**: Security hardening was deferred during the multimodal implementation sprint. All are straightforward fixes.

## Resolution

### F1: Add DOMPurify sanitization

Install `dompurify` and its types. Wrap all `dangerouslySetInnerHTML` calls:
```typescript
import DOMPurify from 'dompurify';
// Before: dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }}
// After:  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(renderMarkdown(text)) }}
```

Apply at both injection points in `ChatMessage.tsx` (line 20 in `renderPart` and line 52 in fallback).

### F2: Move API key to header

Replace `?key=${apiKey}` in fetch URL with `x-goog-api-key` header:
```typescript
headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey }
```

### F3: Add input validation

Before processing messages, validate:
```typescript
const trimmed = messages.slice(-20).map(m => ({
  ...m,
  text: m.text.slice(0, 2000),
}));
```

### F4: Remove duplicate video data from api/chat.ts

Move video intent resolution to use the same curated data. Since api/ can't import from src/, inline the video lookup in api/chat.ts but keep only ONE canonical source. Remove `src/data/artemis-videos.ts` client-side duplicate since video lookup only happens server-side.

### F5: Tighten server-side ChatPart type

Replace the loose interface with explicit per-variant types matching the client-side discriminated union.

### F6: Validate videoId

Add regex validation in `ChatVideo.tsx`:
```typescript
const isValidId = /^[a-zA-Z0-9_-]{11}$/.test(part.videoId);
if (!isValidId) return null;
```

## Debug Strategy

- **Self-debug**: enabled
- **Verifier**: `npm run build && npm run test -- --run`
- **Max iterations**: 3
- **Completion criteria**: Build passes, all tests pass, no `dangerouslySetInnerHTML` without DOMPurify wrapper
- **Invoke with**: `/wrought-rca-fix`
