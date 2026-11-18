export const PET_IDS = ['Kuro', 'Barnaby', 'Bloop', 'Rex', 'Otto'] as const;
export type PetId = (typeof PET_IDS)[number];

export interface PetProfile {
  id: PetId;
  title: string;
  species: string;
  tagline: string;
  initialDialogue: string;
}

export const PET_PROFILES: Record<PetId, PetProfile> = {
  Kuro: {
    id: 'Kuro',
    title: 'Kuro the Cat',
    species: 'Cyber-Cat',
    tagline: 'Sarcastic but deeply empathetic. Purrs when you are sad.',
    initialDialogue:
      'Finish a real task to feed me—and if today gets heavy, just tell me. Even a cyber-cat knows when you need a quiet purr.',
  },
  Barnaby: {
    id: 'Barnaby',
    title: 'Barnaby the Dog',
    species: 'Golden Retriever',
    tagline: 'Endlessly positive, fiercely loyal, gets anxious if you are stressed.',
    initialDialogue:
      "Hi best friend! Whether we crush ten tasks today or you just need someone in your corner, I'm right here wagging my tail for you!",
  },
  Bloop: {
    id: 'Bloop',
    title: 'Bloop the Alien',
    species: 'Shape-Shifting Alien',
    tagline: 'Innocent, changes shapes, absorbs your negative energy.',
    initialDialogue:
      'Bloop-bloop! Feed me completed human tasks and I will wiggle happily—or let me squish next to you and absorb any bad vibes!',
  },
  Rex: {
    id: 'Rex',
    title: 'Rex the Shepherd',
    species: 'German Shepherd Puppy',
    tagline: 'Brave, alert, fiercely protective, with big perked puppy ears.',
    initialDialogue:
      "Arf! Ready to guard your desk and tackle today's missions together—and if anything feels heavy, I'll stand watch right beside you!",
  },
  Otto: {
    id: 'Otto',
    title: 'Otto the Dachshund',
    species: 'Dachshund',
    tagline: 'Plucky, affectionate, low-slung sausage dog who burrows close when you need comfort.',
    initialDialogue:
      "Yap! Short legs, big heart! Feed me real-world tasks and I'll trot right beside your keyboard all day!",
  },
};

export const VALID_ANIMATIONS = [
  'Idle',
  'Happy_Bounce',
  'Sad_Ears_Down',
  'Angry_Hiss',
  'Comforting_Nuzzle',
] as const;

export type PetAnimation = (typeof VALID_ANIMATIONS)[number];

export const VALID_AUDIO_COMMANDS = [
  'play_lofi',
  'stop_lofi',
  'play_rain_sounds',
  'none',
] as const;

export type AudioCommand = (typeof VALID_AUDIO_COMMANDS)[number];

export const MOOD_BG_COLORS = {
  default: '#1E1E2E',
  angry: '#8B0000',
  sad: '#1F2937',
  excited: '#D4AF37',
} as const;

export const VALID_BG_COLORS = [
  '#1E1E2E',
  '#8B0000',
  '#1F2937',
  '#D4AF37',
] as const;

export type MoodBgColor = (typeof VALID_BG_COLORS)[number];

export interface PetStats {
  happiness: number;
  hunger: number;
}

export interface PetBrainResponse {
  pet_dialogue: string;
  pet_animation: PetAnimation;
  audio_command: AudioCommand;
  ui_bg_color: MoodBgColor;
  user_wallet_balance: number;
  room_inventory: string[];
  updated_stats: PetStats;
  push_notification_trigger: string | null;
}

export interface ChatEntry {
  id: string;
  role: 'user' | 'pet';
  petName?: string;
  text: string;
  timestamp: string;
  animation?: PetAnimation;
  audioCommand?: AudioCommand;
  bgColor?: MoodBgColor;
  coinsDelta?: number;
  notification?: string | null;
  rawJson?: PetBrainResponse;
}

export interface FocusTask {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
  completedAt?: string;
}

export interface RoomItemPosition {
  x: number;
  y: number;
}

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  cost: number;
  category: 'floor' | 'tabletop' | 'ceiling';
  requiresItem?: string;
}

export const SHOP_ITEMS: ShopItem[] = [
  {
    id: 'soft_rug',
    name: 'Soft Rug',
    description: 'Woven center studio rug for cozy paws and lounging.',
    cost: 15,
    category: 'floor',
  },
  {
    id: 'beanbag_chair',
    name: 'Beanbag Chair',
    description: 'Plush corner beanbag where your pet curls up for sleepy naps.',
    cost: 20,
    category: 'floor',
  },
  {
    id: 'potted_plant',
    name: 'Potted Plant',
    description: 'Terracotta planter with lush monstera leaves.',
    cost: 25,
    category: 'floor',
  },
  {
    id: 'cozy_table',
    name: 'Cozy Table',
    description: 'Sturdy wooden study table with flat surface for desk decor.',
    cost: 30,
    category: 'floor',
  },
  {
    id: 'warm_lamp',
    name: 'Warm Floor Lamp',
    description: 'Tall amber-shaded floor lamp casting a warm study glow.',
    cost: 35,
    category: 'floor',
  },
  {
    id: 'disco_ball',
    name: 'Disco Ball',
    description: 'Mirror-faceted ceiling orb for victory celebrations.',
    cost: 40,
    category: 'ceiling',
  },
  {
    id: 'fish_bowl',
    name: 'Fish Bowl',
    description: 'Glass globe aquarium with a tiny goldfish (sits on Cozy Table).',
    cost: 45,
    category: 'tabletop',
    requiresItem: 'Cozy Table',
  },
  {
    id: 'bookshelf',
    name: 'Bookshelf',
    description: 'Tall wooden bookcase stocked with study guides and novels.',
    cost: 55,
    category: 'floor',
  },
];

export const DEFAULT_ROOM_LAYOUT: Record<string, RoomItemPosition> = {
  'Soft Rug': { x: 0.5, y: 0.84 },
  'Beanbag Chair': { x: 0.17, y: 0.81 },
  'Potted Plant': { x: 0.31, y: 0.78 },
  'Cozy Table': { x: 0.81, y: 0.79 },
  'Warm Floor Lamp': { x: 0.67, y: 0.76 },
  'Disco Ball': { x: 0.5, y: 0.12 },
  'Fish Bowl': { x: 0.81, y: 0.63 },
  Bookshelf: { x: 0.09, y: 0.75 },
};

