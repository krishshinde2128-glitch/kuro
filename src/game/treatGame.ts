export type TreatGamePhase = 'TITLE_MENU' | 'PLAYING' | 'ROUND_SUMMARY';

export type FallingSnackKind = 'treat' | 'golden' | 'burnt';

export interface FallingSnack {
  id: number;
  kind: FallingSnackKind;
  x: number; // normalized 0.08..0.92
  y: number; // normalized 0..1.05
  speed: number; // normalized vertical units per second
  radius: number; // normalized hit width
  swayPhase: number;
}

export interface TreatRoundState {
  phase: TreatGamePhase;
  timeRemaining: number;
  bowlX: number; // normalized 0.12..0.88
  snacks: FallingSnack[];
  nextId: number;
  spawnTimer: number;
  treatsCaught: number;
  goldenCaught: number;
  burntHit: number;
  streak: number;
  bestStreak: number;
  score: number;
  lastFeedback: { text: string; tone: 'good' | 'gold' | 'bad'; ttl: number } | null;
}

export interface TreatRoundRewards {
  hungerGain: number;
  happinessGain: number;
  coinsEarned: number;
  treatsCaught: number;
  goldenCaught: number;
  burntHit: number;
  bestStreak: number;
}

export const TREAT_ROUND_SECONDS = 20;
export const QUICK_TREAT_COST = 5;
export const QUICK_TREAT_HUNGER = 15;
export const QUICK_TREAT_HAPPINESS = 6;

export function clampBowlX(x: number): number {
  if (!Number.isFinite(x)) return 0.5;
  return Math.max(0.11, Math.min(0.89, x));
}

export function createTreatRoundState(phase: TreatGamePhase = 'TITLE_MENU'): TreatRoundState {
  return {
    phase,
    timeRemaining: TREAT_ROUND_SECONDS,
    bowlX: 0.5,
    snacks: [],
    nextId: 1,
    spawnTimer: 0.25,
    treatsCaught: 0,
    goldenCaught: 0,
    burntHit: 0,
    streak: 0,
    bestStreak: 0,
    score: 0,
    lastFeedback: null,
  };
}

export function spawnFallingSnack(nextId: number, rand = Math.random): FallingSnack {
  const roll = rand();
  const kind: FallingSnackKind =
    roll < 0.18 ? 'golden' : roll < 0.4 ? 'burnt' : 'treat';
  const baseSpeed =
    kind === 'golden' ? 0.56 : kind === 'burnt' ? 0.5 : 0.44;
  return {
    id: nextId,
    kind,
    x: 0.1 + rand() * 0.8,
    y: -0.06,
    speed: baseSpeed + rand() * 0.14,
    radius: kind === 'golden' ? 0.055 : 0.06,
    swayPhase: rand() * Math.PI * 2,
  };
}

export function computeTreatRewards(state: Pick<
  TreatRoundState,
  'treatsCaught' | 'goldenCaught' | 'burntHit' | 'bestStreak' | 'score'
>): TreatRoundRewards {
  const baseHunger = state.treatsCaught * 3 + state.goldenCaught * 5;
  const streakBonus = Math.min(8, Math.floor(state.bestStreak / 2) * 2);
  const netPenalty = state.burntHit * 2;
  const hungerGain =
    state.treatsCaught + state.goldenCaught === 0
      ? 0
      : Math.max(6, Math.min(40, baseHunger + streakBonus - netPenalty));

  const happinessGain =
    state.treatsCaught + state.goldenCaught === 0
      ? 0
      : Math.max(4, Math.min(18, Math.round(hungerGain * 0.45) + (state.goldenCaught > 0 ? 2 : 0)));

  const coinsEarned = Math.max(
    0,
    Math.min(10, state.goldenCaught * 2 + Math.floor(Math.max(0, state.score) / 6))
  );

  return {
    hungerGain,
    happinessGain,
    coinsEarned,
    treatsCaught: state.treatsCaught,
    goldenCaught: state.goldenCaught,
    burntHit: state.burntHit,
    bestStreak: state.bestStreak,
  };
}

export function stepTreatRound(
  prev: TreatRoundState,
  dt: number,
  targetBowlX: number,
  opts?: { reducedMotion?: boolean; rand?: () => number }
): { state: TreatRoundState; events: FallingSnackKind[] } {
  if (prev.phase !== 'PLAYING') {
    return { state: prev, events: [] };
  }

  const rand = opts?.rand ?? Math.random;
  const speedScale = opts?.reducedMotion ? 0.6 : 1;
  const nextBowlX = clampBowlX(targetBowlX);
  const nextTime = Math.max(0, prev.timeRemaining - dt);

  let nextId = prev.nextId;
  let spawnTimer = prev.spawnTimer - dt;
  const activeSnacks: FallingSnack[] = [];
  const events: FallingSnackKind[] = [];

  let treatsCaught = prev.treatsCaught;
  let goldenCaught = prev.goldenCaught;
  let burntHit = prev.burntHit;
  let streak = prev.streak;
  let bestStreak = prev.bestStreak;
  let score = prev.score;
  let lastFeedback =
    prev.lastFeedback && prev.lastFeedback.ttl - dt > 0
      ? { ...prev.lastFeedback, ttl: prev.lastFeedback.ttl - dt }
      : null;

  const catchYMin = 0.81;
  const catchYMax = 0.94;
  const bowlHalfWidth = 0.115;

  for (const snack of prev.snacks) {
    const ny = snack.y + snack.speed * speedScale * dt;
    const hitBowl =
      ny >= catchYMin &&
      ny <= catchYMax &&
      Math.abs(snack.x - nextBowlX) <= bowlHalfWidth + snack.radius * 0.4;

    if (hitBowl) {
      events.push(snack.kind);
      if (snack.kind === 'treat') {
        treatsCaught += 1;
        streak += 1;
        bestStreak = Math.max(bestStreak, streak);
        const mult = streak >= 3 ? 2 : 1;
        score += 2 * mult;
        lastFeedback = {
          text: streak >= 3 ? `+${2 * mult} Tasty! x2` : '+2 Yum!',
          tone: 'good',
          ttl: 0.8,
        };
      } else if (snack.kind === 'golden') {
        goldenCaught += 1;
        streak += 1;
        bestStreak = Math.max(bestStreak, streak);
        score += 4;
        lastFeedback = {
          text: 'Golden Star! +2c',
          tone: 'gold',
          ttl: 0.95,
        };
      } else {
        burntHit += 1;
        streak = 0;
        score = Math.max(0, score - 2);
        lastFeedback = {
          text: 'Burnt! Streak reset',
          tone: 'bad',
          ttl: 0.95,
        };
      }
      continue;
    }

    if (ny <= 1.05) {
      activeSnacks.push({ ...snack, y: ny });
    }
  }

  if (spawnTimer <= 0 && nextTime > 0.35) {
    activeSnacks.push(spawnFallingSnack(nextId, rand));
    nextId += 1;
    spawnTimer = (opts?.reducedMotion ? 0.85 : 0.56) + rand() * 0.28;
  }

  const nextPhase: TreatGamePhase = nextTime <= 0 ? 'ROUND_SUMMARY' : 'PLAYING';

  return {
    events,
    state: {
      phase: nextPhase,
      timeRemaining: nextTime,
      bowlX: nextBowlX,
      snacks: activeSnacks,
      nextId,
      spawnTimer,
      treatsCaught,
      goldenCaught,
      burntHit,
      streak,
      bestStreak,
      score,
      lastFeedback,
    },
  };
}
