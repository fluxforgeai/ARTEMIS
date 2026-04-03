# Implementation Prompt: Fix XSS + Security Hardening (F1-F6)

**RCA Reference**: docs/RCAs/2026-04-03_2143_chatbot_xss_security.md

## Context

Forge-review found 1 critical XSS vulnerability and 5 medium security/quality gaps in the multimodal chatbot. All fixes are straightforward.

## Goal

Fix all 6 findings in a single batch.

## Requirements

1. **F1**: Install `dompurify` + `@types/dompurify`. Wrap all `dangerouslySetInnerHTML` with `DOMPurify.sanitize()`
2. **F2**: Move Gemini API key from URL `?key=` to `x-goog-api-key` header
3. **F3**: Cap messages to last 20, text to 2000 chars before forwarding to Gemini
4. **F4**: Remove `src/data/artemis-videos.ts` (unused client-side), keep server-side as canonical
5. **F5**: Replace loose `ChatPart` interface in api/chat.ts with typed variants
6. **F6**: Validate videoId with `/^[a-zA-Z0-9_-]{11}$/` before rendering iframe

## Files Likely Affected

- `src/chat/ChatMessage.tsx` — F1 (add DOMPurify)
- `api/chat.ts` — F2, F3, F5 (header auth, input validation, typed parts)
- `src/chat/ChatVideo.tsx` — F6 (validate videoId)
- `src/data/artemis-videos.ts` — F4 (delete)
- `package.json` — F1 (add dompurify)

## Acceptance Criteria

- [ ] No `dangerouslySetInnerHTML` without DOMPurify sanitization
- [ ] Gemini API key not in any URL query string
- [ ] Messages capped to 20, text to 2000 chars
- [ ] Single source of truth for curated video data
- [ ] Server-side ChatPart properly typed
- [ ] videoId validated before iframe render
- [ ] All tests pass, build succeeds

---

## Plan Output Instructions

1. Call `EnterPlanMode`
2. Write plan to `docs/plans/2026-04-03_2143_chatbot_xss_security.md`
3. Call `ExitPlanMode`
4. After approval, invoke `/wrought-rca-fix`
