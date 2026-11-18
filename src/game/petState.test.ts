import test from 'node:test';
import assert from 'node:assert/strict';
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
  completeTaskLocally,
  createInitialPetState,
  feedQuickTreatWithCoins,
  formatSleepCountdown,
  getHoverEmoteForStats,
  getMoodForHappiness,
  getPetEvolution,
  normalizeAnimation,
  normalizeAudioCommand,
  normalizeBgColor,
  normalizeBrainResponse,
  normalizeNotificationTrigger,
  normalizePetId,
  normalizeRoomInventory,
  purchaseShopItem,
  reconcileMoodWithStats,
  settleAfterPetting,
  SHOP_ITEMS,
  toggleSleepMode,
  updateRoomItemPosition,
  updateUserSettings,
} from './petState';
import {
  computeTreatRewards,
  createTreatRoundState,
  stepTreatRound,
} from './treatGame';

test('clampStat bounds values strictly between 0 and 100', () => {
  assert.equal(clampStat(-10), 0);
  assert.equal(clampStat(150), 100);
  assert.equal(clampStat(82.4), 82);
  assert.equal(clampStat('NaN', 55), 55);
});

test('normalizePetId maps Kuro, Barnaby, Bloop, Rex, and Otto case-insensitively', () => {
  assert.equal(normalizePetId('barnaby'), 'Barnaby');
  assert.equal(normalizePetId('BLOOP'), 'Bloop');
  assert.equal(normalizePetId('rex'), 'Rex');
  assert.equal(normalizePetId('OTTO'), 'Otto');
  assert.equal(normalizePetId('unknown'), 'Kuro');
});

test('normalizeAnimation supports all 5 emotional pet animations', () => {
  assert.equal(normalizeAnimation('Idle'), 'Idle');
  assert.equal(normalizeAnimation('Happy_Bounce'), 'Happy_Bounce');
  assert.equal(normalizeAnimation('Sad_Ears_Down'), 'Sad_Ears_Down');
  assert.equal(normalizeAnimation('Angry_Hiss'), 'Angry_Hiss');
  assert.equal(normalizeAnimation('Comforting_Nuzzle'), 'Comforting_Nuzzle');
  assert.equal(normalizeAnimation('unknown_anim'), 'Idle');
});

test('normalizeAudioCommand and normalizeBgColor enforce updated mood hex palette', () => {
  assert.equal(normalizeAudioCommand('play_lofi'), 'play_lofi');
  assert.equal(normalizeAudioCommand('stop_lofi'), 'stop_lofi');
  assert.equal(normalizeAudioCommand('play_rain_sounds'), 'play_rain_sounds');
  assert.equal(normalizeAudioCommand('other'), 'none');

  assert.equal(normalizeBgColor('#8b0000'), '#8B0000');
  assert.equal(normalizeBgColor('#1f2937'), '#1F2937');
  assert.equal(normalizeBgColor('#d4af37'), '#D4AF37');
  assert.equal(normalizeBgColor('#1e1e2e'), '#1E1E2E');
  assert.equal(normalizeBgColor('#999999'), '#1E1E2E');
});

test('normalizeNotificationTrigger uses custom petName when hunger or happiness < 30', () => {
  assert.equal(
    normalizeNotificationTrigger('null', { happiness: 70, hunger: 25 }, 'Mochi'),
    'Mochi is starving! Complete a task to feed them.'
  );
  assert.equal(
    normalizeNotificationTrigger(null, { happiness: 20, hunger: 80 }, 'Barnaby'),
    'Barnaby misses you and feels lonely!'
  );
  assert.equal(
    normalizeNotificationTrigger(null, { happiness: 65, hunger: 65 }, 'Bloop'),
    null
  );
});

test('normalizeRoomInventory deduplicates, strips legacy Fish Pond, and enforces Fish Bowl prerequisite', () => {
  const withoutTable = normalizeRoomInventory(['beanbag chair', 'Beanbag Chair', 'Fish Pond', 'Fish Bowl']);
  assert.deepEqual(withoutTable, ['Beanbag Chair']);

  const withTable = normalizeRoomInventory(['cozy table', 'fish bowl', 'Fish Bowl']);
  assert.deepEqual(withTable, ['Cozy Table', 'Fish Bowl']);
});

