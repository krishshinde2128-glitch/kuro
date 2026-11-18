/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Lock, Bell } from 'lucide-react';
import { ChatPanel } from './components/ChatPanel';
import { FocusLockModal } from './components/FocusLockModal';
import { JsonInspectorPanel } from './components/JsonInspectorPanel';
import { PetStage } from './components/PetStage';
import { SettingsPanel } from './components/SettingsPanel';
import { SetupScreen } from './components/SetupScreen';
import { TasksAndShopPanel } from './components/TasksAndShopPanel';
import { TreatCatchPanel } from './components/TreatCatchPanel';
import {
  applyBrainResponseToState,
  applyElapsedDecay,
  applyHappinessLevelPreview,
  applyHungerLevelPreview,
  applyMiniGameFeed,
  applyPetTap,
  buildInitializationMessage,
  checkSleepExpiration,
  clampStat,
  clampVolume,
  completeTaskLocally,
  createInitialPetState,
  DEFAULT_ROOM_LAYOUT,
  feedQuickTreatWithCoins,
  getPetEvolution,
  normalizeBrainResponse,
  normalizeRoomInventory,
  purchaseShopItem,
  reconcileMoodWithStats,
  settleAfterPetting,
  toggleSleepMode,
  updateRoomItemPosition,
  updateUserSettings,
} from './game/petState';
import type {
  FocusTask,
  PetAppState,
  PetId,
  RoomItemPosition,
  ShopItem,
} from './game/petState';
import type { TreatRoundRewards } from './game/treatGame';
import { soundEngine } from './game/soundEngine';

const STORAGE_KEY = 'kuro_companion_studio_v3';

type WorkspaceTab = 'companion' | 'tasks' | 'play' | 'json' | 'settings';

function loadSavedState(): PetAppState {
  const params = new URLSearchParams(window.location.search);
  const autostart = params.get('autostart') === '1';

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createInitialPetState({
        initialized: autostart,
        userName: 'Alex',
        petId: 'Kuro',
        petName: 'Kuro',
      });
    }
    const parsed = JSON.parse(raw) as PetAppState;
    if (!parsed || typeof parsed !== 'object' || !parsed.stats || !parsed.selectedPet) {
      return createInitialPetState({
        initialized: autostart,
        userName: 'Alex',
        petId: 'Kuro',
        petName: 'Kuro',
      });
    }
    const cleanInventory = normalizeRoomInventory(parsed.roomInventory, []);
    const hydratedLayout: Record<string, RoomItemPosition> = {
      ...DEFAULT_ROOM_LAYOUT,
      ...(parsed.roomLayout && typeof parsed.roomLayout === 'object' ? parsed.roomLayout : {}),
    };
    const hydrated: PetAppState = {
      ...parsed,
      petName:
        typeof parsed.petName === 'string' && parsed.petName.trim()
          ? parsed.petName.trim()
          : parsed.selectedPet,
      volume:
        typeof parsed.volume === 'number' ? clampVolume(parsed.volume, 0.85) : 0.85,
      isSleeping: Boolean(parsed.isSleeping),
      sleepUntil:
        typeof parsed.sleepUntil === 'number' && Number.isFinite(parsed.sleepUntil)
          ? parsed.sleepUntil
          : null,
      roomInventory: cleanInventory,
      roomLayout: hydratedLayout,
    };
    const elapsedMinutes = Math.max(
      0,
      Math.floor((Date.now() - (hydrated.lastUpdatedAt || Date.now())) / 60000)
    );
    const decayed = applyElapsedDecay(hydrated, elapsedMinutes);
    const expiredChecked = checkSleepExpiration(decayed, Date.now());
    const reconciled = reconcileMoodWithStats(expiredChecked);
    return autostart ? { ...reconciled, initialized: true } : reconciled;
  } catch {
    return createInitialPetState({
      initialized: autostart,
      userName: 'Alex',
      petId: 'Kuro',
      petName: 'Kuro',
    });
  }
}

