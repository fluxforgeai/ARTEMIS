import type { ChatMessage as ChatMessageType } from '../hooks/useChat';

/** Render basic markdown: **bold**, newlines, and numbered/bullet lists */
function renderMarkdown(text: string) {
  // Convert **bold** to <strong>
  let html = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Convert *italic* to <em>
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  // Convert numbered lists (e.g. "1. ") at line starts to <li>
  html = html.replace(/^(\d+)\.\s+/gm, '<li>');
  // Convert bullet lists (- or *) at line starts to <li>
  html = html.replace(/^[-*]\s+/gm, '<li>');
  // Convert double newlines to paragraph breaks
  html = html.replace(/\n\n/g, '<br/><br/>');
  // Convert remaining newlines to <br/>
  html = html.replace(/\n/g, '<br/>');
  return html;
}

interface Props {
  message: ChatMessageType;
}

export default function ChatMessage({ message }: Props) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
          isUser
            ? 'bg-[rgba(0,212,255,0.15)] text-hud-blue border border-[rgba(0,212,255,0.2)]'
            : 'bg-[rgba(255,255,255,0.05)] text-gray-200 border border-[rgba(255,255,255,0.05)]'
        }`}
      >
        {isUser ? (
          message.text
        ) : (
          <span dangerouslySetInnerHTML={{ __html: renderMarkdown(message.text) }} />
        )}
      </div>
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex justify-start mb-3">
      <div className="bg-[rgba(255,255,255,0.05)] rounded-lg px-4 py-3 border border-[rgba(255,255,255,0.05)]">
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-gray-400 animate-pulse"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
