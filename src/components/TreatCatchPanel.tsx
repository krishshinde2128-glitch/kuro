import { useCallback, useEffect, useRef, useState } from 'react';
import { Cookie, Play, RotateCcw, Sparkles, Utensils } from 'lucide-react';
import {
  clampBowlX,
  computeTreatRewards,
  createTreatRoundState,
  QUICK_TREAT_COST,
  QUICK_TREAT_HAPPINESS,
  QUICK_TREAT_HUNGER,
  stepTreatRound,
  TREAT_ROUND_SECONDS,
} from '../game/treatGame';
import type { TreatRoundRewards, TreatRoundState } from '../game/treatGame';
import { soundEngine } from '../game/soundEngine';

interface TreatCatchPanelProps {
  petName: string;
  hunger: number;
  walletBalance: number;
  onQuickSnack: () => { ok: boolean; reason?: string };
  onCompleteMiniGame: (rewards: TreatRoundRewards) => void;
  onGoToChat: () => void;
}

export function TreatCatchPanel({
  petName,
  hunger,
  walletBalance,
  onQuickSnack,
  onCompleteMiniGame,
  onGoToChat,
}: TreatCatchPanelProps) {
  const [gameState, setGameState] = useState<TreatRoundState>(() =>
    createTreatRoundState('TITLE_MENU')
  );
  const [lastRewards, setLastRewards] = useState<TreatRoundRewards | null>(null);
  const [snackNotice, setSnackNotice] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<TreatRoundState>(gameState);
  stateRef.current = gameState;

  const targetBowlXRef = useRef(0.5);
  const keysHeldRef = useRef<{ left: boolean; right: boolean }>({
    left: false,
    right: false,
  });
  const awardedRef = useRef(false);
  const onCompleteRef = useRef(onCompleteMiniGame);
  onCompleteRef.current = onCompleteMiniGame;

  const finalizeRound = useCallback((finalState: TreatRoundState) => {
    if (awardedRef.current) return;
    awardedRef.current = true;
    const rewards = computeTreatRewards(finalState);
    setLastRewards(rewards);
    if (rewards.hungerGain > 0 || rewards.coinsEarned > 0) {
      soundEngine.playCoinEarned();
      onCompleteRef.current(rewards);
    }
  }, []);

  const handleStartGame = () => {
    awardedRef.current = false;
    setLastRewards(null);
    setSnackNotice(null);
    targetBowlXRef.current = 0.5;
    keysHeldRef.current = { left: false, right: false };
    const fresh = createTreatRoundState('PLAYING');
    stateRef.current = fresh;
    setGameState(fresh);
    soundEngine.playPurrChirp();
  };

  const handleFinishEarly = () => {
    if (stateRef.current.phase !== 'PLAYING') return;
    const ended: TreatRoundState = {
      ...stateRef.current,
      phase: 'ROUND_SUMMARY',
      timeRemaining: 0,
    };
    stateRef.current = ended;
    setGameState(ended);
    finalizeRound(ended);
  };

  const handleQuickSnackClick = () => {
    const res = onQuickSnack();
    if (!res.ok) {
      setSnackNotice(res.reason ?? 'Unable to feed treat right now.');
      return;
    }
    setSnackNotice(`Fed ${petName} a quick pantry treat (+${QUICK_TREAT_HUNGER} Hunger)!`);
    soundEngine.playCoinEarned();
  };

  // Keyboard steering while active
  useEffect(() => {
    if (gameState.phase !== 'PLAYING') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        keysHeldRef.current.left = true;
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        keysHeldRef.current.right = true;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        keysHeldRef.current.left = false;
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        keysHeldRef.current.right = false;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [gameState.phase]);

  // Main animation & rendering loop while PLAYING
  useEffect(() => {
    if (gameState.phase !== 'PLAYING') return;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let width = container.clientWidth || 560;
    let height = container.clientHeight || 300;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const syncSize = () => {
      width = container.clientWidth || 560;
      height = container.clientHeight || 300;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    };
    syncSize();

    const observer = new ResizeObserver(syncSize);
    observer.observe(container);

    let rafId = 0;
    let lastTs = performance.now();
    let uiSyncAccum = 0;

    const drawArena = (s: TreatRoundState) => {
      ctx.save();
      ctx.scale(dpr, dpr);

      // 60% Neutral Dark Arena Backdrop
      const bg = ctx.createLinearGradient(0, 0, 0, height);
      bg.addColorStop(0, '#0F172A');
      bg.addColorStop(1, '#1E293B');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      // Subtle vertical catch lanes
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 6; i += 1) {
        const lx = (width * i) / 6;
        ctx.beginPath();
        ctx.moveTo(lx, 0);
        ctx.lineTo(lx, height);
        ctx.stroke();
      }

      // Ground mat line
      const floorY = height * 0.89;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.fillRect(0, floorY, width, height - floorY);

      // Falling items
      for (const snack of s.snacks) {
        const sx = snack.x * width;
        const sy = snack.y * height;

        ctx.save();
        ctx.translate(sx, sy);

        if (snack.kind === 'treat') {
          // Crunchy Biscuit / Bone Treat (Amber)
          ctx.fillStyle = '#F59E0B';
          ctx.strokeStyle = '#FEF3C7';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.roundRect(-13, -7, 26, 14, 7);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#B45309';
          ctx.beginPath();
          ctx.arc(-5, -1, 1.8, 0, Math.PI * 2);
          ctx.arc(4, 2, 1.8, 0, Math.PI * 2);
          ctx.fill();
        } else if (snack.kind === 'golden') {
          // Golden Star Focus Treat (Warm Gold)
          ctx.fillStyle = '#FACC15';
          ctx.strokeStyle = '#FEF08A';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          for (let i = 0; i < 10; i += 1) {
            const ang = -Math.PI / 2 + (i * Math.PI) / 5;
            const r = i % 2 === 0 ? 13 : 5.8;
            const px = Math.cos(ang) * r;
            const py = Math.sin(ang) * r;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else {
          // Burnt Distraction Snack (Dark Red + Explicit X Mark)
          ctx.fillStyle = '#7F1D1D';
          ctx.strokeStyle = '#F87171';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, 12, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.strokeStyle = '#FCA5A5';
          ctx.lineWidth = 2.2;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(-4.5, -4.5);
          ctx.lineTo(4.5, 4.5);
          ctx.moveTo(4.5, -4.5);
          ctx.lineTo(-4.5, 4.5);
          ctx.stroke();
        }

        ctx.restore();
      }

      // Catch Bowl
      const bx = s.bowlX * width;
      const by = height * 0.87;
      const bw = Math.max(66, width * 0.19);

      ctx.save();
      ctx.translate(bx, by);
      // Bowl shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.36)';
      ctx.beginPath();
      ctx.ellipse(0, 14, bw * 0.54, 7, 0, 0, Math.PI * 2);
      ctx.fill();

      // Bowl body
      ctx.fillStyle = '#2563EB';
      ctx.strokeStyle = '#93C5FD';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-bw * 0.52, -8);
      ctx.lineTo(bw * 0.52, -8);
      ctx.quadraticCurveTo(bw * 0.44, 14, bw * 0.28, 14);
      ctx.lineTo(-bw * 0.28, 14);
      ctx.quadraticCurveTo(-bw * 0.44, 14, -bw * 0.52, -8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Bowl rim highlight & pet name tag
      ctx.fillStyle = '#60A5FA';
      ctx.beginPath();
      ctx.roundRect(-bw * 0.55, -12, bw * 1.1, 7, 3.5);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '600 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(petName.slice(0, 10), 0, 4);
      ctx.restore();

      // Catch feedback callout above bowl
      if (s.lastFeedback) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, s.lastFeedback.ttl / 0.25);
        ctx.font = '700 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle =
          s.lastFeedback.tone === 'gold'
            ? '#FACC15'
            : s.lastFeedback.tone === 'bad'
              ? '#FCA5A5'
              : '#6EE7B7';
        ctx.fillText(s.lastFeedback.text, bx, by - 28);
        ctx.restore();
      }

      ctx.restore();
    };

    const loop = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTs) / 1000));
      lastTs = now;

      if (keysHeldRef.current.left) {
        targetBowlXRef.current = clampBowlX(targetBowlXRef.current - 0.95 * dt);
      }
      if (keysHeldRef.current.right) {
        targetBowlXRef.current = clampBowlX(targetBowlXRef.current + 0.95 * dt);
      }

      const { state: nextState, events } = stepTreatRound(
        stateRef.current,
        dt,
        targetBowlXRef.current,
        { reducedMotion }
      );
      stateRef.current = nextState;

      for (const ev of events) {
        if (ev === 'golden') soundEngine.playCoinEarned();
        else if (ev === 'treat') soundEngine.playPurrChirp();
        else soundEngine.playAlertTone();
      }

      drawArena(nextState);

      uiSyncAccum += dt;
      if (uiSyncAccum >= 0.1 || nextState.phase !== 'PLAYING') {
        uiSyncAccum = 0;
        setGameState(nextState);
      }

      if (nextState.phase === 'ROUND_SUMMARY') {
        finalizeRound(nextState);
        return;
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, [gameState.phase, petName, finalizeRound]);

  const handleCanvasPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (stateRef.current.phase !== 'PLAYING') return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width) return;
    const nx = (e.clientX - rect.left) / rect.width;
    targetBowlXRef.current = clampBowlX(nx);
  };

  const canBuySnack = walletBalance >= QUICK_TREAT_COST && hunger < 100;
  const liveRewards = computeTreatRewards(gameState);

  return (
    <section
      aria-label={`Treat Catch mini-game and snack pantry for ${petName}`}
      className="bg-white border border-zinc-200 rounded-2xl flex flex-col h-[540px] lg:h-[600px] overflow-hidden shadow-sm"
    >
      {/* Panel Header */}
      <div className="px-5 py-3.5 border-b border-zinc-200 flex items-center justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Snack Pantry &amp; Treat Catch</h2>
          <p className="text-xs text-zinc-500">
            Feed {petName} anytime—even with zero active tasks
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono tabular-nums text-zinc-600 whitespace-nowrap shrink-0">
          <span>Fuel {hunger}/100</span>
          <span aria-hidden="true">·</span>
          <span className="text-amber-700 font-medium">{walletBalance}c</span>
        </div>
      </div>

      {/* Quick Coin Pantry Snack Strip */}
      <div className="px-5 py-3 border-b border-zinc-200 bg-zinc-50/70 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <Utensils className="w-4 h-4 text-amber-600 shrink-0" />
          <div className="text-xs">
            <span className="font-semibold text-zinc-900">Quick Pantry Treat</span>
            <span className="text-zinc-500 ml-2">
              +{QUICK_TREAT_HUNGER} Hunger · +{QUICK_TREAT_HAPPINESS} Happiness
            </span>
          </div>
        </div>
        <button
          type="button"
          data-testid="quick-treat-btn"
          disabled={!canBuySnack}
          onClick={handleQuickSnackClick}
          className="min-h-[36px] px-3.5 py-1.5 rounded-lg bg-white border border-zinc-300 text-xs font-medium text-zinc-900 hover:bg-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0"
        >
          {hunger >= 100
            ? `${petName} is Full`
            : walletBalance < QUICK_TREAT_COST
              ? `Need ${QUICK_TREAT_COST} Coins`
              : `Feed Treat (${QUICK_TREAT_COST}c)`}
        </button>
      </div>

      {snackNotice && (
        <div
          role="status"
          className="px-5 py-2 bg-emerald-50 border-b border-emerald-200 text-xs font-medium text-emerald-800 shrink-0"
        >
          {snackNotice}
        </div>
      )}

      {/* Main Game Container */}
      <div className="flex-1 flex flex-col min-h-0 p-5">
        {gameState.phase === 'TITLE_MENU' && (
          <div className="flex-1 rounded-xl bg-slate-900 text-slate-100 p-6 flex flex-col justify-between">
            <div className="space-y-2">
              <p className="text-xs font-mono text-amber-300">
                Free {TREAT_ROUND_SECONDS}s Mini-Game · Works with 0 tasks &amp; 0 coins
              </p>
              <h3 className="text-xl font-semibold tracking-tight text-white">
                Catch Snacks for {petName}
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed max-w-md">
                Steer {petName}&rsquo;s bowl with your mouse, touch, or Arrow / A-D keys to catch falling treats before the timer runs out.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-4">
              <div className="p-3 rounded-lg bg-slate-800/90 border border-slate-700/80 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                  <Cookie className="w-3.5 h-3.5" />
                  <span>Crunchy Biscuit</span>
                </div>
                <p className="text-xs text-slate-300">+Hunger fuel &amp; streak</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-800/90 border border-slate-700/80 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-yellow-300">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Golden Star</span>
                </div>
                <p className="text-xs text-slate-300">+Bonus Hunger &amp; +2 Coins</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-800/90 border border-slate-700/80 space-y-1">
                <div className="text-xs font-semibold text-red-300">
                  ✕ Burnt Snack
                </div>
                <p className="text-xs text-slate-300">Dodge! Resets combo</p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 pt-2 border-t border-slate-800">
              <span className="text-xs text-slate-400">
                3+ clean catches in a row activates 2x streak
              </span>
              <button
                type="button"
                data-testid="start-treat-game-btn"
                onClick={handleStartGame}
                className="min-h-[44px] px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
              >
                <Play className="w-4 h-4" />
                <span>Start Game</span>
              </button>
            </div>
          </div>
        )}

        {gameState.phase === 'PLAYING' && (
          <div className="flex-1 flex flex-col min-h-0 gap-3">
            {/* Unobtrusive Top HUD Bar (outside play canvas) */}
            <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-slate-900 text-slate-100 text-xs font-mono tabular-nums shrink-0">
              <div className="flex items-center gap-3 flex-wrap">
                <span>
                  Time:{' '}
                  <strong className="text-white">
                    {Math.ceil(gameState.timeRemaining)}s
                  </strong>
                </span>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span>
                  Caught:{' '}
                  <strong className="text-emerald-300">
                    {gameState.treatsCaught + gameState.goldenCaught}
                  </strong>
                </span>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span>
                  Combo:{' '}
                  <strong className={gameState.streak >= 3 ? 'text-amber-300' : 'text-slate-200'}>
                    {gameState.streak >= 3 ? `${gameState.streak} (2x)` : gameState.streak}
                  </strong>
                </span>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span className="text-amber-300">
                  +{liveRewards.hungerGain} Fuel
                </span>
              </div>

              <button
                type="button"
                data-testid="finish-treat-game-btn"
                onClick={handleFinishEarly}
                className="min-h-[32px] px-3 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-100 font-sans text-xs font-medium transition-colors whitespace-nowrap shrink-0"
              >
                Feed Now
              </button>
            </div>

            <div
              ref={containerRef}
              className="flex-1 min-h-0 rounded-xl overflow-hidden border border-slate-800 bg-slate-900"
            >
              <canvas
                ref={canvasRef}
                data-testid="treat-game-canvas"
                aria-label="Treat Catch game arena. Move pointer or press Left and Right arrow keys to steer the bowl."
                onPointerMove={handleCanvasPointer}
                onPointerDown={handleCanvasPointer}
                className="w-full h-full block touch-none cursor-ew-resize"
              />
            </div>
          </div>
        )}

        {gameState.phase === 'ROUND_SUMMARY' && lastRewards && (
          <div className="flex-1 rounded-xl bg-slate-900 text-slate-100 p-6 flex flex-col justify-between">
            <div className="space-y-1.5">
              <p className="text-xs font-mono text-emerald-300">
                {lastRewards.hungerGain > 0 ? 'Meal Served' : 'Round Complete'}
              </p>
              <h3 className="text-xl font-semibold text-white">
                {lastRewards.hungerGain > 0
                  ? `${petName} Loved Those Treats!`
                  : `No Treats Caught This Time`}
              </h3>
              <p className="text-sm text-slate-300">
                {lastRewards.hungerGain > 0
                  ? `${petName} gained +${lastRewards.hungerGain} Hunger and +${lastRewards.happinessGain} Happiness.`
                  : `Steer the bowl under amber biscuits and gold stars while dodging red burnt snacks.`}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
              <div className="p-3 rounded-lg bg-slate-800 border border-slate-700">
                <span className="text-xs text-slate-400">Caught</span>
                <p className="mt-1 text-lg font-mono font-semibold tabular-nums text-white">
                  {lastRewards.treatsCaught + lastRewards.goldenCaught}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-slate-800 border border-slate-700">
                <span className="text-xs text-slate-400">Hunger</span>
                <p className="mt-1 text-lg font-mono font-semibold tabular-nums text-emerald-300">
                  +{lastRewards.hungerGain}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-slate-800 border border-slate-700">
                <span className="text-xs text-slate-400">Happiness</span>
                <p className="mt-1 text-lg font-mono font-semibold tabular-nums text-blue-300">
                  +{lastRewards.happinessGain}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-slate-800 border border-slate-700">
                <span className="text-xs text-slate-400">Bonus Coins</span>
                <p className="mt-1 text-lg font-mono font-semibold tabular-nums text-amber-300">
                  +{lastRewards.coinsEarned}c
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={onGoToChat}
                className="min-h-[42px] px-4 py-2 rounded-lg border border-slate-700 text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
              >
                Back to Chat
              </button>
              <button
                type="button"
                data-testid="play-again-treat-btn"
                onClick={handleStartGame}
                className="min-h-[42px] px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Play Again</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