test('buildInitializationMessage includes custom petName when provided', () => {
  assert.equal(
    buildInitializationMessage('Maya', 'Barnaby', 'Sunny'),
    'Initialize companion: My name is Maya, and I choose Barnaby the Dog, whom I named "Sunny".'
  );
  assert.equal(
    buildInitializationMessage('Maya', 'Barnaby', 'Barnaby'),
    'Initialize companion: My name is Maya, and I choose Barnaby the Dog.'
  );
});

test('completeTaskLocally allows ticking multiple tasks consecutively and credits +10 each', () => {
  const initial = createInitialPetState({ petId: 'Kuro', petName: 'Mochi', userName: 'Maya', initialized: true });
  const task1 = initial.tasks[0]!;
  const task2 = initial.tasks[1]!;

  const res1 = completeTaskLocally(initial, task1.id);
  assert.ok(res1.completedTask);
  assert.equal(res1.state.walletBalance, 35);
  assert.equal(res1.state.tasksCompletedCount, 1);
  assert.equal(res1.state.tasks[0]?.completed, true);
  assert.equal(res1.state.tasks[1]?.completed, false);

  const res2 = completeTaskLocally(res1.state, task2.id);
  assert.ok(res2.completedTask);
  assert.equal(res2.state.walletBalance, 45);
  assert.equal(res2.state.tasksCompletedCount, 2);
  assert.equal(res2.state.tasks[1]?.completed, true);

  // Concurrent AI response with alreadyCredited never rolls back walletBalance
  const afterAi = applyBrainResponseToState(
    res2.state,
    'Completed task 1',
    {
      pet_dialogue: 'Awesome!',
      pet_animation: 'Happy_Bounce',
      audio_command: 'none',
      ui_bg_color: '#D4AF37',
      user_wallet_balance: 35,
      room_inventory: [],
      updated_stats: { happiness: 80, hunger: 75 },
      push_notification_trigger: null,
    },
    Date.now(),
    { alreadyCredited: true }
  );
  assert.equal(afterAi.walletBalance, 45);
});

test('updateUserSettings updates userName, petName, selectedPet, and volume cleanly', () => {
  const initial = createInitialPetState({ petId: 'Kuro', petName: 'Kuro', userName: 'Alex', initialized: true });
  const updated = updateUserSettings(initial, {
    userName: 'Maya',
    petName: 'Waffles',
    selectedPet: 'Barnaby',
    volume: 0.95,
  });

  assert.equal(updated.userName, 'Maya');
  assert.equal(updated.petName, 'Waffles');
  assert.equal(updated.selectedPet, 'Barnaby');
  assert.equal(updated.volume, 0.95);
  assert.ok(updated.lastDialogue.includes('Waffles'));
  assert.ok(updated.lastDialogue.includes('Maya'));
});

test('normalizeBrainResponse coerces full 8-field output cleanly', () => {
  const normalized = normalizeBrainResponse(
    {
      pet_dialogue: 'Hey Maya, I am right here with you.',
      pet_animation: 'Comforting_Nuzzle',
      audio_command: 'play_rain_sounds',
      ui_bg_color: '#1F2937',
      user_wallet_balance: 35,
      room_inventory: ['Beanbag Chair'],
      updated_stats: { happiness: 80, hunger: 64 },
      push_notification_trigger: 'null',
    },
    { petName: 'Mochi', selectedPet: 'Kuro', stats: { happiness: 70, hunger: 64 }, walletBalance: 25, roomInventory: [] }
  );

  assert.equal(normalized.pet_animation, 'Comforting_Nuzzle');
  assert.equal(normalized.audio_command, 'play_rain_sounds');
  assert.equal(normalized.ui_bg_color, '#1F2937');
  assert.equal(normalized.user_wallet_balance, 35);
  assert.deepEqual(normalized.room_inventory, ['Beanbag Chair']);
  assert.equal(normalized.push_notification_trigger, null);
});

