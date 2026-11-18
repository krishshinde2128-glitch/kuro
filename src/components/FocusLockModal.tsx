import { useEffect, useState } from 'react';
import { Lock, CheckCircle2 } from 'lucide-react';

interface FocusLockModalProps {
  open: boolean;
  onUnlock: (completedSession: boolean) => void;
}

const DEFAULT_LOCK_SECONDS = 120;

export function FocusLockModal({ open, onUnlock }: FocusLockModalProps) {
  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_LOCK_SECONDS);

  useEffect(() => {
    if (!open) {
      setSecondsLeft(DEFAULT_LOCK_SECONDS);
      return;
    }

    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [open]);

  if (!open) return null;

  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const secs = String(secondsLeft % 60).padStart(2, '0');
  const progress = Math.round(((DEFAULT_LOCK_SECONDS - secondsLeft) / DEFAULT_LOCK_SECONDS) * 100);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="focus-lock-title"
      className="fixed inset-0 z-50 bg-zinc-950/85 flex items-center justify-center p-4"
    >
      <div className="w-full max-w-md bg-white border border-zinc-200 rounded-2xl p-6 text-center shadow-xl">
        <div className="mx-auto w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 mb-4">
          {secondsLeft === 0 ? <CheckCircle2 className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
        </div>

        <h2
          id="focus-lock-title"
          className="text-xl font-semibold text-zinc-900"
        >
          {secondsLeft === 0 ? 'Focus Sprint Complete' : 'Kuro Focus Lock Active'}
        </h2>

        <p className="mt-2 text-sm text-zinc-600 leading-relaxed">
          {secondsLeft === 0
            ? 'Two minutes of distraction-free breathing cleared. Ready to return to your top task?'
            : 'Intervention triggered: step away from distracting tabs and focus on one single concrete step.'}
        </p>

        <div className="my-6 py-4 px-5 bg-zinc-50 border border-zinc-200 rounded-xl">
          <div className="text-4xl font-mono font-semibold tabular-nums text-zinc-900">
            {mins}:{secs}
          </div>
          <div className="mt-3 h-2 w-full bg-zinc-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-[width] duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            onClick={() => onUnlock(secondsLeft === 0)}
            className="min-h-[44px] px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors whitespace-nowrap"
          >
            {secondsLeft === 0 ? 'Return to Desk' : "I'm Refocused — Unlock"}
          </button>
        </div>
      </div>
    </div>
  );
}