export interface PetAppState {
  initialized: boolean;
  userName: string;
  petName: string;
  selectedPet: PetId;
  volume: number;
  isSleeping: boolean;
  sleepUntil: number | null;
  stats: PetStats;
  walletBalance: number;
  currentAnimation: PetAnimation;
  audioCommand: AudioCommand;
  uiBgColor: MoodBgColor;
  roomInventory: string[];
  roomLayout: Record<string, RoomItemPosition>;
  lastDialogue: string;
  pushNotification: string | null;
  lastBrainResponse: PetBrainResponse;
  tasks: FocusTask[];
  tasksCompletedCount: number;
  chatHistory: ChatEntry[];
  lastUpdatedAt: number;
}

export function clampStat(value: unknown, fallback = 50): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.min(100, Math.round(num)));
}

export function clampVolume(value: unknown, fallback = 0.85): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.min(1, Number(num.toFixed(2))));
}

export function normalizeWalletBalance(value: unknown, fallback = 0): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return Math.max(0, Math.round(fallback));
  return Math.max(0, Math.round(num));
}

export function normalizePetId(value: unknown): PetId {
  if (typeof value === 'string') {
    const found = PET_IDS.find((p) => p.toLowerCase() === value.trim().toLowerCase());
    if (found) return found;
  }
  return 'Kuro';
}

export function normalizeAnimation(value: unknown): PetAnimation {
  if (typeof value === 'string') {
    const cleaned = value.trim();
    const exact = VALID_ANIMATIONS.find((a) => a === cleaned);
    if (exact) return exact;
    const lower = cleaned.toLowerCase();
    const ci = VALID_ANIMATIONS.find((a) => a.toLowerCase() === lower);
    if (ci) return ci;
    if (lower.includes('sad') || lower.includes('ear')) return 'Sad_Ears_Down';
    if (lower.includes('angr') || lower.includes('hiss')) return 'Angry_Hiss';
    if (lower.includes('comf') || lower.includes('nuzz')) return 'Comforting_Nuzzle';
    if (lower.includes('happ') || lower.includes('bounc')) return 'Happy_Bounce';
  }
  return 'Idle';
}

export function normalizeAudioCommand(value: unknown): AudioCommand {
  if (typeof value === 'string') {
    const cleaned = value.trim().toLowerCase();
    if (cleaned === 'play_lofi' || cleaned === 'play_lofi_music') return 'play_lofi';
    if (cleaned === 'stop_lofi') return 'stop_lofi';
    if (cleaned === 'play_rain_sounds' || cleaned.includes('rain')) return 'play_rain_sounds';
    if (cleaned === 'none' || cleaned === 'null' || cleaned === '') return 'none';
  }
  return 'none';
}

export function normalizeBgColor(value: unknown): MoodBgColor {
  if (typeof value === 'string') {
    const upper = value.trim().toUpperCase();
    const exact = VALID_BG_COLORS.find((c) => c === upper);
    if (exact) return exact;
  }
  return '#1E1E2E';
}

export function normalizeNotificationTrigger(
  value: unknown,
  stats: PetStats,
  petLabel: string
): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed && trimmed.toLowerCase() !== 'null' && trimmed.toLowerCase() !== 'none') {
      return trimmed;
    }
  }
  if (stats.hunger < 30) {
    return `${petLabel} is starving! Complete a task to feed them.`;
  }
  if (stats.happiness < 30) {
    return `${petLabel} misses you and feels lonely!`;
  }
  return null;
}

export function normalizeRoomInventory(value: unknown, fallback: string[] = []): string[] {
  const source = Array.isArray(value) ? value : fallback;
  const canonicalNames = SHOP_ITEMS.map((i) => i.name);
  const deduped: string[] = [];
  for (const rawItem of source) {
    if (typeof rawItem !== 'string') continue;
    const trimmed = rawItem.trim();
    if (!trimmed) continue;
    if (trimmed.toLowerCase() === 'fish pond') continue;
    const canonical =
      canonicalNames.find((name) => name.toLowerCase() === trimmed.toLowerCase()) ?? trimmed;
    if (!deduped.some((existing) => existing.toLowerCase() === canonical.toLowerCase())) {
      deduped.push(canonical);
    }
  }
  // Enforce item prerequisites (e.g., Fish Bowl requires Cozy Table)
  return deduped.filter((itemName) => {
    const def = SHOP_ITEMS.find((i) => i.name.toLowerCase() === itemName.toLowerCase());
    if (!def?.requiresItem) return true;
    return deduped.some((owned) => owned.toLowerCase() === def.requiresItem!.toLowerCase());
  });
}

export function normalizeBrainResponse(
  raw: unknown,
  previousState: {
    petName?: string;
    selectedPet?: PetId;
    stats: PetStats;
    walletBalance: number;
    roomInventory: string[];
  }
): PetBrainResponse {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const rawStats = (obj.updated_stats && typeof obj.updated_stats === 'object'
    ? obj.updated_stats
    : {}) as Record<string, unknown>;

  const dialogue =
    typeof obj.pet_dialogue === 'string' && obj.pet_dialogue.trim().length > 0
      ? obj.pet_dialogue.trim()
      : "I'm right here beside you. Tell me how you're feeling or what you're tackling next.";

  const nextStats: PetStats = {
    happiness: clampStat(rawStats.happiness, previousState.stats.happiness),
    hunger: clampStat(rawStats.hunger, previousState.stats.hunger),
  };

  // Low hunger pulls happiness low as well (keeping the two stats distinct)
  if (
    nextStats.hunger <= 25 &&
    nextStats.happiness > 25 &&
    nextStats.hunger <= previousState.stats.hunger
  ) {
    nextStats.happiness =
      nextStats.hunger <= 17 ? nextStats.hunger + 6 : Math.max(6, nextStats.hunger - 6);
  }

  let nextAnimation = normalizeAnimation(obj.pet_animation);
  let nextBgColor = normalizeBgColor(obj.ui_bg_color);

  // Enforce emotional threshold rules so very low happiness always reads as mad/angry
  if (nextStats.happiness <= 25) {
    nextAnimation = 'Angry_Hiss';
    nextBgColor = '#8B0000';
  } else if (nextStats.happiness <= 45) {
    if (nextBgColor === '#1E1E2E' || nextBgColor === '#D4AF37') {
      nextBgColor = '#1F2937';
    }
    if (nextAnimation === 'Idle' || nextAnimation === 'Happy_Bounce') {
      nextAnimation = 'Sad_Ears_Down';
    }
  }

  const label = previousState.petName?.trim() || previousState.selectedPet || 'Kuro';

  return {
    pet_dialogue: dialogue,
    pet_animation: nextAnimation,
    audio_command: normalizeAudioCommand(obj.audio_command),
    ui_bg_color: nextBgColor,
    user_wallet_balance: normalizeWalletBalance(
      obj.user_wallet_balance,
      previousState.walletBalance
    ),
    room_inventory: normalizeRoomInventory(obj.room_inventory, previousState.roomInventory),
    updated_stats: nextStats,
    push_notification_trigger: normalizeNotificationTrigger(
      obj.push_notification_trigger,
      nextStats,
      label
    ),
  };
}