test('purchaseShopItem deducts coins, adds furniture to roomInventory, and sets #D4AF37', () => {
  const initial = createInitialPetState({ petId: 'Bloop', petName: 'Squish', userName: 'Sam', initialized: true }, 1700000000000);
  const beanbag = SHOP_ITEMS.find((i) => i.name === 'Beanbag Chair')!;
  const res1 = purchaseShopItem(initial, beanbag, 1700000010000);
  assert.equal(res1.ok, true);
  assert.equal(res1.state.walletBalance, 5);
  assert.deepEqual(res1.state.roomInventory, ['Beanbag Chair']);
  assert.equal(res1.state.uiBgColor, '#D4AF37');
});

test('applyElapsedDecay triggers push notification using petName and #8B0000 when hunger < 30', () => {
  const initial = createInitialPetState({ petId: 'Kuro', petName: 'Shadow', userName: 'Sam', initialized: true }, 1700000000000);
  const decayed = applyElapsedDecay(initial, 180);
  assert.equal(decayed.stats.hunger, 28);
  assert.equal(decayed.currentAnimation, 'Angry_Hiss');
  assert.equal(decayed.uiBgColor, '#8B0000');
  assert.ok(decayed.pushNotification && decayed.pushNotification.includes('Shadow'));
});

test('getMoodForHappiness & applyHappinessLevelPreview map low happiness to Angry/Red and close-to-mad to Sad/Blue', () => {
  const initial = createInitialPetState({ petId: 'Kuro', petName: 'Kuro', userName: 'Maya', initialized: true });

  // Low happiness (<= 25) -> Angry_Hiss + Red (#8B0000)
  const lowMood = getMoodForHappiness(15);
  assert.equal(lowMood.animation, 'Angry_Hiss');
  assert.equal(lowMood.bgColor, '#8B0000');

  const afterLow = applyHappinessLevelPreview(initial, 15);
  assert.equal(afterLow.stats.happiness, 15);
  assert.equal(afterLow.currentAnimation, 'Angry_Hiss');
  assert.equal(afterLow.uiBgColor, '#8B0000');
  assert.equal(afterLow.lastBrainResponse.pet_animation, 'Angry_Hiss');
  assert.equal(afterLow.lastBrainResponse.ui_bg_color, '#8B0000');
  assert.equal(afterLow.lastBrainResponse.updated_stats.happiness, 15);

  // Close to mad (26..45) -> Sad_Ears_Down + Blue (#1F2937)
  const closeToMadMood = getMoodForHappiness(35);
  assert.equal(closeToMadMood.animation, 'Sad_Ears_Down');
  assert.equal(closeToMadMood.bgColor, '#1F2937');

  const afterCloseToMad = applyHappinessLevelPreview(afterLow, 35);
  assert.equal(afterCloseToMad.stats.happiness, 35);
  assert.equal(afterCloseToMad.currentAnimation, 'Sad_Ears_Down');
  assert.equal(afterCloseToMad.uiBgColor, '#1F2937');
  assert.equal(afterCloseToMad.lastBrainResponse.pet_animation, 'Sad_Ears_Down');
  assert.equal(afterCloseToMad.lastBrainResponse.ui_bg_color, '#1F2937');
  assert.equal(afterCloseToMad.lastBrainResponse.updated_stats.happiness, 35);
});

