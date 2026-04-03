import { useState, useCallback, useRef, useEffect } from 'react';
import { findQuickAnswer } from '../data/artemis-knowledge';

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
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
      const allMessages = [...messagesRef.current, userMsg].map((m) => ({
        role: m.role,
        text: m.text,
      }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: allMessages }),
      });

      if (!res.ok) {
        throw new Error(`Chat API error: ${res.status}`);
      }

      const data = await res.json();
      const assistantMsg: ChatMessage = { role: 'assistant', text: data.text };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      const errorMsg: ChatMessage = {
        role: 'assistant',
        text: 'Sorry, I could not process your question right now. Please try again or use one of the quick-answer buttons.',
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