export default function App() {
  const [petState, setPetState] = useState<PetAppState>(() => loadSavedState());
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('companion');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusLockOpen, setFocusLockOpen] = useState(false);
  const [audioMode, setAudioMode] = useState<'lofi' | 'rain' | 'none'>('none');
  const [muted, setMuted] = useState(false);
  const [notifPermission, setNotifPermission] = useState<string>(() =>
    typeof window !== 'undefined' && 'Notification' in window
      ? window.Notification.permission
      : 'unsupported'
  );

  const inFlightRef = useRef(0);
  const petSettleTimerRef = useRef<number | null>(null);
  const lastAttemptRef = useRef<{
    text: string;
    completedTaskTitle?: string;
    alreadyCredited?: boolean;
    hideUserMessage?: boolean;
    overrideUserName?: string;
    overridePetId?: PetId;
    overridePetName?: string;
  } | null>(null);
  const stateRef = useRef(petState);
  stateRef.current = petState;

  useEffect(() => {
    soundEngine.setVolume(petState.volume);
  }, [petState.volume]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(petState));
    } catch {
      // Ignore storage quota errors
    }
    document.body.dataset.initialized = String(petState.initialized);
    document.body.dataset.pet = petState.selectedPet;
    document.body.dataset.petName = petState.petName;
    document.body.dataset.userName = petState.userName;
    document.body.dataset.animation = petState.currentAnimation;
    document.body.dataset.bgColor = petState.uiBgColor;
    document.body.dataset.happiness = String(petState.stats.happiness);
    document.body.dataset.hunger = String(petState.stats.hunger);
    document.body.dataset.coins = String(petState.walletBalance);
    document.body.dataset.volume = String(petState.volume);
    document.body.dataset.sleeping = String(petState.isSleeping);
    document.body.dataset.sleepUntil = petState.sleepUntil ? String(petState.sleepUntil) : '';
    document.body.dataset.level = String(getPetEvolution(petState.tasksCompletedCount).level);
    document.body.dataset.audio = audioMode;
    document.body.dataset.notification = petState.pushNotification ?? '';
  }, [petState, audioMode]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setPetState((prev) => applyElapsedDecay(prev, 5));
    }, 300000);
    return () => window.clearInterval(interval);
  }, []);

  // Automatically wake companion when a timed nap finishes
  useEffect(() => {
    if (!petState.isSleeping || petState.sleepUntil === null) return;
    const remainingMs = Math.max(0, petState.sleepUntil - Date.now());
    const wakeTimer = window.setTimeout(() => {
      soundEngine.playPurrChirp();
      setPetState((prev) => checkSleepExpiration(prev, Date.now()));
    }, remainingMs);
    return () => window.clearTimeout(wakeTimer);
  }, [petState.isSleeping, petState.sleepUntil]);

  useEffect(() => {
    return () => {
      if (petSettleTimerRef.current !== null) {
        window.clearTimeout(petSettleTimerRef.current);
      }
      soundEngine.stopLofi();
      soundEngine.stopRain();
    };
  }, []);

  const triggerDesktopNotification = useCallback((message: string | null, petLabel: string) => {
    if (!message) return;
    if (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      window.Notification.permission === 'granted'
    ) {
      try {
        new window.Notification(`${petLabel} Alert`, { body: message });
      } catch {
        // Ignore browser notification restrictions
      }
    }
  }, []);

  const interactWithPet = useCallback(
    async (
      text: string,
      options?: {
        completedTaskTitle?: string;
        alreadyCredited?: boolean;
        hideUserMessage?: boolean;
        overrideUserName?: string;
        overridePetId?: PetId;
        overridePetName?: string;
      }
    ) => {
      const snapshot = stateRef.current;
      const activeUserName = options?.overrideUserName ?? snapshot.userName;
      const activePetId = options?.overridePetId ?? snapshot.selectedPet;
      const activePetName = options?.overridePetName ?? snapshot.petName;

      lastAttemptRef.current = {
        text,
        completedTaskTitle: options?.completedTaskTitle,
        alreadyCredited: options?.alreadyCredited,
        hideUserMessage: options?.hideUserMessage,
        overrideUserName: activeUserName,
        overridePetId: activePetId,
        overridePetName: activePetName,
      };

      inFlightRef.current += 1;
      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch('/api/pet/interact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userName: activeUserName,
            petName: activePetName,
            selectedPet: activePetId,
            message: text,
            currentStats: snapshot.stats,
            walletBalance: snapshot.walletBalance,
            roomInventory: snapshot.roomInventory,
            completedTaskTitle: options?.completedTaskTitle,
            alreadyCredited: options?.alreadyCredited,
            recentHistory: snapshot.chatHistory.slice(-6).map((m) => ({
              role: m.role,
              text: m.text,
            })),
          }),
        });

        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            typeof payload?.error === 'string'
              ? payload.error
              : `Server responded with status ${res.status}`
          );
        }

        const brainResponse = normalizeBrainResponse(payload, {
          petName: activePetName,
          selectedPet: activePetId,
          stats: snapshot.stats,
          walletBalance: snapshot.walletBalance,
          roomInventory: snapshot.roomInventory,
        });

        if (!options?.alreadyCredited) {
          const coinsGained = brainResponse.user_wallet_balance - snapshot.walletBalance;
          if (coinsGained > 0) {
            soundEngine.playCoinEarned();
          } else if (brainResponse.pet_animation === 'Angry_Hiss') {
            soundEngine.playAlertTone();
          } else {
            soundEngine.playPurrChirp();
          }
        }

        const nextAudio = soundEngine.applyCommand(brainResponse.audio_command);
        setAudioMode(nextAudio);
        triggerDesktopNotification(brainResponse.push_notification_trigger, activePetName);

        setPetState((prev) =>
          applyBrainResponseToState(prev, text, brainResponse, Date.now(), {
            completedTaskTitle: options?.completedTaskTitle,
            hideUserMessage: options?.hideUserMessage,
            alreadyCredited: options?.alreadyCredited,
          })
        );
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : `Could not communicate with ${activePetName}.`;
        setError(message);
      } finally {
        inFlightRef.current = Math.max(0, inFlightRef.current - 1);
        if (inFlightRef.current === 0) {
          setIsLoading(false);
        }
      }
    },
    [triggerDesktopNotification]
  );

  const handleCompleteSetup = (userName: string, petId: PetId, petName: string) => {
    const fresh = createInitialPetState({
      initialized: true,
      userName,
      petId,
      petName,
      volume: petState.volume,
    });
    stateRef.current = fresh;
    setPetState(fresh);
    setActiveTab('companion');
    setError(null);
    soundEngine.playPurrChirp();

    const initCmd = buildInitializationMessage(userName, petId, petName);
    void interactWithPet(initCmd, {
      hideUserMessage: false,
      overrideUserName: userName,
      overridePetId: petId,
      overridePetName: petName,
    });
  };

  const handleRetryLast = () => {
    if (lastAttemptRef.current && !isLoading) {
      const last = lastAttemptRef.current;
      void interactWithPet(last.text, {
        completedTaskTitle: last.completedTaskTitle,
        alreadyCredited: last.alreadyCredited,
        hideUserMessage: last.hideUserMessage,
        overrideUserName: last.overrideUserName,
        overridePetId: last.overridePetId,
        overridePetName: last.overridePetName,
      });
    }
  };

  const handleSaveSettings = (updates: {
    userName: string;
    petName: string;
    selectedPet: PetId;
    volume: number;
  }) => {
    soundEngine.setVolume(updates.volume);
    soundEngine.playPurrChirp();
    setError(null);
    setPetState((prev) => {
      const next = updateUserSettings(prev, updates);
      stateRef.current = next;
      return next;
    });
  };

  const handleVolumePreview = (volume: number) => {
    const clamped = clampVolume(volume, 0.85);
    soundEngine.setVolume(clamped);
    setPetState((prev) => ({
      ...prev,
      volume: clamped,
    }));
  };

  const handleTestAudio = () => {
    if (muted) {
      setMuted(false);
      soundEngine.setMuted(false);
    }
    soundEngine.playCoinEarned();
  };

  const handleAddTask = (title: string) => {
    const newTask: FocusTask = {
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title,
      completed: false,
      createdAt: new Date().toISOString(),
    };
    setPetState((prev) => ({
      ...prev,
      tasks: [newTask, ...prev.tasks],
      lastUpdatedAt: Date.now(),
    }));
  };

  const handleCompleteTask = (task: FocusTask) => {
    const { state: nextState, completedTask } = completeTaskLocally(stateRef.current, task.id);
    if (!completedTask) return;

    stateRef.current = nextState;
    setPetState(nextState);
    soundEngine.playCoinEarned();

    void interactWithPet(`I just completed my task: "${completedTask.title}"`, {
      completedTaskTitle: completedTask.title,
      alreadyCredited: true,
    });
  };

  const handleDeleteTask = (taskId: string) => {
    setPetState((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((t) => t.id !== taskId),
      lastUpdatedAt: Date.now(),
    }));
  };

  const handleBuyItem = (item: ShopItem) => {
    const result = purchaseShopItem(stateRef.current, item);
    if (!result.ok) {
      setError(result.reason ?? 'Unable to purchase item.');
      return;
    }
    soundEngine.playCoinEarned();
    setPetState(result.state);
  };

  const handleQuickSnack = (): { ok: boolean; reason?: string } => {
    const result = feedQuickTreatWithCoins(stateRef.current);
    if (!result.ok) {
      return { ok: false, reason: result.reason };
    }
    stateRef.current = result.state;
    setPetState(result.state);
    return { ok: true };
  };

  const handleCompleteMiniGame = (rewards: TreatRoundRewards) => {
    setPetState((prev) => {
      const next = applyMiniGameFeed(prev, rewards);
      stateRef.current = next;
      return next;
    });
  };

  const handlePetTap = () => {
    if (stateRef.current.isSleeping) return;
    soundEngine.playPurrChirp();
    setPetState((prev) => applyPetTap(prev));

    if (petSettleTimerRef.current !== null) {
      window.clearTimeout(petSettleTimerRef.current);
    }
    petSettleTimerRef.current = window.setTimeout(() => {
      petSettleTimerRef.current = null;
      setPetState((prev) => settleAfterPetting(prev));
    }, 1200);
  };

  const handleToggleLofi = () => {
    if (audioMode === 'lofi') {
      soundEngine.stopLofi();
      setAudioMode('none');
    } else {
      if (muted) {
        setMuted(false);
        soundEngine.setMuted(false);
      }
      soundEngine.stopRain();
      soundEngine.startLofi();
      setAudioMode('lofi');
    }
  };

  const handleToggleRain = () => {
    if (audioMode === 'rain') {
      soundEngine.stopRain();
      setAudioMode('none');
    } else {
      if (muted) {
        setMuted(false);
        soundEngine.setMuted(false);
      }
      soundEngine.stopLofi();
      soundEngine.startRain();
      setAudioMode('rain');
    }
  };

  const handleToggleMute = () => {
    const nextMuted = !muted;
    setMuted(nextMuted);
    soundEngine.setMuted(nextMuted);
    if (nextMuted) {
      setAudioMode('none');
    }
  };

  const handleEnableNotifications = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    try {
      const perm = await window.Notification.requestPermission();
      setNotifPermission(perm);
    } catch {
      // Ignore permission rejection
    }
  };

  const handleUnlockFocusLock = (completedSession: boolean) => {
    setFocusLockOpen(false);
    if (completedSession) {
      soundEngine.playCoinEarned();
      setPetState((prev) => ({
        ...prev,
        stats: {
          happiness: clampStat(prev.stats.happiness + 8),
          hunger: clampStat(prev.stats.hunger + 5),
        },
        currentAnimation: 'Happy_Bounce',
        uiBgColor: '#D4AF37',
        lastDialogue: `You made it through two full minutes of calm focus, ${prev.userName}! Ready to keep rolling together?`,
        lastUpdatedAt: Date.now(),
      }));
    } else {
      setPetState((prev) => ({
        ...prev,
        currentAnimation: 'Idle',
        lastUpdatedAt: Date.now(),
      }));
    }
  };

  const handleResetSetup = () => {
    soundEngine.stopLofi();
    soundEngine.stopRain();
    setAudioMode('none');
    setError(null);
    setPetState((prev) =>
      createInitialPetState({
        initialized: false,
        userName: prev.userName,
        petId: prev.selectedPet,
        petName: prev.petName,
        volume: prev.volume,
      })
    );
  };

  if (!petState.initialized) {
    return (
      <SetupScreen
        defaultName={petState.userName === 'Alex' ? '' : petState.userName}
        defaultPet={petState.selectedPet}
        defaultPetName={petState.petName}
        onStart={handleCompleteSetup}
      />
    );
  }

  const isLightBackdrop = petState.uiBgColor === '#D4AF37';

  return (
    <div
      className="min-h-screen flex flex-col transition-colors duration-500"
      style={{ backgroundColor: petState.uiBgColor }}
    >
      {/* Strict 3-Zone Top Bar */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-8">
          <a
            href="#top"
            className="text-sm sm:text-lg font-bold tracking-tight text-zinc-900 whitespace-nowrap truncate max-w-[68px] sm:max-w-[160px] shrink-0"
          >
            {petState.petName}
          </a>

          <nav aria-label="Workspace views" className="flex items-center gap-2 sm:gap-5">
            {(
              [
                { id: 'companion', label: 'Companion', shortLabel: 'Chat' },
                { id: 'tasks', label: 'Tasks & Shop', shortLabel: 'Tasks' },
                { id: 'play', label: 'Feed Game', shortLabel: 'Play' },
                { id: 'json', label: 'Brain JSON', shortLabel: 'JSON' },
                { id: 'settings', label: 'Settings', shortLabel: 'Settings' },
              ] as const
            ).map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`min-h-[40px] px-0.5 sm:px-1 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'border-blue-600 text-zinc-900'
                      : 'border-transparent text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.shortLabel}</span>
                </button>
              );
            })}
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              onClick={() => setFocusLockOpen(true)}
              aria-label="Activate Focus Lock"
              className="min-h-[38px] min-w-[38px] sm:min-h-[40px] px-2.5 sm:px-4 py-2 rounded-lg bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-800 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Lock className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Focus Lock</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main
        id="top"
        className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: 2D Pet Stage & Vital Stats */}
          <div className="lg:col-span-6 space-y-3">
            <PetStage
              selectedPet={petState.selectedPet}
              petName={petState.petName}
              animation={petState.currentAnimation}
              stats={petState.stats}
              walletBalance={petState.walletBalance}
              uiBgColor={petState.uiBgColor}
              roomInventory={petState.roomInventory}
              roomLayout={petState.roomLayout}
              dialogue={petState.lastDialogue}
              pushNotification={petState.pushNotification}
              audioMode={audioMode}
              muted={muted}
              isSleeping={petState.isSleeping}
              sleepUntil={petState.sleepUntil}
              tasksCompletedCount={petState.tasksCompletedCount}
              onToggleMute={handleToggleMute}
              onToggleLofi={handleToggleLofi}
              onToggleRain={handleToggleRain}
              onStartSleep={(durationMinutes) => {
                soundEngine.playPurrChirp();
                setPetState((prev) => toggleSleepMode(prev, true, Date.now(), durationMinutes));
              }}
              onWakePet={() => {
                soundEngine.playPurrChirp();
                setPetState((prev) => toggleSleepMode(prev, false, Date.now()));
              }}
              onPetTap={handlePetTap}
              onMoveFurniture={(itemName, pos) =>
                setPetState((prev) => updateRoomItemPosition(prev, itemName, pos))
              }
            />

            <div
              className={`px-1 flex flex-wrap items-center justify-between gap-3 text-xs ${
                isLightBackdrop ? 'text-zinc-900' : 'text-zinc-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <span>{petState.userName}</span>
                <span aria-hidden="true">·</span>
                <span>
                  Tasks:{' '}
                  <strong className="font-mono tabular-nums">
                    {petState.tasksCompletedCount}
                  </strong>
                </span>
              </div>

              <div className="flex items-center gap-3">
                {notifPermission === 'default' && (
                  <button
                    type="button"
                    onClick={handleEnableNotifications}
                    className="min-h-[32px] px-2 text-xs flex items-center gap-1 underline-offset-2 hover:underline"
                  >
                    <Bell className="w-3.5 h-3.5" />
                    <span>Enable Alerts</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActiveTab('settings')}
                  className="min-h-[32px] px-2 text-xs underline-offset-2 hover:underline transition-colors"
                >
                  User Settings
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Active Workspace Panel */}
          <div className="lg:col-span-6">
            {activeTab === 'companion' && (
              <ChatPanel
                petName={petState.petName}
                messages={petState.chatHistory}
                isLoading={isLoading}
                error={error}
                onSendMessage={(text) => {
                  void interactWithPet(text);
                }}
                onRetryLast={handleRetryLast}
              />
            )}

            {activeTab === 'tasks' && (
              <TasksAndShopPanel
                petName={petState.petName}
                tasks={petState.tasks}
                walletBalance={petState.walletBalance}
                roomInventory={petState.roomInventory}
                onAddTask={handleAddTask}
                onCompleteTask={handleCompleteTask}
                onDeleteTask={handleDeleteTask}
                onBuyItem={handleBuyItem}
                onOpenPlay={() => setActiveTab('play')}
              />
            )}

            {activeTab === 'play' && (
              <TreatCatchPanel
                petName={petState.petName}
                hunger={petState.stats.hunger}
                walletBalance={petState.walletBalance}
                onQuickSnack={handleQuickSnack}
                onCompleteMiniGame={handleCompleteMiniGame}
                onGoToChat={() => setActiveTab('companion')}
              />
            )}

            {activeTab === 'json' && (
              <JsonInspectorPanel
                lastResponse={petState.lastBrainResponse}
                currentAnimation={petState.currentAnimation}
                currentBgColor={petState.uiBgColor}
                currentHappiness={petState.stats.happiness}
                currentHunger={petState.stats.hunger}
                onPreviewAnimation={(anim) =>
                  setPetState((prev) => {
                    if (anim === 'Angry_Hiss') return applyHappinessLevelPreview(prev, 15);
                    if (anim === 'Sad_Ears_Down') return applyHappinessLevelPreview(prev, 35);
                    if (anim === 'Happy_Bounce') return applyHappinessLevelPreview(prev, 85);
                    if (anim === 'Idle') return applyHappinessLevelPreview(prev, 60);
                    return {
                      ...prev,
                      currentAnimation: anim,
                      lastBrainResponse: {
                        ...prev.lastBrainResponse,
                        pet_animation: anim,
                      },
                    };
                  })
                }
                onPreviewBgColor={(color) =>
                  setPetState((prev) => {
                    if (color === '#8B0000') return applyHappinessLevelPreview(prev, 15);
                    if (color === '#1F2937') return applyHappinessLevelPreview(prev, 35);
                    if (color === '#1E1E2E') return applyHappinessLevelPreview(prev, 60);
                    if (color === '#D4AF37') return applyHappinessLevelPreview(prev, 85);
                    return {
                      ...prev,
                      uiBgColor: color,
                      lastBrainResponse: {
                        ...prev.lastBrainResponse,
                        ui_bg_color: color,
                      },
                    };
                  })
                }
                onPreviewHappiness={(happiness) =>
                  setPetState((prev) => {
                    const next = applyHappinessLevelPreview(prev, happiness);
                    if (prev.currentAnimation !== next.currentAnimation) {
                      if (next.currentAnimation === 'Angry_Hiss') {
                        soundEngine.playAlertTone();
                      } else if (next.currentAnimation === 'Happy_Bounce') {
                        soundEngine.playPurrChirp();
                      }
                    }
                    return next;
                  })
                }
                onPreviewHunger={(hunger) =>
                  setPetState((prev) => {
                    const next = applyHungerLevelPreview(prev, hunger);
                    if (prev.currentAnimation !== next.currentAnimation) {
                      if (next.currentAnimation === 'Angry_Hiss') {
                        soundEngine.playAlertTone();
                      } else if (next.currentAnimation === 'Happy_Bounce') {
                        soundEngine.playCoinEarned();
                      }
                    }
                    return next;
                  })
                }
              />
            )}

            {activeTab === 'settings' && (
              <SettingsPanel
                userName={petState.userName}
                petName={petState.petName}
                selectedPet={petState.selectedPet}
                volume={petState.volume}
                muted={muted}
                onSaveSettings={handleSaveSettings}
                onVolumePreview={handleVolumePreview}
                onTestAudio={handleTestAudio}
                onResetSetup={handleResetSetup}
              />
            )}
          </div>
        </div>
      </main>

      <FocusLockModal open={focusLockOpen} onUnlock={handleUnlockFocusLock} />
    </div>
  );
}