test('applyPetTap and settleAfterPetting transition Angry->Sad/Blue at 40 and Happy/Gold at 100', () => {
  const initial = createInitialPetState({ petId: 'Barnaby', petName: 'snappy', userName: 'krish', initialized: true });
  let state = applyHappinessLevelPreview(initial, 15);
  assert.equal(state.uiBgColor, '#8B0000');
  assert.equal(state.currentAnimation, 'Angry_Hiss');
  assert.ok(state.pushNotification);

  // Pet 5 times: 15 -> 20 -> 25 -> 30 -> 35 -> 40
  for (let i = 0; i < 5; i += 1) {
    state = applyPetTap(state);
  }
  assert.equal(state.stats.happiness, 40);
  assert.equal(state.uiBgColor, '#1F2937');
  assert.equal(state.pushNotification, null);
  assert.equal(state.currentAnimation, 'Comforting_Nuzzle');

  // User stops petting at 40 -> settles to Sad_Ears_Down & Blue (#1F2937)
  const settledAt40 = settleAfterPetting(state);
  assert.equal(settledAt40.currentAnimation, 'Sad_Ears_Down');
  assert.equal(settledAt40.uiBgColor, '#1F2937');
  assert.equal(settledAt40.lastBrainResponse.pet_animation, 'Sad_Ears_Down');
  assert.equal(settledAt40.lastBrainResponse.ui_bg_color, '#1F2937');

  // Keep petting up to 100 -> immediately Happy_Bounce & Gold (#D4AF37), no lonely alert
  for (let i = 0; i < 12; i += 1) {
    state = applyPetTap(state);
  }
  assert.equal(state.stats.happiness, 100);
  assert.equal(state.currentAnimation, 'Happy_Bounce');
  assert.equal(state.uiBgColor, '#D4AF37');
  assert.equal(state.pushNotification, null);
});

test('applyHungerLevelPreview lowers happiness without matching hunger identically', () => {
  const initial = createInitialPetState({ petId: 'Kuro', petName: 'Kuro', userName: 'Maya', initialized: true });
  assert.equal(initial.stats.happiness, 74);

  // Hungry (35) -> pulls happiness into 26..45 Sad/Blue zone while staying distinct from 35
  const hungry = applyHungerLevelPreview(initial, 35);
  assert.equal(hungry.stats.hunger, 35);
  assert.notEqual(hungry.stats.happiness, hungry.stats.hunger);
  assert.ok(hungry.stats.happiness >= 26 && hungry.stats.happiness <= 45);
  assert.equal(hungry.currentAnimation, 'Sad_Ears_Down');
  assert.equal(hungry.uiBgColor, '#1F2937');

  // Starving (15) -> pulls happiness into <= 25 Angry/Red zone while staying distinct from 15
  const starving = applyHungerLevelPreview(hungry, 15);
  assert.equal(starving.stats.hunger, 15);
  assert.notEqual(starving.stats.happiness, starving.stats.hunger);
  assert.ok(starving.stats.happiness <= 25);
  assert.equal(starving.currentAnimation, 'Angry_Hiss');
  assert.equal(starving.uiBgColor, '#8B0000');
  assert.ok(starving.pushNotification && starving.pushNotification.includes('Kuro'));

  // Feeding to Full (90) -> recovers happiness >= 75 (Happy_Bounce + Gold) while staying distinct from 90
  const fed = applyHungerLevelPreview(starving, 90);
  assert.equal(fed.stats.hunger, 90);
  assert.notEqual(fed.stats.happiness, fed.stats.hunger);
  assert.ok(fed.stats.happiness >= 75);
  assert.equal(fed.currentAnimation, 'Happy_Bounce');
  assert.equal(fed.uiBgColor, '#D4AF37');
  assert.equal(fed.pushNotification, null);
});

test('Fish Bowl requires owning Cozy Table first and spawns atop Cozy Table when bought', () => {
  const initial = createInitialPetState({ petId: 'Kuro', petName: 'Kuro', userName: 'Maya', initialized: true });
  const wealthy = { ...initial, walletBalance: 120 };
  const fishBowl = SHOP_ITEMS.find((i) => i.name === 'Fish Bowl')!;
  const cozyTable = SHOP_ITEMS.find((i) => i.name === 'Cozy Table')!;

  const blocked = purchaseShopItem(wealthy, fishBowl);
  assert.equal(blocked.ok, false);
  assert.ok(blocked.reason && blocked.reason.includes('Cozy Table'));

  const boughtTable = purchaseShopItem(wealthy, cozyTable);
  assert.equal(boughtTable.ok, true);
  assert.ok(boughtTable.state.roomInventory.includes('Cozy Table'));

  const boughtBowl = purchaseShopItem(boughtTable.state, fishBowl);
  assert.equal(boughtBowl.ok, true);
  assert.ok(boughtBowl.state.roomInventory.includes('Fish Bowl'));
  const tablePos = boughtBowl.state.roomLayout['Cozy Table']!;
  const bowlPos = boughtBowl.state.roomLayout['Fish Bowl']!;
  assert.equal(bowlPos.x, tablePos.x);
  assert.ok(Math.abs(bowlPos.y - (tablePos.y - 0.16)) < 0.005);
});

