import { useState, useCallback, useRef, useEffect } from 'react';
import { findQuickAnswer } from '../data/artemis-knowledge';

const USER_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

export type ChatPart =
  | { type: 'text'; content: string }
  | { type: 'image'; data: string; mimeType: string; alt?: string }
  | { type: 'nasa-image'; url: string; title: string; credit: string }
  | { type: 'chart'; chartType: 'altitude' | 'velocity' | 'earth-distance'; title: string }
  | { type: 'video'; videoId: string; title: string }
  | { type: 'sources'; items: Array<{ url: string; title: string }> };

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  parts?: ChatPart[];
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesRef = useRef<ChatMessage[]>([]);

  // Keep ref in sync with state
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const sendMessage = useCallback(async (text: string) => {
    const userMsg: ChatMessage = { role: 'user', text };
    setMessages((prev) => [...prev, userMsg]);

    // Try quick answer first (client-side, instant)
    const quickAnswer = findQuickAnswer(text);
    if (quickAnswer) {
      const assistantMsg: ChatMessage = { role: 'assistant', text: quickAnswer };
      setMessages((prev) => [...prev, assistantMsg]);
      return;
    }

    // Fall back to API — read from ref to get latest messages (avoids stale closure)
    setIsLoading(true);
    try {
      // Send only text for message history (strip parts — Gemini needs text-only)
      const allMessages = [...messagesRef.current.slice(-19), userMsg].map((m) => ({
        role: m.role,
        text: m.text,
      }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: allMessages,
          userTimezone: USER_TIMEZONE,
        }),
        signal: AbortSignal.timeout(20_000),
      });

      if (!res.ok) {
        throw new Error(`Chat API error: ${res.status}`);
      }

      const data = await res.json();

      // Handle multimodal response (parts array) or legacy text response
      let assistantMsg: ChatMessage;
      if (data.parts && Array.isArray(data.parts)) {
        const textContent = data.parts
          .filter((p: ChatPart) => p.type === 'text')
          .map((p: { type: 'text'; content: string }) => p.content)
          .join('\n');
        assistantMsg = { role: 'assistant', text: textContent, parts: data.parts };
      } else {
        assistantMsg = { role: 'assistant', text: data.text };
      }

      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      const errorMsg: ChatMessage = {
        role: 'assistant',
        text: 'The AI service is temporarily unavailable. This usually resolves quickly \u2014 please try your question again.',
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }, []); // No messages dependency — reads from ref

  const askQuickAnswer = useCallback((question: string) => {
    const answer = findQuickAnswer(question);
    if (answer) {
      setMessages((prev) => [
        ...prev,
        { role: 'user', text: question },
        { role: 'assistant', text: answer },
      ]);
    }
  }, []);

  return { messages, isLoading, sendMessage, askQuickAnswer };
}
