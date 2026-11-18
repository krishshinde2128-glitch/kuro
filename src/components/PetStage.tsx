import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, Music, CloudRain, BellRing, Moon, Sun, Award, ChevronDown } from 'lucide-react';
import { PetCanvasRenderer } from '../game/petRenderer';
import {
  clampRoomPosition,
  DEFAULT_ROOM_LAYOUT,
  formatSleepCountdown,
  getMoodDescriptor,
  getPetEvolution,
  PET_PROFILES,
  SLEEP_DURATION_OPTIONS,
} from '../game/petState';
import type {
  MoodBgColor,
  PetAnimation,
  PetId,
  PetStats,
  RoomItemPosition,
} from '../game/petState';

interface PetStageProps {
  selectedPet: PetId;
  petName: string;
  animation: PetAnimation;
  stats: PetStats;
  walletBalance: number;
  uiBgColor: MoodBgColor;
  roomInventory: string[];
  roomLayout: Record<string, RoomItemPosition>;
  dialogue: string;
  pushNotification: string | null;
  audioMode: 'lofi' | 'rain' | 'none';
  muted: boolean;
  isSleeping: boolean;
  sleepUntil: number | null;
  tasksCompletedCount: number;
  onToggleMute: () => void;
  onToggleLofi: () => void;
  onToggleRain: () => void;
  onStartSleep: (durationMinutes: number | null) => void;
  onWakePet: () => void;
  onPetTap: () => void;
  onMoveFurniture: (itemName: string, pos: RoomItemPosition) => void;
}