export function buildInitializationMessage(
  userName: string,
  petId: PetId,
  petName?: string
): string {
  const profile = PET_PROFILES[petId];
  const customName = petName?.trim();
  if (customName && customName.toLowerCase() !== petId.toLowerCase()) {
    return `Initialize companion: My name is ${userName.trim()}, and I choose ${profile.title}, whom I named "${customName}".`;
  }
  return `Initialize companion: My name is ${userName.trim()}, and I choose ${profile.title}.`;
}

export function completeTaskLocally(
  prev: PetAppState,
  taskId: string,
  now = Date.now()
): { state: PetAppState; completedTask: FocusTask | null } {
  const target = prev.tasks.find((t) => t.id === taskId);
  if (!target || target.completed) {
    return { state: prev, completedTask: null };
  }

  const completedIso = new Date(now).toISOString();
  const nextTasks = prev.tasks.map((t) =>
    t.id === taskId ? { ...t, completed: true, completedAt: completedIso } : t
  );
  const nextWallet = prev.walletBalance + 10;
  const nextHunger = clampStat(prev.stats.hunger + 15);
  const nextHappiness = clampStat(prev.stats.happiness + 8);
  const nextStats = { happiness: nextHappiness, hunger: nextHunger };
  const nextCompletedCount = prev.tasksCompletedCount + 1;
  const prevEvo = getPetEvolution(prev.tasksCompletedCount);
  const nextEvo = getPetEvolution(nextCompletedCount);

  const dialogue =
    nextEvo.level > prevEvo.level
      ? `WHOA, ${prev.userName}! "${target.title}" is done AND we evolved to Lv.${nextEvo.level} (${nextEvo.title})!! Look at my new look! (+10 Focus Coins)`
      : `Yes, ${prev.userName}! "${target.title}" is done! (+10 Focus Coins — you're on fire!)`;

  const syntheticResponse: PetBrainResponse = {
    pet_dialogue: dialogue,
    pet_animation: 'Happy_Bounce',
    audio_command: prev.audioCommand,
    ui_bg_color: '#D4AF37',
    user_wallet_balance: nextWallet,
    room_inventory: prev.roomInventory,
    updated_stats: nextStats,
    push_notification_trigger: normalizeNotificationTrigger(null, nextStats, prev.petName),
  };

  return {
    completedTask: target,
    state: {
      ...prev,
      isSleeping: false,
      tasks: nextTasks,
      walletBalance: nextWallet,
      stats: nextStats,
      currentAnimation: 'Happy_Bounce',
      uiBgColor: '#D4AF37',
      lastDialogue: dialogue,
      pushNotification: syntheticResponse.push_notification_trigger,
      lastBrainResponse: syntheticResponse,
      tasksCompletedCount: nextCompletedCount,
      lastUpdatedAt: now,
    },
  };
}

export function feedQuickTreatWithCoins(
  prev: PetAppState,
  now = Date.now()
): { state: PetAppState; ok: boolean; reason?: string } {
  const cost = 5;
  if (prev.walletBalance < cost) {
    return {
      state: prev,
      ok: false,
      reason: `Need ${cost - prev.walletBalance} more Focus Coins (or play Treat Catch for free).`,
    };
  }
  if (prev.stats.hunger >= 100) {
    return {
      state: prev,
      ok: false,
      reason: `${prev.petName} is already completely full!`,
    };
  }

  const nextWallet = prev.walletBalance - cost;
  const nextHunger = clampStat(prev.stats.hunger + 15);
  let nextHappiness = clampStat(prev.stats.happiness + 6);
  if (nextHappiness === nextHunger) {
    nextHappiness = clampStat(nextHappiness >= 95 ? nextHappiness - 4 : nextHappiness + 3);
  }
  const nextStats: PetStats = { happiness: nextHappiness, hunger: nextHunger };

  const mood = getMoodForHappiness(nextHappiness);
  const nextAnim: PetAnimation = nextHappiness >= 46 ? 'Happy_Bounce' : mood.animation;
  const nextBg: MoodBgColor = nextHappiness >= 46 ? '#D4AF37' : mood.bgColor;
  const dialogue =
    nextHappiness <= 25
      ? `*Chomp!* Thanks for the snack, ${prev.userName}... I was really hungry, though I still need a little more care.`
      : nextHappiness <= 45
        ? `*Munch!* That crispy treat helped, ${prev.userName}. Give me a few pets or another snack when you can.`
        : `Yum!! Thanks for the pantry treat, ${prev.userName}! My tummy is much happier now!`;
  const nextNotif = normalizeNotificationTrigger(null, nextStats, prev.petName);

  const syntheticResponse: PetBrainResponse = {
    pet_dialogue: dialogue,
    pet_animation: nextAnim,
    audio_command: prev.audioCommand,
    ui_bg_color: nextBg,
    user_wallet_balance: nextWallet,
    room_inventory: prev.roomInventory,
    updated_stats: nextStats,
    push_notification_trigger: nextNotif,
  };

  return {
    ok: true,
    state: {
      ...prev,
      isSleeping: false,
      sleepUntil: null,
      walletBalance: nextWallet,
      stats: nextStats,
      currentAnimation: nextAnim,
      uiBgColor: nextBg,
      lastDialogue: dialogue,
      pushNotification: nextNotif,
      lastBrainResponse: syntheticResponse,
      lastUpdatedAt: now,
    },
  };
}