test('updateRoomItemPosition clamps coordinates and moves Fish Bowl together with Cozy Table when resting on tabletop', () => {
  const initial = createInitialPetState({ petId: 'Kuro', petName: 'Kuro', userName: 'Maya', initialized: true });
  const cozyTable = SHOP_ITEMS.find((i) => i.name === 'Cozy Table')!;
  const fishBowl = SHOP_ITEMS.find((i) => i.name === 'Fish Bowl')!;

  const s1 = purchaseShopItem({ ...initial, walletBalance: 100 }, cozyTable).state;
  const s2 = purchaseShopItem(s1, fishBowl).state;

  const movedTable = updateRoomItemPosition(s2, 'Cozy Table', { x: 0.4, y: 0.82 });
  assert.equal(movedTable.roomLayout['Cozy Table']!.x, 0.4);
  assert.equal(movedTable.roomLayout['Cozy Table']!.y, 0.82);
  assert.equal(movedTable.roomLayout['Fish Bowl']!.x, 0.4);
  assert.ok(Math.abs(movedTable.roomLayout['Fish Bowl']!.y - 0.66) < 0.005);

  // Out-of-bounds values clamp cleanly inside room bounds
  const clamped = updateRoomItemPosition(movedTable, 'Beanbag Chair', { x: -0.5, y: 2.0 });
  assert.equal(clamped.roomLayout['Beanbag Chair']!.x, 0.07);
  assert.equal(clamped.roomLayout['Beanbag Chair']!.y, 0.92);
});

test('getHoverEmoteForStats maps happiness, hunger, and sleeping states to distinct transient icons', () => {
  assert.equal(getHoverEmoteForStats({ happiness: 85, hunger: 80 }).kind, 'heart');
  assert.equal(getHoverEmoteForStats({ happiness: 65, hunger: 60 }).kind, 'star');
  assert.equal(getHoverEmoteForStats({ happiness: 52, hunger: 50 }).kind, 'question');
  assert.equal(getHoverEmoteForStats({ happiness: 80, hunger: 20 }).kind, 'hungry');
  assert.equal(getHoverEmoteForStats({ happiness: 20, hunger: 70 }).kind, 'anger');
  assert.equal(getHoverEmoteForStats({ happiness: 35, hunger: 70 }).kind, 'sad');
  assert.equal(getHoverEmoteForStats({ happiness: 85, hunger: 80 }, true).kind, 'sleep');
});

test('toggleSleepMode pauses stat decay during long work sessions and wakes cleanly', () => {
  const initial = createInitialPetState({ petId: 'Kuro', petName: 'Kuro', userName: 'Maya', initialized: true });
  const sleeping = toggleSleepMode(initial, true);
  assert.equal(sleeping.isSleeping, true);
  assert.equal(sleeping.pushNotification, null);

  // Even after 300 minutes (5 hours), sleeping pet loses 0 hunger and 0 happiness
  const afterWork = applyElapsedDecay(sleeping, 300);
  assert.equal(afterWork.stats.hunger, initial.stats.hunger);
  assert.equal(afterWork.stats.happiness, initial.stats.happiness);
  assert.equal(afterWork.pushNotification, null);

  // Waking up restores normal mood & allows work resumption
  const awake = toggleSleepMode(afterWork, false);
  assert.equal(awake.isSleeping, false);
  assert.ok(awake.lastDialogue.includes('Maya'));
});

