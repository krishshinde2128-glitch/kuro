import { useEffect, useRef, useState } from 'react';
import { Send, AlertCircle, RotateCcw } from 'lucide-react';
import type { ChatEntry } from '../game/petState';

interface ChatPanelProps {
  petName: string;
  messages: ChatEntry[];
  isLoading: boolean;
  error: string | null;
  onSendMessage: (text: string) => void;
  onRetryLast: () => void;
}

const QUICK_PROMPTS = [
  {
    label: 'Finished a task',
    prompt: 'I just finished my main assignment and checked it off!',
  },
  {
    label: 'Feeling sad',
    prompt: 'I feel really overwhelmed and sad today, honestly I just want to cry.',
  },
  {
    label: 'Feeling angry',
    prompt: 'Everything is going wrong right now and I am so frustrated.',
  },
  {
    label: 'Buy Beanbag Chair',
    prompt: 'Buy Beanbag Chair',
  },
];

export function ChatPanel({
  petName,
  messages,
  isLoading,
  error,
  onSendMessage,
  onRetryLast,
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    setInput('');
    onSendMessage(trimmed);
  };

  return (
    <section
      aria-label={`Talk with ${petName}`}
      className="bg-white border border-zinc-200 rounded-2xl flex flex-col h-[540px] lg:h-[600px] overflow-hidden shadow-sm"
    >
      <div className="px-5 py-3.5 border-b border-zinc-200 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">
            Conversation with {petName}
          </h2>
          <p className="text-xs text-zinc-500">
            Log tasks, share how you really feel, or say &ldquo;Buy Beanbag Chair&rdquo;
          </p>
        </div>
        <span className="text-xs font-mono tabular-nums text-zinc-500 whitespace-nowrap shrink-0">
          {messages.length} turns
        </span>
      </div>

      {/* Message Feed */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.map((entry) => {
          const isUser = entry.role === 'user';
          const speaker = isUser ? 'You' : entry.petName ?? petName;
          return (
            <div
              key={entry.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                  isUser
                    ? 'bg-zinc-900 text-white'
                    : 'bg-zinc-100 text-zinc-900 border border-zinc-200/80'
                }`}
              >
                <p>{entry.text}</p>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500 font-mono">
                <span>{speaker}</span>
                <span aria-hidden="true">·</span>
                <span>{entry.timestamp}</span>
                {entry.animation && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{entry.animation}</span>
                  </>
                )}
                {entry.audioCommand && entry.audioCommand !== 'none' && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-blue-700">{entry.audioCommand}</span>
                  </>
                )}
                {typeof entry.coinsDelta === 'number' && entry.coinsDelta !== 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span
                      className={
                        entry.coinsDelta > 0
                          ? 'text-emerald-700 font-medium'
                          : 'text-amber-700'
                      }
                    >
                      {entry.coinsDelta > 0 ? `+${entry.coinsDelta}` : entry.coinsDelta} coins
                    </span>
                  </>
                )}
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex flex-col items-start">
            <div className="rounded-xl px-4 py-3 bg-zinc-100 border border-zinc-200 text-sm text-zinc-600">
              {petName} is listening closely...
            </div>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 flex items-center justify-between gap-3"
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={onRetryLast}
              className="min-h-[36px] px-3 py-1.5 rounded-lg bg-white border border-red-200 text-xs font-medium text-red-700 hover:bg-red-100 flex items-center gap-1.5 shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        )}

        <div ref={scrollEndRef} />
      </div>

      {/* Quick Prompts + Composer */}
      <div className="p-4 border-t border-zinc-200 bg-zinc-50/70 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-zinc-500 mr-1">Try:</span>
          {QUICK_PROMPTS.map((item) => (
            <button
              key={item.label}
              type="button"
              disabled={isLoading}
              onClick={() => onSendMessage(item.prompt)}
              className="min-h-[34px] px-3 py-1.5 rounded-lg border border-zinc-200 bg-white text-xs font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            >
              {item.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <label htmlFor="pet-chat-input" className="sr-only">
            Message {petName} in plain English
          </label>
          <input
            id="pet-chat-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Talk to ${petName} about your day, feelings, or tasks...`}
            disabled={isLoading}
            className="flex-1 min-h-[44px] px-3.5 py-2 rounded-lg border border-zinc-300 bg-white text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={isLoading || input.trim().length === 0}
            aria-label={`Send message to ${petName}`}
            className="min-h-[44px] px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
          >
            <Send className="w-4 h-4" />
            <span>Send</span>
          </button>
        </form>
      </div>
    </section>
  );
}