export function applyMiniGameFeed(
  prev: PetAppState,
  rewards: {
    hungerGain: number;
    happinessGain: number;
    coinsEarned: number;
    treatsCaught: number;
    goldenCaught?: number;
  },
  now = Date.now()
): PetAppState {
  const totalTreats = rewards.treatsCaught + (rewards.goldenCaught ?? 0);
  if (totalTreats <= 0 && rewards.hungerGain <= 0 && rewards.coinsEarned <= 0) {
    return prev;
  }

  const nextWallet = prev.walletBalance + Math.max(0, Math.round(rewards.coinsEarned));
  const nextHunger = clampStat(prev.stats.hunger + Math.max(0, Math.round(rewards.hungerGain)));
  let nextHappiness = clampStat(
    prev.stats.happiness + Math.max(0, Math.round(rewards.happinessGain))
  );
  if (nextHappiness === nextHunger) {
    nextHappiness = clampStat(nextHappiness >= 95 ? nextHappiness - 4 : nextHappiness + 3);
  }
  const nextStats: PetStats = { happiness: nextHappiness, hunger: nextHunger };

  const mood = getMoodForHappiness(nextHappiness);
  const nextAnim: PetAnimation = nextHappiness >= 46 ? 'Happy_Bounce' : mood.animation;
  const nextBg: MoodBgColor = nextHappiness >= 46 ? '#D4AF37' : mood.bgColor;
  const nextNotif = normalizeNotificationTrigger(null, nextStats, prev.petName);

  const coinPhrase = rewards.coinsEarned > 0 ? ` (+${rewards.coinsEarned} Focus Coins!)` : '';
  const dialogueByPet: Record<PetId, string> = {
    Kuro: `Nice reflexes, ${prev.userName}! ${totalTreats} treats caught—okay, I'm officially purring.${coinPhrase}`,
    Barnaby: `NOM NOM!! ${totalTreats} treats!! You're the BEST catch partner ever, ${prev.userName}!${coinPhrase}`,
    Bloop: `Bloop-chomp! ${totalTreats} yummy treats absorbed! Hunger up to ${nextHunger}/100!${coinPhrase}`,
    Rex: `Arf! Great teamwork, ${prev.userName}! ${totalTreats} treats secured and tummy fueled!${coinPhrase}`,
    Otto: `Yip-chomp! ${totalTreats} treats straight to my bowl, ${prev.userName}! Short legs, big appetite satisfied!${coinPhrase}`,
  };
  const dialogue = dialogueByPet[prev.selectedPet];

  const syntheticResponse: PetBrainResponse = {
    pet_dialogue: dialogue,
    pet_animation: nextAnim,
    audio_command: prev.audioCommand,
    ui_bg_color: nextBg,
    user_wallet_balance: nextWallet,
    room_inventory: prev.roomInventory,
    updated_stats: nextStats,
    push_notification_trigger: nextNotif,
  };

  const timeLabel = new Date(now).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  const entry: ChatEntry = {
    id: `minigame-${now}`,
    role: 'pet',
    petName: prev.petName,
    text: dialogue,
    timestamp: timeLabel,
    animation: nextAnim,
    bgColor: nextBg,
    coinsDelta: rewards.coinsEarned > 0 ? rewards.coinsEarned : undefined,
    notification: nextNotif,
    rawJson: syntheticResponse,
  };

  return {
    ...prev,
    isSleeping: false,
    sleepUntil: null,
    walletBalance: nextWallet,
    stats: nextStats,
    currentAnimation: nextAnim,
    uiBgColor: nextBg,
    lastDialogue: dialogue,
    pushNotification: nextNotif,
    lastBrainResponse: syntheticResponse,
    chatHistory: [...prev.chatHistory, entry],
    lastUpdatedAt: now,
  };
}

export function applyBrainResponseToState(
  prev: PetAppState,
  userMessage: string,
  response: PetBrainResponse,
  now = Date.now(),
  options?: { completedTaskTitle?: string; hideUserMessage?: boolean; alreadyCredited?: boolean }
): PetAppState {
  // Never roll back locally earned coins/hunger if multiple tasks were ticked concurrently
  const safeWallet = options?.alreadyCredited
    ? Math.max(prev.walletBalance, response.user_wallet_balance)
    : response.user_wallet_balance;
  const safeStats: PetStats = options?.alreadyCredited
    ? {
        happiness: Math.max(prev.stats.happiness, response.updated_stats.happiness),
        hunger: Math.max(prev.stats.hunger, response.updated_stats.hunger),
      }
    : response.updated_stats;

  const coinsDelta = options?.alreadyCredited ? 10 : safeWallet - prev.walletBalance;
  const completedTaskBonus = !options?.alreadyCredited && (coinsDelta >= 10 || Boolean(options?.completedTaskTitle));

  const timeLabel = new Date(now).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const userEntry: ChatEntry = {
    id: `u-${now}-${Math.random().toString(36).slice(2, 7)}`,
    role: 'user',
    text: userMessage,
    timestamp: timeLabel,
  };

  let coercedAnim = response.pet_animation;
  let coercedBg = response.ui_bg_color;
  if (!options?.alreadyCredited && safeStats.happiness <= 25) {
    coercedAnim = 'Angry_Hiss';
    coercedBg = '#8B0000';
  }

  const finalResponse: PetBrainResponse = {
    ...response,
    pet_animation: coercedAnim,
    ui_bg_color: coercedBg,
    user_wallet_balance: safeWallet,
    updated_stats: safeStats,
  };

  const petEntry: ChatEntry = {
    id: `p-${now}-${Math.random().toString(36).slice(2, 7)}`,
    role: 'pet',
    petName: prev.petName,
    text: finalResponse.pet_dialogue,
    timestamp: timeLabel,
    animation: finalResponse.pet_animation,
    audioCommand: finalResponse.audio_command,
    bgColor: finalResponse.ui_bg_color,
    coinsDelta: coinsDelta !== 0 ? coinsDelta : undefined,
    notification: finalResponse.push_notification_trigger,
    rawJson: finalResponse,
  };

  const nextHistory = options?.hideUserMessage
    ? [...prev.chatHistory, petEntry]
    : [...prev.chatHistory, userEntry, petEntry];

  let nextRoomLayout = prev.roomLayout;
  const hadBowl = prev.roomInventory.some((i) => i.toLowerCase() === 'fish bowl');
  const hasBowlNow = finalResponse.room_inventory.some((i) => i.toLowerCase() === 'fish bowl');
  if (!hadBowl && hasBowlNow) {
    const tablePos = prev.roomLayout['Cozy Table'] ?? DEFAULT_ROOM_LAYOUT['Cozy Table'];
    nextRoomLayout = {
      ...prev.roomLayout,
      'Fish Bowl': clampRoomPosition('Fish Bowl', {
        x: tablePos.x,
        y: tablePos.y - 0.16,
      }),
    };
  }

  return {
    ...prev,
    isSleeping: false,
    stats: safeStats,
    walletBalance: safeWallet,
    currentAnimation: finalResponse.pet_animation,
    audioCommand: finalResponse.audio_command,
    uiBgColor: finalResponse.ui_bg_color,
    roomInventory: finalResponse.room_inventory,
    roomLayout: nextRoomLayout,
    lastDialogue: finalResponse.pet_dialogue,
    pushNotification: finalResponse.push_notification_trigger,
    lastBrainResponse: finalResponse,
    tasksCompletedCount: prev.tasksCompletedCount + (completedTaskBonus ? 1 : 0),
    chatHistory: nextHistory,
    lastUpdatedAt: now,
  };
}

export function clampRoomPosition(
  itemName: string,
  pos: RoomItemPosition
): RoomItemPosition {
  const def = SHOP_ITEMS.find((i) => i.name.toLowerCase() === itemName.toLowerCase());
  const x = Math.max(0.07, Math.min(0.93, Number.isFinite(pos.x) ? Number(pos.x.toFixed(3)) : 0.5));
  let yMin = 0.72;
  let yMax = 0.92;
  if (def?.category === 'ceiling') {
    yMin = 0.08;
    yMax = 0.28;
  } else if (def?.category === 'tabletop') {
    yMin = 0.5;
    yMax = 0.9;
  }
  const y = Math.max(yMin, Math.min(yMax, Number.isFinite(pos.y) ? Number(pos.y.toFixed(3)) : yMin));
  return { x, y };
}