test('getPetEvolution maps task completion milestones (0, 10, 50, 100) and completeTaskLocally celebrates level-ups', () => {
  const lv1Start = getPetEvolution(0);
  assert.equal(lv1Start.level, 1);
  assert.equal(lv1Start.title, 'Rookie');
  assert.equal(lv1Start.nextMilestone, 10);
  assert.equal(lv1Start.progressPct, 0);

  const lv1Near = getPetEvolution(9);
  assert.equal(lv1Near.level, 1);
  assert.equal(lv1Near.progressPct, 90);

  const lv2 = getPetEvolution(10);
  assert.equal(lv2.level, 2);
  assert.equal(lv2.title, 'Focused');
  assert.equal(lv2.nextMilestone, 50);
  assert.equal(lv2.progressPct, 0);

  const lv3 = getPetEvolution(50);
  assert.equal(lv3.level, 3);
  assert.equal(lv3.title, 'Guardian');
  assert.equal(lv3.nextMilestone, 100);
  assert.equal(lv3.progressPct, 0);

  const lv4 = getPetEvolution(100);
  assert.equal(lv4.level, 4);
  assert.equal(lv4.title, 'Ascended');
  assert.equal(lv4.nextMilestone, null);
  assert.equal(lv4.progressPct, 100);

  const lv4High = getPetEvolution(125);
  assert.equal(lv4High.level, 4);
  assert.equal(lv4High.progressPct, 100);

  // Completing the 10th task triggers evolution celebration in dialogue
  const base = createInitialPetState({ petId: 'Barnaby', petName: 'Barnaby', userName: 'Maya', initialized: true });
  const atNine = { ...base, tasksCompletedCount: 9 };
  const tenth = completeTaskLocally(atNine, atNine.tasks[0]!.id);
  assert.ok(tenth.completedTask);
  assert.equal(tenth.state.tasksCompletedCount, 10);
  assert.ok(tenth.state.lastDialogue.includes('Lv.2'));
  assert.ok(tenth.state.lastDialogue.includes('Focused'));
});

test('Otto Dachshund initializes cleanly and celebrates shop purchases', () => {
  const initial = createInitialPetState({ petId: 'Otto', petName: 'Slinky', userName: 'Maya', initialized: true });
  assert.equal(initial.selectedPet, 'Otto');
  assert.equal(initial.petName, 'Slinky');
  const rug = SHOP_ITEMS.find((i) => i.name === 'Soft Rug')!;
  const bought = purchaseShopItem(initial, rug);
  assert.equal(bought.ok, true);
  assert.ok(bought.state.lastDialogue.includes('Soft Rug'));
  assert.ok(bought.state.lastDialogue.includes('Maya'));
});

test('timed sleep sets sleepUntil for 10/20/30 mins, formats countdown, and auto-wakes on expiration', () => {
  const t0 = 1700000000000;
  const initial = createInitialPetState({ petId: 'Otto', petName: 'Otto', userName: 'Maya', initialized: true }, t0);

  const sleep20 = toggleSleepMode(initial, true, t0, 20);
  assert.equal(sleep20.isSleeping, true);
  assert.equal(sleep20.sleepUntil, t0 + 20 * 60_000);
  assert.ok(sleep20.lastDialogue.includes('20-minute nap'));
  assert.equal(formatSleepCountdown(sleep20.sleepUntil, t0), '20:00');
  assert.equal(formatSleepCountdown(sleep20.sleepUntil, t0 + 65_000), '18:55');

  // Before timer ends, pet stays asleep
  const stillSleeping = checkSleepExpiration(sleep20, t0 + 19 * 60_000);
  assert.equal(stillSleeping.isSleeping, true);

  // At or after sleepUntil, pet wakes automatically with refreshed dialogue
  const woken = checkSleepExpiration(sleep20, t0 + 20 * 60_000);
  assert.equal(woken.isSleeping, false);
  assert.equal(woken.sleepUntil, null);
  assert.ok(woken.lastDialogue.includes('Maya'));
});

