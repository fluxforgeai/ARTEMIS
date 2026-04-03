# Finding: Chat Text Responses Truncated Mid-Sentence

**Date**: 2026-04-04
**Found by**: Visual verification on live deployment
**Classification**: Defect | Medium

## What Was Found

AI text responses are cut off mid-sentence. Observed examples:
- "The Artemis II crew is making incredible progress on their" (stops)
- "Here are the" (stops)

## Evidence

Screenshot from live deployment showing two consecutive responses both truncated mid-sentence.

## Scope

`api/chat.ts:121` — `maxOutputTokens: 500` in the Gemini text generation config.

## Preliminary Assessment

- **Likely cause**: `maxOutputTokens: 500` is too low for conversational responses. 500 tokens is approximately 375 words, but Gemini may count tokens differently, and the system prompt consumes context that influences output length
- **Impact**: Every text response risks truncation, making the chatbot appear broken
- **Affected components**: `api/chat.ts` line 121, `generationConfig.maxOutputTokens`
- **Fix**: Increase `maxOutputTokens` to 1024 or higher