export function updateRoomItemPosition(
  prev: PetAppState,
  itemName: string,
  pos: RoomItemPosition,
  now = Date.now()
): PetAppState {
  const clamped = clampRoomPosition(itemName, pos);
  const nextLayout = {
    ...prev.roomLayout,
    [itemName]: clamped,
  };

  // If Cozy Table is moved while Fish Bowl is sitting on its tabletop, move Fish Bowl with it
  if (
    itemName === 'Cozy Table' &&
    prev.roomInventory.some((i) => i.toLowerCase() === 'fish bowl')
  ) {
    const oldTable = prev.roomLayout['Cozy Table'] ?? DEFAULT_ROOM_LAYOUT['Cozy Table'];
    const oldBowl = prev.roomLayout['Fish Bowl'] ?? { x: oldTable.x, y: oldTable.y - 0.16 };
    const wasOnTable =
      Math.abs(oldBowl.x - oldTable.x) < 0.1 && Math.abs(oldBowl.y - (oldTable.y - 0.16)) < 0.08;
    if (wasOnTable) {
      nextLayout['Fish Bowl'] = clampRoomPosition('Fish Bowl', {
        x: clamped.x,
        y: clamped.y - 0.16,
      });
    }
  }

  return {
    ...prev,
    roomLayout: nextLayout,
    lastUpdatedAt: now,
  };
}

export function purchaseShopItem(
  prev: PetAppState,
  item: ShopItem,
  now = Date.now()
): { state: PetAppState; ok: boolean; reason?: string } {
  const alreadyOwned = prev.roomInventory.some(
    (name) => name.toLowerCase() === item.name.toLowerCase()
  );
  if (alreadyOwned) {
    return { state: prev, ok: false, reason: `${item.name} is already in your room.` };
  }
  if (item.requiresItem) {
    const hasPrereq = prev.roomInventory.some(
      (name) => name.toLowerCase() === item.requiresItem!.toLowerCase()
    );
    if (!hasPrereq) {
      return {
        state: prev,
        ok: false,
        reason: `Buy ${item.requiresItem} first before getting ${item.name}.`,
      };
    }
  }
  if (prev.walletBalance < item.cost) {
    return {
      state: prev,
      ok: false,
      reason: `Need ${item.cost - prev.walletBalance} more Focus Coins for ${item.name}.`,
    };
  }

  const nextWallet = prev.walletBalance - item.cost;
  const nextInventory = [...prev.roomInventory, item.name];
  const nextLayout = { ...prev.roomLayout };
  if (item.name === 'Fish Bowl') {
    const tablePos = nextLayout['Cozy Table'] ?? DEFAULT_ROOM_LAYOUT['Cozy Table'];
    nextLayout['Fish Bowl'] = clampRoomPosition('Fish Bowl', {
      x: tablePos.x,
      y: tablePos.y - 0.16,
    });
  } else if (!nextLayout[item.name] && DEFAULT_ROOM_LAYOUT[item.name]) {
    nextLayout[item.name] = { ...DEFAULT_ROOM_LAYOUT[item.name] };
  }
  const nextHappiness = clampStat(prev.stats.happiness + 12);
  const nameRef = prev.userName || 'friend';

  const dialogueByPet: Record<PetId, string> = {
    Kuro: `A ${item.name}, ${nameRef}? Okay, I admit it—you actually have great taste. Drag it wherever you like in our room.`,
    Barnaby: `WOOF! ${nameRef}, we got a ${item.name}!! Place it anywhere in our room!! I'm so proud of you!`,
    Bloop: `Bloop-yay, ${nameRef}! A shiny new ${item.name} in our space! Move it around anytime!`,
    Rex: `Arf! ${nameRef}, a brand new ${item.name} for our headquarters!! Drag it wherever you want—I'll guard it proudly!`,
    Otto: `Yip-yip! ${nameRef}, look at our new ${item.name}!! Even with short legs I'm trotting over to check it out!`,
  };

  const dialogue = dialogueByPet[prev.selectedPet];

  const syntheticResponse: PetBrainResponse = {
    pet_dialogue: dialogue,
    pet_animation: 'Happy_Bounce',
    audio_command: 'none',
    ui_bg_color: '#D4AF37',
    user_wallet_balance: nextWallet,
    room_inventory: nextInventory,
    updated_stats: {
      happiness: nextHappiness,
      hunger: prev.stats.hunger,
    },
    push_notification_trigger: normalizeNotificationTrigger(
      null,
      { happiness: nextHappiness, hunger: prev.stats.hunger },
      prev.petName
    ),
  };

  const timeLabel = new Date(now).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const petEntry: ChatEntry = {
    id: `shop-${now}`,
    role: 'pet',
    petName: prev.petName,
    text: dialogue,
    timestamp: timeLabel,
    animation: 'Happy_Bounce',
    bgColor: '#D4AF37',
    coinsDelta: -item.cost,
    rawJson: syntheticResponse,
  };

  return {
    ok: true,
    state: {
      ...prev,
      stats: syntheticResponse.updated_stats,
      walletBalance: nextWallet,
      roomInventory: nextInventory,
      roomLayout: nextLayout,
      currentAnimation: 'Happy_Bounce',
      uiBgColor: '#D4AF37',
      lastDialogue: dialogue,
      pushNotification: syntheticResponse.push_notification_trigger,
      lastBrainResponse: syntheticResponse,
      chatHistory: [...prev.chatHistory, petEntry],
      lastUpdatedAt: now,
    },
  };
}