test('low happiness enforces Angry_Hiss and #8B0000 even when AI picks Comforting_Nuzzle and #1F2937', () => {
  const normalized = normalizeBrainResponse(
    {
      pet_dialogue: 'Breathing with you right now.',
      pet_animation: 'Comforting_Nuzzle',
      audio_command: 'play_rain_sounds',
      ui_bg_color: '#1F2937',
      user_wallet_balance: 130,
      room_inventory: ['Beanbag Chair'],
      updated_stats: { happiness: 5, hunger: 0 },
      push_notification_trigger: null,
    },
    { petName: 'max', selectedPet: 'Otto', stats: { happiness: 20, hunger: 10 }, walletBalance: 130, roomInventory: ['Beanbag Chair'] }
  );

  assert.equal(normalized.pet_animation, 'Angry_Hiss');
  assert.equal(normalized.ui_bg_color, '#8B0000');
  assert.ok(normalized.push_notification_trigger);

  const stale = createInitialPetState({ petId: 'Otto', petName: 'max', userName: 'krish', initialized: true });
  const mismatched = {
    ...stale,
    stats: { happiness: 5, hunger: 0 },
    currentAnimation: 'Comforting_Nuzzle' as const,
    uiBgColor: '#1F2937' as const,
  };
  const reconciled = reconcileMoodWithStats(mismatched);
  assert.equal(reconciled.currentAnimation, 'Angry_Hiss');
  assert.equal(reconciled.uiBgColor, '#8B0000');
  assert.equal(reconciled.lastBrainResponse.pet_animation, 'Angry_Hiss');
  assert.equal(reconciled.lastBrainResponse.ui_bg_color, '#8B0000');
});

test('Treat Catch mini-game and coin pantry snack feed pet cleanly without any tasks', () => {
  const initial = createInitialPetState({ petId: 'Otto', petName: 'max', userName: 'krish', initialized: true });
  const hungry = {
    ...initial,
    tasks: [],
    walletBalance: 10,
    stats: { happiness: 15, hunger: 10 },
    currentAnimation: 'Angry_Hiss' as const,
    uiBgColor: '#8B0000' as const,
  };

  // 1. Coin quick snack costs 5c, adds +15 hunger & +6 happiness (leaving stats distinct)
  const snackRes = feedQuickTreatWithCoins(hungry);
  assert.equal(snackRes.ok, true);
  assert.equal(snackRes.state.walletBalance, 5);
  assert.equal(snackRes.state.stats.hunger, 25);
  assert.equal(snackRes.state.stats.happiness, 21);

  // 2. Treat Catch mini-game physics: catch 1 normal treat + 1 golden star, avoid burnt
  let round = createTreatRoundState('PLAYING');
  round = {
    ...round,
    bowlX: 0.5,
    snacks: [
      { id: 10, kind: 'treat', x: 0.5, y: 0.82, speed: 0.5, radius: 0.06, swayPhase: 0 },
      { id: 11, kind: 'golden', x: 0.52, y: 0.83, speed: 0.5, radius: 0.055, swayPhase: 0 },
      { id: 12, kind: 'burnt', x: 0.12, y: 0.82, speed: 0.5, radius: 0.06, swayPhase: 0 },
    ],
  };
  const stepped = stepTreatRound(round, 0.05, 0.5);
  assert.deepEqual(stepped.events.sort(), ['golden', 'treat']);
  assert.equal(stepped.state.treatsCaught, 1);
  assert.equal(stepped.state.goldenCaught, 1);
  assert.equal(stepped.state.burntHit, 0);
  assert.equal(stepped.state.streak, 2);

  const rewards = computeTreatRewards(stepped.state);
  assert.ok(rewards.hungerGain >= 10);
  assert.ok(rewards.happinessGain >= 4);
  assert.ok(rewards.coinsEarned >= 2);

  // Applying mini-game rewards feeds Otto and logs treat reaction in chat
  const afterGame = applyMiniGameFeed(snackRes.state, rewards);
  assert.ok(afterGame.stats.hunger > snackRes.state.stats.hunger);
  assert.ok(afterGame.stats.happiness > snackRes.state.stats.happiness);
  assert.notEqual(afterGame.stats.happiness, afterGame.stats.hunger);
  assert.equal(afterGame.walletBalance, snackRes.state.walletBalance + rewards.coinsEarned);
  assert.ok(afterGame.lastDialogue.includes('krish'));
});