export function PetStage({
  selectedPet,
  petName,
  animation,
  stats,
  walletBalance,
  uiBgColor,
  roomInventory,
  roomLayout,
  dialogue,
  pushNotification,
  audioMode,
  muted,
  isSleeping,
  sleepUntil,
  tasksCompletedCount,
  onToggleMute,
  onToggleLofi,
  onToggleRain,
  onStartSleep,
  onWakePet,
  onPetTap,
  onMoveFurniture,
}: PetStageProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<PetCanvasRenderer | null>(null);
  const [canvasCursor, setCanvasCursor] = useState<'default' | 'pointer' | 'grab' | 'grabbing'>('default');
  const [activeEmote, setActiveEmote] = useState<string>('none');
  const [sleepMenuOpen, setSleepMenuOpen] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const sleepMenuRef = useRef<HTMLDivElement | null>(null);

  const draggingRef = useRef<{
    itemName: string;
    startClientX: number;
    startClientY: number;
    offsetX: number;
    offsetY: number;
    latestPos: RoomItemPosition;
    moved: boolean;
    bowlWasOnTable: boolean;
  } | null>(null);
  const suppressNextClickRef = useRef(false);

  const mood = getMoodDescriptor(stats, uiBgColor);
  const profile = PET_PROFILES[selectedPet];
  const evolution = getPetEvolution(tasksCompletedCount);
  const displayName = petName.trim() || selectedPet;
  const countdown = isSleeping ? formatSleepCountdown(sleepUntil, nowMs) : null;

  useEffect(() => {
    if (!isSleeping || sleepUntil === null) return;
    setNowMs(Date.now());
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isSleeping, sleepUntil]);

  useEffect(() => {
    if (!sleepMenuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (sleepMenuRef.current && !sleepMenuRef.current.contains(e.target as Node)) {
        setSleepMenuOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSleepMenuOpen(false);
    };
    window.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [sleepMenuOpen]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const renderer = new PetCanvasRenderer(canvas, {
      petId: selectedPet,
      animation,
      stats,
      uiBgColor,
      roomInventory,
      roomLayout,
      audioMode,
      reducedMotion,
      isSleeping,
      tasksCompletedCount,
    });
    rendererRef.current = renderer;

    const rect = container.getBoundingClientRect();
    renderer.resize(rect.width, rect.height);
    renderer.start();

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        renderer.resize(entry.contentRect.width, entry.contentRect.height);
      }
    });
    observer.observe(container);

    const emoteSync = window.setInterval(() => {
      const emote = renderer.getPetStateInfo().emote ?? 'none';
      setActiveEmote((prev) => (prev === emote ? prev : emote));
    }, 200);

    return () => {
      window.clearInterval(emoteSync);
      observer.disconnect();
      renderer.stop();
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    rendererRef.current?.updateConfig({
      petId: selectedPet,
      animation,
      stats,
      uiBgColor,
      roomInventory,
      roomLayout,
      audioMode,
      reducedMotion,
      isSleeping,
      tasksCompletedCount,
    });
  }, [selectedPet, animation, stats, uiBgColor, roomInventory, roomLayout, audioMode, isSleeping, tasksCompletedCount]);

  const getNormalizedCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return { nx: 0, ny: 0, nx01: 0.5, ny01: 0.5 };
    }
    const nx01 = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const ny01 = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    return {
      nx: nx01 * 2 - 1,
      ny: ny01 * 2 - 1,
      nx01,
      ny01,
    };
  };

  const getCurrentItemPos = (itemName: string): RoomItemPosition => {
    if (itemName === 'Fish Bowl' && !roomLayout['Fish Bowl']) {
      const table = roomLayout['Cozy Table'] ?? DEFAULT_ROOM_LAYOUT['Cozy Table'];
      return { x: table.x, y: table.y - 0.16 };
    }
    return roomLayout[itemName] ?? DEFAULT_ROOM_LAYOUT[itemName] ?? { x: 0.5, y: 0.8 };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const renderer = rendererRef.current;
    if (!renderer) return;

    const { nx01, ny01 } = getNormalizedCoords(e);
    // Prioritize petting/waking the pet when clicking directly on them
    if (renderer.hitTestPet(nx01, ny01)) {
      return;
    }

    const hitItem = renderer.hitTestFurniture(nx01, ny01);
    if (!hitItem) return;

    const currentPos = getCurrentItemPos(hitItem);
    const oldTable = roomLayout['Cozy Table'] ?? DEFAULT_ROOM_LAYOUT['Cozy Table'];
    const oldBowl = roomLayout['Fish Bowl'] ?? { x: oldTable.x, y: oldTable.y - 0.16 };
    const bowlWasOnTable =
      hitItem === 'Cozy Table' &&
      roomInventory.some((i) => i.toLowerCase() === 'fish bowl') &&
      Math.abs(oldBowl.x - oldTable.x) < 0.1 &&
      Math.abs(oldBowl.y - (oldTable.y - 0.16)) < 0.08;

    draggingRef.current = {
      itemName: hitItem,
      startClientX: e.clientX,
      startClientY: e.clientY,
      offsetX: currentPos.x - nx01,
      offsetY: currentPos.y - ny01,
      latestPos: currentPos,
      moved: false,
      bowlWasOnTable,
    };

    renderer.setDraggingItem(hitItem);
    setCanvasCursor('grabbing');
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore synthetic event environments without pointer capture
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    const { nx, ny, nx01, ny01 } = getNormalizedCoords(e);
    const drag = draggingRef.current;

    if (drag) {
      if (Math.hypot(e.clientX - drag.startClientX, e.clientY - drag.startClientY) > 4) {
        drag.moved = true;
      }
      const nextPos = clampRoomPosition(drag.itemName, {
        x: nx01 + drag.offsetX,
        y: ny01 + drag.offsetY,
      });
      drag.latestPos = nextPos;

      const previewLayout: Record<string, RoomItemPosition> = {
        ...roomLayout,
        [drag.itemName]: nextPos,
      };
      if (drag.bowlWasOnTable) {
        previewLayout['Fish Bowl'] = clampRoomPosition('Fish Bowl', {
          x: nextPos.x,
          y: nextPos.y - 0.16,
        });
      }

      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      renderer.updateConfig({
        petId: selectedPet,
        animation,
        stats,
        uiBgColor,
        roomInventory,
        roomLayout: previewLayout,
        audioMode,
        reducedMotion,
        isSleeping,
        tasksCompletedCount,
      });
      return;
    }

    renderer.setPointer(nx, ny, true);
    const currentEmote = renderer.getPetStateInfo().emote ?? 'none';
    setActiveEmote((prev) => (prev === currentEmote ? prev : currentEmote));

    if (renderer.hitTestPet(nx01, ny01)) {
      renderer.setHoveredItem(null);
      setCanvasCursor('pointer');
    } else {
      const hitItem = renderer.hitTestFurniture(nx01, ny01);
      renderer.setHoveredItem(hitItem);
      setCanvasCursor(hitItem ? 'grab' : 'default');
    }
  };

  const handlePointerEnter = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    const { nx, ny } = getNormalizedCoords(e);
    renderer.setPointer(nx, ny, true);
    renderer.triggerHoverEmote(true);
    const currentEmote = renderer.getPetStateInfo().emote ?? 'none';
    setActiveEmote(currentEmote);
  };

  const finishDrag = (e: React.PointerEvent<HTMLCanvasElement>, commit: boolean) => {
    const drag = draggingRef.current;
    if (!drag) return;
    draggingRef.current = null;
    rendererRef.current?.setDraggingItem(null);

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore synthetic event cleanup errors
    }

    setCanvasCursor('default');

    if (drag.moved && commit) {
      suppressNextClickRef.current = true;
      onMoveFurniture(drag.itemName, drag.latestPos);
    } else {
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      rendererRef.current?.updateConfig({
        petId: selectedPet,
        animation,
        stats,
        uiBgColor,
        roomInventory,
        roomLayout,
        audioMode,
        reducedMotion,
        isSleeping,
        tasksCompletedCount,
      });
    }
  };

  const handlePointerLeave = () => {
    if (draggingRef.current) return;
    rendererRef.current?.setPointer(0, 0, false);
    rendererRef.current?.setHoveredItem(null);
    setCanvasCursor('default');
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }
    const renderer = rendererRef.current;
    if (renderer && e.clientX !== 0 && e.clientY !== 0) {
      const { nx01, ny01 } = getNormalizedCoords(e);
      if (!renderer.hitTestPet(nx01, ny01) && renderer.hitTestFurniture(nx01, ny01)) {
        return;
      }
    }
    renderer?.triggerPetTap();
    if (!isSleeping) {
      onPetTap();
    }
  };

  const hungerTextTone =
    stats.hunger <= 20
      ? 'text-red-700'
      : stats.hunger <= 45
        ? 'text-amber-700'
        : 'text-emerald-700';

  const hungerBarColor =
    stats.hunger <= 20
      ? 'bg-red-600'
      : stats.hunger <= 45
        ? 'bg-amber-500'
        : 'bg-emerald-600';

  const happinessBarColor =
    stats.happiness <= 25
      ? 'bg-red-600'
      : stats.happiness <= 45
        ? 'bg-amber-500'
        : 'bg-blue-600';

  const cursorClass =
    canvasCursor === 'grabbing'
      ? 'cursor-grabbing'
      : canvasCursor === 'grab'
        ? 'cursor-grab'
        : canvasCursor === 'pointer'
          ? 'cursor-pointer'
          : 'cursor-default';

  return (
    <section
      aria-label="Companion 2D room stage and stats"
      className="bg-white border border-zinc-200 rounded-2xl overflow-hidden flex flex-col shadow-sm"
    >
      {/* 2D Room & Pet Canvas Viewport */}
      <div
        ref={containerRef}
        className="relative w-full h-[300px] sm:h-[340px] bg-[#1E1E2E] select-none"
      >
        <canvas
          ref={canvasRef}
          data-testid="pet-canvas"
          data-emote={activeEmote}
          data-sleeping={String(isSleeping)}
          onPointerDown={handlePointerDown}
          onPointerEnter={handlePointerEnter}
          onPointerMove={handlePointerMove}
          onPointerUp={(e) => finishDrag(e, true)}
          onPointerCancel={(e) => finishDrag(e, false)}
          onPointerLeave={handlePointerLeave}
          onClick={handleCanvasClick}
          aria-label={`${displayName} the ${profile.species} currently ${isSleeping ? 'sleeping peacefully' : `showing ${animation.replace(/_/g, ' ')} animation`}. Hover for mood emote, click to pet, or drag furniture.`}
          role="img"
          className={`w-full h-full block touch-none ${cursorClass}`}
        />

        {/* Top-left state readout */}
        <div className="pointer-events-none absolute top-3.5 left-4 max-w-[calc(100%-230px)] sm:max-w-[calc(100%-272px)] flex flex-col gap-0.5 text-xs text-zinc-300">
          <div className="flex items-center gap-1.5 font-medium text-white truncate">
            <span className="truncate">{displayName}</span>
            <span aria-hidden="true" className="text-zinc-400 hidden sm:inline">·</span>
            <span className="text-zinc-300 font-normal hidden sm:inline">{profile.species}</span>
            <span aria-hidden="true" className="text-zinc-400 hidden sm:inline">·</span>
            <span className="text-amber-300 font-mono text-[11px] hidden sm:inline">
              Lv.{evolution.level}
            </span>
          </div>
          <div className="flex items-center gap-1.5 font-mono text-[11px] text-zinc-300/90 truncate">
            <span>{isSleeping ? 'Sleeping' : animation}</span>
            <span aria-hidden="true" className="hidden sm:inline">·</span>
            <span className="hidden sm:inline">
              {isSleeping
                ? countdown
                  ? `${countdown} left`
                  : 'Stats Paused'
                : mood.label}
            </span>
          </div>
        </div>

        {/* Top-right Controls (Sleep Timer, Lo-Fi, Rain, Mute) */}
        <div className="absolute top-2.5 right-3 flex items-center gap-1 sm:gap-1.5">
          <div ref={sleepMenuRef} className="relative">
            {isSleeping ? (
              <button
                type="button"
                onClick={onWakePet}
                aria-label={`Wake ${displayName} up`}
                aria-pressed={true}
                className="min-h-[36px] sm:min-h-[38px] px-2 sm:px-2.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 bg-indigo-600 text-white hover:bg-indigo-500"
              >
                <Sun className="w-3.5 h-3.5" />
                <span>Wake</span>
                {countdown && (
                  <span
                    data-testid="sleep-countdown"
                    className="font-mono text-[11px] text-indigo-100 tabular-nums"
                  >
                    {countdown}
                  </span>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setSleepMenuOpen((open) => !open)}
                aria-label={`Put ${displayName} to sleep so you can work`}
                aria-haspopup="menu"
                aria-expanded={sleepMenuOpen}
                className="min-h-[36px] sm:min-h-[38px] px-2 sm:px-2.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 bg-zinc-900/85 text-zinc-200 hover:bg-zinc-800"
              >
                <Moon className="w-3.5 h-3.5" />
                <span>Sleep</span>
                <ChevronDown className="w-3 h-3 opacity-80" />
              </button>
            )}

            {!isSleeping && sleepMenuOpen && (
              <div
                role="menu"
                aria-label="Choose sleep duration"
                className="absolute right-0 mt-1.5 w-44 bg-white border border-zinc-200 rounded-xl shadow-lg py-1 z-20"
              >
                <div className="px-3 py-1.5 text-[11px] font-medium text-zinc-500 border-b border-zinc-100">
                  Nap Timer
                </div>
                {SLEEP_DURATION_OPTIONS.map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setSleepMenuOpen(false);
                      onStartSleep(mins);
                    }}
                    className="w-full px-3 py-2 text-left text-xs font-medium text-zinc-800 hover:bg-zinc-100 flex items-center justify-between transition-colors"
                  >
                    <span>Sleep {mins} mins</span>
                    <span className="font-mono text-[11px] text-zinc-400">{mins}:00</span>
                  </button>
                ))}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setSleepMenuOpen(false);
                    onStartSleep(null);
                  }}
                  className="w-full px-3 py-2 text-left text-xs font-medium text-zinc-700 hover:bg-zinc-100 border-t border-zinc-100 flex items-center justify-between transition-colors"
                >
                  <span>Until I wake</span>
                  <span className="font-mono text-[11px] text-zinc-400">∞</span>
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onToggleLofi}
            aria-label={audioMode === 'lofi' ? 'Stop Lo-Fi music' : 'Play Lo-Fi music'}
            className={`min-h-[36px] sm:min-h-[38px] px-2 sm:px-2.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
              audioMode === 'lofi'
                ? 'bg-blue-600 text-white hover:bg-blue-500'
                : 'bg-zinc-900/85 text-zinc-200 hover:bg-zinc-800'
            }`}
          >
            <Music className="w-3.5 h-3.5" />
            <span>Lo-Fi</span>
          </button>

          <button
            type="button"
            onClick={onToggleRain}
            aria-label={audioMode === 'rain' ? 'Stop rain sounds' : 'Play rain sounds'}
            className={`min-h-[36px] sm:min-h-[38px] px-2 sm:px-2.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
              audioMode === 'rain'
                ? 'bg-blue-600 text-white hover:bg-blue-500'
                : 'bg-zinc-900/85 text-zinc-200 hover:bg-zinc-800'
            }`}
          >
            <CloudRain className="w-3.5 h-3.5" />
            <span>Rain</span>
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? 'Unmute companion audio' : 'Mute companion audio'}
            className="min-h-[36px] min-w-[36px] sm:min-h-[38px] sm:min-w-[38px] rounded-lg bg-zinc-900/85 text-zinc-200 hover:bg-zinc-800 flex items-center justify-center transition-colors"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>

        <div className="pointer-events-none absolute bottom-2.5 right-4 text-[11px] text-zinc-300/80">
          {isSleeping
            ? countdown
              ? `${displayName} is napping · Wakes in ${countdown}`
              : `${displayName} is resting · Stats paused while you work`
            : roomInventory.length > 0
              ? `Click ${displayName} to pet · Drag items to move`
              : `Click ${displayName} to pet`}
        </div>
      </div>

      {/* Urgent Push Notification Banner (when < 30 Happiness or Hunger) */}
      {pushNotification && (
        <div
          role="status"
          data-testid="push-notification-banner"
          className="px-5 py-2.5 bg-red-50 border-b border-red-200 flex items-center gap-2 text-xs font-medium text-red-800"
        >
          <BellRing className="w-4 h-4 text-red-600 shrink-0" />
          <span>{pushNotification}</span>
        </div>
      )}

      {/* Live Dialogue & Room Inventory Line */}
      <div className="px-5 py-4 border-b border-zinc-200 bg-zinc-50/70 space-y-2">
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs font-medium text-zinc-600">
            {displayName} says
          </span>
          <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono">
            <span
              aria-hidden="true"
              className="w-2.5 h-2.5 rounded-sm border border-zinc-300 inline-block"
              style={{ backgroundColor: uiBgColor }}
            />
            <span>{uiBgColor}</span>
          </div>
        </div>
        <p
          data-testid="pet-dialogue"
          className="text-[15px] leading-relaxed text-zinc-900 font-normal"
        >
          “{dialogue}”
        </p>
        <p className="text-xs text-zinc-500">
          Room inventory:{' '}
          <span className="text-zinc-700 font-medium">
            {roomInventory.length > 0 ? roomInventory.join(' · ') : 'None yet (earn coins or buy in Shop)'}
          </span>
        </p>
      </div>

      {/* Pet Evolution Level & Milestone Progress */}
      <div
        data-testid="evolution-level-indicator"
        className="px-5 py-3 border-b border-zinc-200 bg-white flex items-center justify-between gap-4"
      >
        <div className="flex items-center gap-2 shrink-0">
          <Award
            className={`w-4 h-4 shrink-0 ${
              evolution.level >= 4
                ? 'text-amber-500'
                : evolution.level === 3
                  ? 'text-indigo-600'
                  : evolution.level === 2
                    ? 'text-blue-600'
                    : 'text-zinc-500'
            }`}
          />
          <span className="text-xs font-semibold text-zinc-900">
            Lv.{evolution.level} · {evolution.title}
          </span>
        </div>

        <div className="flex-1 max-w-[200px] h-1.5 bg-zinc-100 rounded-full overflow-hidden">
          <div
            className={`h-full transition-[width] duration-300 ${
              evolution.level >= 4
                ? 'bg-amber-500'
                : evolution.level === 3
                  ? 'bg-indigo-600'
                  : 'bg-blue-600'
            }`}
            style={{ width: `${evolution.progressPct}%` }}
          />
        </div>

        <span className="text-xs font-mono tabular-nums text-zinc-600 shrink-0">
          {evolution.nextMilestone !== null
            ? `${tasksCompletedCount}/${evolution.nextMilestone} tasks`
            : `${tasksCompletedCount} tasks · Max Lv.`}
        </span>
      </div>

      {/* Core Metrics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-zinc-200">
        <div className="p-4">
          <div className="flex items-baseline justify-between gap-2 mb-2">
            <span className="text-xs font-medium text-zinc-600">Happiness</span>
            <span
              data-testid="stat-happiness"
              className="text-sm font-mono font-semibold tabular-nums text-zinc-900"
            >
              {stats.happiness}/100
            </span>
          </div>
          <div className="h-2 w-full bg-zinc-100 rounded-full overflow-hidden">
            <div
              className={`h-full ${happinessBarColor} transition-[width] duration-300`}
              style={{ width: `${stats.happiness}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-zinc-500">
            {stats.happiness >= 70 ? 'Warm & connected' : stats.happiness >= 35 ? 'Wants company' : 'Feeling neglected'}
          </p>
        </div>

        <div className="p-4">
          <div className="flex items-baseline justify-between gap-2 mb-2">
            <span className="text-xs font-medium text-zinc-600">Hunger (Fuel)</span>
            <span
              data-testid="stat-hunger"
              className={`text-sm font-mono font-semibold tabular-nums ${hungerTextTone}`}
            >
              {stats.hunger}/100
            </span>
          </div>
          <div className="h-2 w-full bg-zinc-100 rounded-full overflow-hidden">
            <div
              className={`h-full ${hungerBarColor} transition-[width] duration-300`}
              style={{ width: `${stats.hunger}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-zinc-500">
            {stats.hunger >= 65 ? 'Fed by tasks' : stats.hunger >= 30 ? 'Getting peckish' : 'Starving for focus'}
          </p>
        </div>

        <div className="p-4 flex flex-col justify-between">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-medium text-zinc-600">Focus Coins</span>
            <span className="text-xs text-amber-700 font-medium">+10 / task</span>
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span
              data-testid="wallet-balance"
              className="text-2xl font-mono font-semibold tabular-nums text-zinc-900"
            >
              {walletBalance}
            </span>
            <span className="text-xs text-zinc-500">coins</span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">Say &ldquo;Buy [Item]&rdquo; or open Shop</p>
        </div>
      </div>
    </section>
  );
}