export function updateUserSettings(
  prev: PetAppState,
  updates: {
    userName: string;
    petName: string;
    selectedPet: PetId;
    volume?: number;
  },
  now = Date.now()
): PetAppState {
  const cleanUser = updates.userName.trim() || prev.userName;
  const cleanPetName = updates.petName.trim() || updates.selectedPet;
  const nextVolume =
    typeof updates.volume === 'number' ? clampVolume(updates.volume, prev.volume) : prev.volume;
  const petChanged = prev.selectedPet !== updates.selectedPet;
  const nameChanged = prev.petName !== cleanPetName || prev.userName !== cleanUser;

  if (!petChanged && !nameChanged) {
    return {
      ...prev,
      volume: nextVolume,
      lastUpdatedAt: now,
    };
  }

  const profile = PET_PROFILES[updates.selectedPet];
  const greeting = `Hi ${cleanUser}! I'm ${cleanPetName} (${profile.species}). ${profile.initialDialogue}`;

  const nextResponse: PetBrainResponse = {
    ...prev.lastBrainResponse,
    pet_dialogue: greeting,
    pet_animation: petChanged ? 'Happy_Bounce' : prev.currentAnimation,
    push_notification_trigger: normalizeNotificationTrigger(null, prev.stats, cleanPetName),
  };

  const timeLabel = new Date(now).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const entry: ChatEntry = {
    id: `settings-${now}`,
    role: 'pet',
    petName: cleanPetName,
    text: greeting,
    timestamp: timeLabel,
    animation: nextResponse.pet_animation,
    bgColor: prev.uiBgColor,
    rawJson: nextResponse,
  };

  return {
    ...prev,
    userName: cleanUser,
    petName: cleanPetName,
    selectedPet: updates.selectedPet,
    volume: nextVolume,
    currentAnimation: nextResponse.pet_animation,
    lastDialogue: greeting,
    pushNotification: nextResponse.push_notification_trigger,
    lastBrainResponse: nextResponse,
    chatHistory: [...prev.chatHistory, entry],
    lastUpdatedAt: now,
  };
}

export function getMoodForHappiness(happiness: number): {
  animation: PetAnimation;
  bgColor: MoodBgColor;
  zone: 'angry' | 'sad' | 'steady' | 'hyped';
  label: string;
} {
  const clamped = clampStat(happiness, 50);
  if (clamped <= 25) {
    return {
      animation: 'Angry_Hiss',
      bgColor: '#8B0000',
      zone: 'angry',
      label: 'Angry · Red (#8B0000)',
    };
  }
  if (clamped <= 45) {
    return {
      animation: 'Sad_Ears_Down',
      bgColor: '#1F2937',
      zone: 'sad',
      label: 'Sad · Blue (#1F2937)',
    };
  }
  if (clamped < 75) {
    return {
      animation: 'Idle',
      bgColor: '#1E1E2E',
      zone: 'steady',
      label: 'Calm · Night (#1E1E2E)',
    };
  }
  return {
    animation: 'Happy_Bounce',
    bgColor: '#D4AF37',
    zone: 'hyped',
    label: 'Hyped · Gold (#D4AF37)',
  };
}

export function applyHappinessLevelPreview(
  prev: PetAppState,
  happiness: number,
  now = Date.now()
): PetAppState {
  const clampedHappiness = clampStat(happiness, prev.stats.happiness);
  const mood = getMoodForHappiness(clampedHappiness);
  const nextStats: PetStats = {
    ...prev.stats,
    happiness: clampedHappiness,
  };
  const nextNotif = normalizeNotificationTrigger(null, nextStats, prev.petName);
  const nextBrainResponse: PetBrainResponse = {
    ...prev.lastBrainResponse,
    pet_animation: mood.animation,
    ui_bg_color: mood.bgColor,
    updated_stats: nextStats,
    push_notification_trigger: nextNotif,
  };

  return {
    ...prev,
    stats: nextStats,
    currentAnimation: mood.animation,
    uiBgColor: mood.bgColor,
    pushNotification: nextNotif,
    lastBrainResponse: nextBrainResponse,
    lastUpdatedAt: now,
  };
}

export function applyHungerLevelPreview(
  prev: PetAppState,
  hunger: number,
  now = Date.now()
): PetAppState {
  const nextHunger = clampStat(hunger, prev.stats.hunger);
  const delta = nextHunger - prev.stats.hunger;

  let nextHappiness = prev.stats.happiness;
  if (nextHunger <= 25) {
    const targetMax = nextHunger <= 17 ? nextHunger + 6 : Math.max(6, nextHunger - 6);
    nextHappiness = Math.min(prev.stats.happiness, targetMax);
    if (nextHappiness > 25) nextHappiness = 22;
  } else if (nextHunger <= 45) {
    const offsetTarget = nextHunger <= 35 ? nextHunger + 7 : nextHunger - 6;
    if (delta < 0) {
      nextHappiness = Math.min(prev.stats.happiness, Math.max(26, Math.min(45, offsetTarget)));
    } else {
      nextHappiness = Math.max(26, Math.min(45, Math.max(prev.stats.happiness + Math.round(delta * 0.6), offsetTarget)));
    }
  } else if (delta > 0) {
    nextHappiness = clampStat(prev.stats.happiness + Math.round(delta * 0.72));
    if (nextHunger >= 85 && nextHappiness < 75) {
      nextHappiness = 78;
    }
  } else if (delta < 0) {
    nextHappiness = clampStat(prev.stats.happiness - Math.round(Math.abs(delta) * 0.35));
  }

  // Ensure happiness and hunger always read as distinct stats
  if (nextHappiness === nextHunger) {
    if (nextHunger <= 25) {
      nextHappiness = nextHunger >= 12 ? nextHunger - 6 : nextHunger + 6;
    } else if (nextHunger <= 45) {
      nextHappiness = nextHunger <= 38 ? nextHunger + 6 : nextHunger - 6;
    } else {
      nextHappiness = clampStat(nextHunger - 8);
    }
  }

  const mood = getMoodForHappiness(nextHappiness);
  const nextStats: PetStats = {
    happiness: nextHappiness,
    hunger: nextHunger,
  };
  const nextNotif = normalizeNotificationTrigger(null, nextStats, prev.petName);
  const nextBrainResponse: PetBrainResponse = {
    ...prev.lastBrainResponse,
    pet_animation: mood.animation,
    ui_bg_color: mood.bgColor,
    updated_stats: nextStats,
    push_notification_trigger: nextNotif,
  };

  return {
    ...prev,
    stats: nextStats,
    currentAnimation: mood.animation,
    uiBgColor: mood.bgColor,
    pushNotification: nextNotif,
    lastBrainResponse: nextBrainResponse,
    lastUpdatedAt: now,
  };
}

export function applyPetTap(prev: PetAppState, now = Date.now()): PetAppState {
  const nextHappiness = clampStat(prev.stats.happiness + 5, prev.stats.happiness);
  const mood = getMoodForHappiness(nextHappiness);
  const nextStats: PetStats = {
    ...prev.stats,
    happiness: nextHappiness,
  };
  const activeAnim: PetAnimation =
    nextHappiness >= 100 ? 'Happy_Bounce' : 'Comforting_Nuzzle';
  const nextNotif = normalizeNotificationTrigger(null, nextStats, prev.petName);
  const nextBrainResponse: PetBrainResponse = {
    ...prev.lastBrainResponse,
    pet_animation: activeAnim,
    ui_bg_color: mood.bgColor,
    updated_stats: nextStats,
    push_notification_trigger: nextNotif,
  };

  return {
    ...prev,
    stats: nextStats,
    currentAnimation: activeAnim,
    uiBgColor: mood.bgColor,
    pushNotification: nextNotif,
    lastBrainResponse: nextBrainResponse,
    lastUpdatedAt: now,
  };
}

