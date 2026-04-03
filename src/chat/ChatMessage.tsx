import { memo } from 'react';
import DOMPurify from 'dompurify';
import type { ChatMessage as ChatMessageType, ChatPart } from '../hooks/useChat';
import ChatImage from './ChatImage';
import ChatChart from './ChatChart';
import ChatVideo from './ChatVideo';

const MD_BOLD = /\*\*(.*?)\*\*/g;
const MD_ITALIC = /\*(.*?)\*/g;
const MD_OL = /^(\d+)\.\s+/gm;
const MD_UL = /^[-*]\s+/gm;
const MD_DOUBLE_NEWLINE = /\n\n/g;
const MD_NEWLINE = /\n/g;

function renderMarkdown(text: string) {
  return text
    .replace(MD_BOLD, '<strong>$1</strong>')
    .replace(MD_ITALIC, '<em>$1</em>')
    .replace(MD_OL, '<li>')
    .replace(MD_UL, '<li>')
    .replace(MD_DOUBLE_NEWLINE, '<br/><br/>')
    .replace(MD_NEWLINE, '<br/>');
}

function renderPart(part: ChatPart, index: number) {
  switch (part.type) {
    case 'text':
      return <span key={index} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(renderMarkdown(part.content)) }} />;
    case 'image':
    case 'nasa-image':
      return <ChatImage key={index} part={part} />;
    case 'chart':
      return <ChatChart key={index} part={part} />;
    case 'video':
      return <ChatVideo key={index} part={part} />;
  }
}

interface Props {
  message: ChatMessageType;
}

function ChatMessage({ message }: Props) {
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
        ) : message.parts ? (
          message.parts.map(renderPart)
        ) : (
          <span dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(renderMarkdown(message.text)) }} />
        )}
      </div>
    </div>
  );
}

export default memo(ChatMessage);

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