export function settleAfterPetting(prev: PetAppState, now = Date.now()): PetAppState {
  const mood = getMoodForHappiness(prev.stats.happiness);
  const nextNotif = normalizeNotificationTrigger(null, prev.stats, prev.petName);
  const nextBrainResponse: PetBrainResponse = {
    ...prev.lastBrainResponse,
    pet_animation: mood.animation,
    ui_bg_color: mood.bgColor,
    updated_stats: prev.stats,
    push_notification_trigger: nextNotif,
  };

  return {
    ...prev,
    currentAnimation: mood.animation,
    uiBgColor: mood.bgColor,
    pushNotification: nextNotif,
    lastBrainResponse: nextBrainResponse,
    lastUpdatedAt: now,
  };
}

export type TransientEmoteKind =
  | 'heart'
  | 'star'
  | 'question'
  | 'hungry'
  | 'sad'
  | 'anger'
  | 'sleep';

export interface TransientEmoteDescriptor {
  kind: TransientEmoteKind;
  label: string;
  color: string;
  accent: string;
}

export function getHoverEmoteForStats(
  stats: PetStats,
  isSleeping = false
): TransientEmoteDescriptor {
  if (isSleeping) {
    return {
      kind: 'sleep',
      label: 'Sleeping peacefully',
      color: '#CBD5E1',
      accent: '#93C5FD',
    };
  }
  if (stats.hunger < 30) {
    return {
      kind: 'hungry',
      label: 'Hungry for a task',
      color: '#F59E0B',
      accent: '#EF4444',
    };
  }
  if (stats.happiness <= 25) {
    return {
      kind: 'anger',
      label: 'Frustrated',
      color: '#EF4444',
      accent: '#FCA5A5',
    };
  }
  if (stats.happiness <= 45) {
    return {
      kind: 'sad',
      label: 'Feeling down',
      color: '#60A5FA',
      accent: '#93C5FD',
    };
  }
  if (stats.happiness >= 75 && stats.hunger >= 70) {
    return {
      kind: 'heart',
      label: 'Happy & loved',
      color: '#F472B6',
      accent: '#FB7185',
    };
  }
  if (stats.happiness >= 60 && stats.hunger >= 55) {
    return {
      kind: 'star',
      label: 'Focused & bright',
      color: '#FACC15',
      accent: '#FDE047',
    };
  }
  return {
    kind: 'question',
    label: 'Checking in?',
    color: '#A78BFA',
    accent: '#C4B5FD',
  };
}

export const SLEEP_DURATION_OPTIONS = [10, 20, 30] as const;

export function formatSleepCountdown(sleepUntil: number | null, now = Date.now()): string | null {
  if (sleepUntil === null || !Number.isFinite(sleepUntil)) return null;
  const remainingSec = Math.max(0, Math.ceil((sleepUntil - now) / 1000));
  const mins = Math.floor(remainingSec / 60);
  const secs = remainingSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function checkSleepExpiration(prev: PetAppState, now = Date.now()): PetAppState {
  if (!prev.isSleeping || prev.sleepUntil === null || now < prev.sleepUntil) {
    return prev;
  }
  const woken = toggleSleepMode(prev, false, now);
  return {
    ...woken,
    lastDialogue: `*Stretch* Nap timer finished! Good to see you back, ${prev.userName}—ready when you are!`,
    lastBrainResponse: {
      ...woken.lastBrainResponse,
      pet_dialogue: `*Stretch* Nap timer finished! Good to see you back, ${prev.userName}—ready when you are!`,
    },
  };
}

export function toggleSleepMode(
  prev: PetAppState,
  nextSleeping?: boolean,
  now = Date.now(),
  durationMinutes?: number | null
): PetAppState {
  const sleeping = typeof nextSleeping === 'boolean' ? nextSleeping : !prev.isSleeping;
  if (sleeping) {
    const validDuration =
      typeof durationMinutes === 'number' && Number.isFinite(durationMinutes) && durationMinutes > 0
        ? Math.round(durationMinutes)
        : null;
    const sleepUntil = validDuration !== null ? now + validDuration * 60_000 : null;
    const hasBeanbag = prev.roomInventory.some(
      (item) => item.toLowerCase() === 'beanbag chair'
    );
    const durationPhrase = validDuration !== null ? `${validDuration}-minute nap` : 'deep rest';
    const dialogue = hasBeanbag
      ? `Curled up on the Beanbag Chair for a ${durationPhrase}, ${prev.userName}. My stats are paused—go focus on your work!`
      : `Tucking in for a ${validDuration !== null ? `${validDuration}-minute nap` : 'quiet nap'}, ${prev.userName}. My stats are paused so you can work worry-free!`;

    const nextBrainResponse: PetBrainResponse = {
      ...prev.lastBrainResponse,
      pet_dialogue: dialogue,
      pet_animation: 'Idle',
      ui_bg_color: '#1E1E2E',
      push_notification_trigger: null,
    };

    return {
      ...prev,
      isSleeping: true,
      sleepUntil,
      currentAnimation: 'Idle',
      uiBgColor: '#1E1E2E',
      lastDialogue: dialogue,
      pushNotification: null,
      lastBrainResponse: nextBrainResponse,
      lastUpdatedAt: now,
    };
  }

  const mood = getMoodForHappiness(prev.stats.happiness);
  const wakeDialogue = `*Yawn* Good to see you back, ${prev.userName}! Ready whenever you are.`;
  const nextNotif = normalizeNotificationTrigger(null, prev.stats, prev.petName);
  const nextBrainResponse: PetBrainResponse = {
    ...prev.lastBrainResponse,
    pet_dialogue: wakeDialogue,
    pet_animation: mood.animation,
    ui_bg_color: mood.bgColor,
    push_notification_trigger: nextNotif,
  };

  return {
    ...prev,
    isSleeping: false,
    sleepUntil: null,
    currentAnimation: mood.animation,
    uiBgColor: mood.bgColor,
    lastDialogue: wakeDialogue,
    pushNotification: nextNotif,
    lastBrainResponse: nextBrainResponse,
    lastUpdatedAt: now,
  };
}

export function applyElapsedDecay(prev: PetAppState, elapsedMinutes: number): PetAppState {
  if (elapsedMinutes <= 0) return prev;
  // Sleeping protects pet hunger and happiness so the user can focus uninterrupted
  if (prev.isSleeping) {
    return {
      ...prev,
      pushNotification: null,
      lastUpdatedAt: Date.now(),
    };
  }
  const hungerDrop = Math.floor(elapsedMinutes / 5);
  const happinessDrop = Math.floor(elapsedMinutes / 8);
  if (hungerDrop === 0 && happinessDrop === 0) return prev;

  const nextHunger = clampStat(prev.stats.hunger - hungerDrop);
  const nextHappiness = clampStat(prev.stats.happiness - happinessDrop);
  let nextAnim = prev.currentAnimation;
  let nextBg = prev.uiBgColor;
  if (nextHappiness <= 25 || nextHunger < 30) {
    nextAnim = 'Angry_Hiss';
    nextBg = '#8B0000';
  } else if (nextHappiness <= 45) {
    nextAnim = 'Sad_Ears_Down';
    nextBg = '#1F2937';
  }

  const nextStats = {
    happiness: nextHappiness,
    hunger: nextHunger,
  };

  return {
    ...prev,
    stats: nextStats,
    currentAnimation: nextAnim,
    uiBgColor: nextBg,
    pushNotification: normalizeNotificationTrigger(null, nextStats, prev.petName),
  };
}

export function reconcileMoodWithStats(prev: PetAppState): PetAppState {
  if (prev.isSleeping) return prev;
  if (prev.stats.happiness <= 25 || prev.stats.hunger < 30) {
    const nextNotif =
      prev.pushNotification ??
      normalizeNotificationTrigger(null, prev.stats, prev.petName);
    if (
      prev.currentAnimation === 'Angry_Hiss' &&
      prev.uiBgColor === '#8B0000' &&
      prev.pushNotification === nextNotif
    ) {
      return prev;
    }
    return {
      ...prev,
      currentAnimation: 'Angry_Hiss',
      uiBgColor: '#8B0000',
      pushNotification: nextNotif,
      lastBrainResponse: {
        ...prev.lastBrainResponse,
        pet_animation: 'Angry_Hiss',
        ui_bg_color: '#8B0000',
        push_notification_trigger: nextNotif,
      },
    };
  }
  if (
    prev.stats.happiness <= 45 &&
    (prev.currentAnimation === 'Idle' ||
      prev.currentAnimation === 'Happy_Bounce' ||
      prev.uiBgColor === '#1E1E2E' ||
      prev.uiBgColor === '#D4AF37')
  ) {
    return {
      ...prev,
      currentAnimation: 'Sad_Ears_Down',
      uiBgColor: '#1F2937',
      lastBrainResponse: {
        ...prev.lastBrainResponse,
        pet_animation: 'Sad_Ears_Down',
        ui_bg_color: '#1F2937',
      },
    };
  }
  return prev;
}

export function getMoodDescriptor(stats: PetStats, bgColor: MoodBgColor): {
  label: string;
  tone: 'optimal' | 'steady' | 'warning' | 'critical';
} {
  if (bgColor === '#8B0000' || stats.happiness <= 25 || stats.hunger < 30) {
    return { label: 'Angry · Needs Care', tone: 'critical' };
  }
  if (bgColor === '#1F2937' || stats.happiness <= 45) {
    return { label: 'Sad · Close to Mad', tone: 'warning' };
  }
  if (bgColor === '#D4AF37' || (stats.happiness >= 75 && stats.hunger >= 70)) {
    return { label: 'Hyped · Thriving', tone: 'optimal' };
  }
  return { label: 'Present · On Watch', tone: 'steady' };
}

export interface PetEvolutionInfo {
  level: 1 | 2 | 3 | 4;
  title: string;
  minTasks: number;
  nextMilestone: number | null;
  progressPct: number;
}

export function getPetEvolution(tasksCompletedCount: number): PetEvolutionInfo {
  const count = Math.max(0, Math.floor(Number.isFinite(tasksCompletedCount) ? tasksCompletedCount : 0));
  if (count >= 100) {
    return {
      level: 4,
      title: 'Ascended',
      minTasks: 100,
      nextMilestone: null,
      progressPct: 100,
    };
  }
  if (count >= 50) {
    return {
      level: 3,
      title: 'Guardian',
      minTasks: 50,
      nextMilestone: 100,
      progressPct: Math.round(((count - 50) / 50) * 100),
    };
  }
  if (count >= 10) {
    return {
      level: 2,
      title: 'Focused',
      minTasks: 10,
      nextMilestone: 50,
      progressPct: Math.round(((count - 10) / 40) * 100),
    };
  }
  return {
    level: 1,
    title: 'Rookie',
    minTasks: 0,
    nextMilestone: 10,
    progressPct: Math.round((count / 10) * 100),
  };
}

export function createInitialPetState(
  options?: {
    petId?: PetId;
    petName?: string;
    userName?: string;
    initialized?: boolean;
    volume?: number;
  },
  now = Date.now()
): PetAppState {
  const petId = options?.petId ?? 'Kuro';
  const petName = options?.petName?.trim() || petId;
  const userName = options?.userName?.trim() || 'Alex';
  const initialized = options?.initialized ?? false;
  const volume = clampVolume(options?.volume, 0.85);
  const profile = PET_PROFILES[petId];
  const greeting = `Hey ${userName}! I'm ${petName}. ${profile.initialDialogue}`;

  const initialResponse: PetBrainResponse = {
    pet_dialogue: greeting,
    pet_animation: 'Idle',
    audio_command: 'none',
    ui_bg_color: '#1E1E2E',
    user_wallet_balance: 25,
    room_inventory: [],
    updated_stats: {
      happiness: 74,
      hunger: 64,
    },
    push_notification_trigger: null,
  };

  return {
    initialized,
    userName,
    petName,
    selectedPet: petId,
    volume,
    isSleeping: false,
    sleepUntil: null,
    stats: initialResponse.updated_stats,
    walletBalance: initialResponse.user_wallet_balance,
    currentAnimation: initialResponse.pet_animation,
    audioCommand: initialResponse.audio_command,
    uiBgColor: initialResponse.ui_bg_color,
    roomInventory: initialResponse.room_inventory,
    roomLayout: { ...DEFAULT_ROOM_LAYOUT },
    lastDialogue: greeting,
    pushNotification: null,
    lastBrainResponse: initialResponse,
    tasks: [
      {
        id: 'seed-1',
        title: 'Finish one focused 25-minute study block',
        completed: false,
        createdAt: new Date(now).toISOString(),
      },
      {
        id: 'seed-2',
        title: 'Clear top 2 inbox messages or class notes',
        completed: false,
        createdAt: new Date(now).toISOString(),
      },
    ],
    tasksCompletedCount: 0,
    chatHistory: initialized
      ? [
          {
            id: 'init-1',
            role: 'pet',
            petName,
            text: greeting,
            timestamp: new Date(now).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            }),
            animation: 'Idle',
            audioCommand: 'none',
            bgColor: '#1E1E2E',
            rawJson: initialResponse,
          },
        ]
      : [],
    lastUpdatedAt: now,
  };
}
