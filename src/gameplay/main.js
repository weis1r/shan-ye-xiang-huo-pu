const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");

const startBtn = document.getElementById("start-btn");
const actionBtn = document.getElementById("action-btn");
const restartBtn = document.getElementById("restart-btn");
const mobileGuidance = document.getElementById("mobile-guidance");
const mobileGuidanceCopy = document.getElementById("mobile-guidance-copy");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const FIXED_STEP = 1 / 60;
const DATA_URL = "./assets/data/festival-content.json";
const DEFAULT_PALETTE = ["#efd49a", "#d98d4e", "#6e8a65"];

let content = null;
let animationFrame = 0;
let previousTs = 0;
let inputCooldown = 0;

const state = {
  mode: "loading",
  dayIndex: 0,
  coins: 0,
  reputation: 0,
  harmony: 0,
  bustle: 0,
  streak: 0,
  selectedGood: 0,
  selectedFocus: 0,
  selectedNightOption: 0,
  inventory: {},
  guestsServed: 0,
  missedGuests: 0,
  specialGuestsServed: 0,
  perfectSales: 0,
  currentGuest: null,
  guestQueue: [],
  activeCardRects: [],
  dayResult: null,
  dayHighlights: [],
  message: "庙口的风还在路上。",
  messageTimer: 0,
  guestClock: 0,
  lanterns: [],
  petals: [],
  pulse: 0,
  paused: false,
  beat: 0,
  activeDayModifiers: emptyModifier(),
  nextDayModifiers: emptyModifier(),
  activeBoonLabels: [],
  nextDayBoonLabels: [],
  recentNightEvent: null,
  errorText: "",
};

const keys = new Set();

function isTouchLayout() {
  return (
    window.matchMedia("(pointer: coarse)").matches ||
    window.matchMedia("(hover: none)").matches ||
    window.innerWidth <= 900
  );
}

function isPortraitLayout() {
  return window.innerHeight > window.innerWidth;
}

function shouldShowMobileGuidance() {
  return isTouchLayout() && isPortraitLayout();
}

function updateResponsiveUI() {
  const showGuidance = shouldShowMobileGuidance();
  mobileGuidance?.classList.toggle("hidden", !showGuidance);

  if (mobileGuidanceCopy) {
    mobileGuidanceCopy.textContent = showGuidance
      ? "竖屏也能继续试玩，但横过来能更清楚地看见来客、货品和夜里布置。"
      : "轻触卡片和红色按钮就能继续经营，横屏时能一眼看清整张案台。";
  }

  draw();
}

function getMenuHintText() {
  if (!isTouchLayout()) {
    return "按 F 全屏，Esc 退出全屏，R 可随时重开。";
  }
  if (isPortraitLayout()) {
    return "轻触红色按钮开张；竖屏也能玩，但横过来会更舒服。";
  }
  return "轻触红色按钮和卡片即可经营，横屏时来客与货品会更清楚。";
}

function getPrepHintText() {
  if (isTouchLayout()) {
    return "轻触幡头切换今日摊口，再点红色按钮开市。";
  }
  return "左右键换幡头，空格或按钮开市。也可直接点击卡片。";
}

function getNightHintText() {
  if (isTouchLayout()) {
    return "轻触夜里安排切换方案，再点红色按钮定下明日布置。";
  }
  return "左右键切换夜里安排，空格确认。点击卡片可选择。";
}

function getRestartHintText() {
  if (isTouchLayout()) {
    return "右上角可随时重开这天";
  }
  return "按 R 重开本轮";
}

function emptyModifier() {
  return {
    stock: {},
    patience: 0,
    correct: {
      coins: 0,
      reputation: 0,
      harmony: 0,
    },
    goodCorrect: {},
    startBustle: 0,
    comboCoins: 0,
  };
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function mergeReward(target, incoming) {
  if (!incoming) {
    return target;
  }
  target.coins += incoming.coins || 0;
  target.reputation += incoming.reputation || 0;
  target.harmony += incoming.harmony || 0;
  target.bustle += incoming.bustle || 0;
  return target;
}

function mergeModifier(target, incoming) {
  if (!incoming) {
    return target;
  }

  if (incoming.stock) {
    for (const [goodId, value] of Object.entries(incoming.stock)) {
      target.stock[goodId] = (target.stock[goodId] || 0) + value;
    }
  }

  if (incoming.patience) {
    target.patience += incoming.patience;
  }

  if (incoming.correct) {
    target.correct.coins += incoming.correct.coins || 0;
    target.correct.reputation += incoming.correct.reputation || 0;
    target.correct.harmony += incoming.correct.harmony || 0;
  }

  if (incoming.goodCorrect) {
    for (const [goodId, bonus] of Object.entries(incoming.goodCorrect)) {
      if (!target.goodCorrect[goodId]) {
        target.goodCorrect[goodId] = {
          coins: 0,
          reputation: 0,
          harmony: 0,
        };
      }
      target.goodCorrect[goodId].coins += bonus.coins || 0;
      target.goodCorrect[goodId].reputation += bonus.reputation || 0;
      target.goodCorrect[goodId].harmony += bonus.harmony || 0;
    }
  }

  if (incoming.startBustle) {
    target.startBustle += incoming.startBustle;
  }

  if (incoming.comboCoins) {
    target.comboCoins += incoming.comboCoins;
  }

  return target;
}

function getSystems() {
  return (
    content?.systems || {
      startingResources: { coins: 12, reputation: 0, harmony: 0 },
      startingBustle: 1,
      baseInventory: 4,
      spawnDelay: 0.75,
      patienceBase: 14,
      correctRewards: { reputation: 2, harmony: 1 },
      wrongSale: { minimumCoins: 1, reputation: -1, bustle: -1 },
      timeoutPenalty: { reputation: -2, bustle: -2 },
      bustle: { tierStep: 3, maxTier: 3, coinPerTier: 1, correctGain: 1 },
      summaryMoodThresholds: [],
      endingThresholds: [],
    }
  );
}

function getGoods() {
  return content?.goods || [];
}

function getFocusOptions() {
  return content?.focusOptions || [];
}

function getDays() {
  return content?.festivalDays || [];
}

function getCurrentDay() {
  return getDays()[state.dayIndex] || null;
}

function getCurrentFocus() {
  return getFocusOptions()[state.selectedFocus] || null;
}

function getCurrentNightOptions() {
  return getCurrentDay()?.nightEvents || [];
}

function getSelectedGood() {
  return getGoods()[state.selectedGood] || getGoods()[0];
}

function getGoodById(goodId) {
  return getGoods().find((good) => good.id === goodId);
}

function initializeDecor() {
  state.lanterns = Array.from({ length: 6 }, (_, index) => ({
    x: 120 + index * 190,
    y: 90 + (index % 2) * 24,
    sway: index * 0.7,
    size: 28 + (index % 3) * 6,
  }));

  state.petals = Array.from({ length: 24 }, (_, index) => ({
    x: (index * 53) % WIDTH,
    y: 140 + (index * 37) % 440,
    speed: 12 + (index % 5) * 4,
    drift: 8 + (index % 4) * 3,
    phase: index * 0.4,
  }));
}

async function loadFestivalContent() {
  const response = await fetch(DATA_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`无法读取数据文件：${response.status}`);
  }
  return response.json();
}

function resetDayStats() {
  state.guestsServed = 0;
  state.missedGuests = 0;
  state.specialGuestsServed = 0;
  state.perfectSales = 0;
  state.dayHighlights = [];
  state.dayResult = null;
  state.currentGuest = null;
  state.guestClock = 0;
  state.selectedNightOption = 0;
  state.recentNightEvent = null;
}

function resetGame() {
  if (!content) {
    return;
  }

  const systems = getSystems();
  state.mode = "prep";
  state.dayIndex = 0;
  state.coins = systems.startingResources.coins;
  state.reputation = systems.startingResources.reputation;
  state.harmony = systems.startingResources.harmony;
  state.bustle = systems.startingBustle;
  state.streak = 0;
  state.selectedGood = 0;
  state.selectedFocus = 0;
  state.inventory = {};
  state.activeDayModifiers = emptyModifier();
  state.nextDayModifiers = emptyModifier();
  state.activeBoonLabels = [];
  state.nextDayBoonLabels = [];
  state.activeCardRects = [];
  state.paused = false;
  resetDayStats();
  setMessage("庙会将起，先定今日摊口风味。", 3);
  prepareDay();
  syncButtons();
}

function prepareDay() {
  const day = getCurrentDay();
  if (!day) {
    showEnding();
    return;
  }

  state.mode = "prep";
  state.activeDayModifiers = emptyModifier();
  mergeModifier(state.activeDayModifiers, day.dayBlessing?.effects);
  mergeModifier(state.activeDayModifiers, state.nextDayModifiers);

  state.activeBoonLabels = [];
  if (day.dayBlessing?.label) {
    state.activeBoonLabels.push(day.dayBlessing.label);
  }
  state.activeBoonLabels.push(...state.nextDayBoonLabels);

  state.nextDayModifiers = emptyModifier();
  state.nextDayBoonLabels = [];

  state.inventory = buildInventory(getCurrentFocus().effects);
  state.guestQueue = day.guests.map((entry) => deepClone(entry));
  state.selectedGood = 0;
  state.bustle = Math.max(
    0,
    getSystems().startingBustle + state.activeDayModifiers.startBustle,
  );
  state.streak = 0;
  state.activeCardRects = [];
  setMessage(`第 ${day.id} 天：${day.title}。先挑幡头，再开市迎客。`, 4);
  syncButtons();
}

function buildInventory(focusEffects) {
  const inventory = {};
  const baseInventory = getSystems().baseInventory;
  for (const good of getGoods()) {
    inventory[good.id] = baseInventory;
  }

  for (const [goodId, value] of Object.entries(focusEffects?.stock || {})) {
    inventory[goodId] += value;
  }

  for (const [goodId, value] of Object.entries(state.activeDayModifiers.stock || {})) {
    inventory[goodId] = (inventory[goodId] || 0) + value;
  }

  return inventory;
}

function startService() {
  state.mode = "market";
  spawnNextGuest();
  syncButtons();
}

function calculatePatienceForGuest(guest) {
  const focus = getCurrentFocus();
  const base =
    getSystems().patienceBase +
    state.activeDayModifiers.patience +
    (focus.effects?.patience || 0);
  const specialScale = guest.special?.patienceScale || 1;
  return Math.max(6, Math.round(base * specialScale * 10) / 10);
}

function spawnNextGuest() {
  if (state.guestQueue.length === 0) {
    endDay();
    return;
  }

  state.currentGuest = state.guestQueue.shift();
  state.currentGuest.patienceMax = calculatePatienceForGuest(state.currentGuest);
  state.currentGuest.patience = state.currentGuest.patienceMax;
  state.guestClock = 0;
  state.selectedGood = 0;
  setMessage(`${state.currentGuest.name} 来了：${state.currentGuest.wish}`, 3.4);
}

function getBustleTierBonus() {
  const bustleRules = getSystems().bustle;
  const tier = Math.min(
    bustleRules.maxTier,
    Math.floor(state.bustle / bustleRules.tierStep),
  );
  return tier * bustleRules.coinPerTier;
}

function addDelta(delta) {
  state.coins = Math.max(0, state.coins + (delta.coins || 0));
  state.reputation = Math.max(-20, state.reputation + (delta.reputation || 0));
  state.harmony = Math.max(0, state.harmony + (delta.harmony || 0));
  state.bustle = Math.max(0, state.bustle + (delta.bustle || 0));
}

function formatDeltaSegments(delta) {
  const segments = [];
  if (delta.coins) {
    segments.push(`${delta.coins > 0 ? "+" : ""}${delta.coins} 铜钱`);
  }
  if (delta.reputation) {
    segments.push(`${delta.reputation > 0 ? "+" : ""}${delta.reputation} 口碑`);
  }
  if (delta.harmony) {
    segments.push(`${delta.harmony > 0 ? "+" : ""}${delta.harmony} 缘分`);
  }
  if (delta.bustle) {
    segments.push(`${delta.bustle > 0 ? "+" : ""}${delta.bustle} 热闹`);
  }
  return segments;
}

function rewardFromBonuses(baseReward, bonus) {
  if (!bonus) {
    return baseReward;
  }
  baseReward.coins += bonus.coins || 0;
  baseReward.reputation += bonus.reputation || 0;
  baseReward.harmony += bonus.harmony || 0;
  return baseReward;
}

function queueNextDayModifier(modifier, label) {
  if (!modifier) {
    return;
  }
  mergeModifier(state.nextDayModifiers, modifier);
  if (label) {
    state.nextDayBoonLabels.push(label);
  }
}

function markHighlight(text) {
  state.dayHighlights.push(text);
}

function applySpecialGuestCorrect(special, patienceRatio, reward) {
  if (!special) {
    return [];
  }

  const notes = [];
  if (special.onCorrect) {
    mergeReward(reward, special.onCorrect);
    notes.push(`${special.badge}回礼`);
  }

  if (special.fastServe && patienceRatio >= special.fastServe.threshold) {
    mergeReward(reward, special.fastServe);
    notes.push("赶在心气最足的时候应手了");
  }

  if (special.nextDay) {
    queueNextDayModifier(special.nextDay, special.nextDayBoonLabel);
    notes.push("还为明日留了回礼");
  }

  return notes;
}

function serveSelectedGood() {
  if (state.mode !== "market" || !state.currentGuest) {
    return;
  }

  const good = getSelectedGood();
  if ((state.inventory[good.id] || 0) <= 0) {
    setMessage(`${good.label} 已经卖空了。`, 2.2);
    return;
  }

  const guest = state.currentGuest;
  const patienceRatio = guest.patience / guest.patienceMax;

  state.inventory[good.id] -= 1;

  if (good.id === guest.desiredGood) {
    const reward = {
      coins: good.price + getBustleTierBonus(),
      reputation: getSystems().correctRewards.reputation,
      harmony: getSystems().correctRewards.harmony,
      bustle: getSystems().bustle.correctGain,
    };

    rewardFromBonuses(reward, getCurrentFocus().effects?.correct);
    rewardFromBonuses(reward, getCurrentFocus().effects?.goodCorrect?.[good.id]);
    rewardFromBonuses(reward, state.activeDayModifiers.correct);
    rewardFromBonuses(reward, state.activeDayModifiers.goodCorrect?.[good.id]);

    if (state.streak >= 1 && state.activeDayModifiers.comboCoins > 0) {
      reward.coins += state.activeDayModifiers.comboCoins;
    }

    const specialNotes = applySpecialGuestCorrect(guest.special, patienceRatio, reward);

    addDelta(reward);
    state.perfectSales += 1;
    state.guestsServed += 1;
    state.streak += 1;
    if (guest.special) {
      state.specialGuestsServed += 1;
      markHighlight(`${guest.name} 留下了稀客回礼。`);
    }

    const segments = formatDeltaSegments(reward);
    let message = `${guest.name} 满意离去。${segments.join("，")}`;
    if (specialNotes.length > 0) {
      message += `。${specialNotes.join("，")}。`;
    }
    setMessage(message, 3.2);
  } else {
    const wrongRule = getSystems().wrongSale;
    const wrongDelta = {
      coins: Math.max(wrongRule.minimumCoins, Math.floor(good.price / 2)),
      reputation: wrongRule.reputation,
      harmony: 0,
      bustle: wrongRule.bustle,
    };
    addDelta(wrongDelta);
    state.guestsServed += 1;
    state.streak = 0;
    setMessage(
      `${guest.name} 将就收下了 ${good.label}。${formatDeltaSegments(wrongDelta).join("，")}`,
      2.8,
    );
  }

  state.currentGuest = null;
  state.guestClock = 0;
}

function updateMarket(dt) {
  const systems = getSystems();

  if (!state.currentGuest) {
    state.guestClock += dt;
    if (state.guestClock > systems.spawnDelay) {
      spawnNextGuest();
    }
    return;
  }

  state.currentGuest.patience -= dt;
  state.guestClock += dt;
  if (state.currentGuest.patience <= 0) {
    const timeoutDelta = deepClone(systems.timeoutPenalty);
    addDelta(timeoutDelta);
    state.missedGuests += 1;
    state.streak = 0;
    setMessage(
      `${state.currentGuest.name} 等得太久，摇头离开了。${formatDeltaSegments(timeoutDelta).join("，")}`,
      2.8,
    );
    state.currentGuest = null;
    state.guestClock = 0;
  }
}

function pickMoodLabel(score) {
  for (const rule of getSystems().summaryMoodThresholds) {
    if (score >= rule.min) {
      return rule.label;
    }
  }
  return "尚可一试";
}

function endDay() {
  const day = getCurrentDay();
  const dayScore =
    state.perfectSales * 2 +
    state.specialGuestsServed * 3 +
    state.bustle +
    state.harmony +
    state.reputation;

  state.dayResult = {
    title: day.title,
    mood: pickMoodLabel(dayScore),
    served: state.guestsServed,
    missed: state.missedGuests,
    coins: state.coins,
    reputation: state.reputation,
    harmony: state.harmony,
    bustle: state.bustle,
    specials: state.specialGuestsServed,
    highlights: [...state.dayHighlights],
  };
  state.mode = "summary";
  setMessage(`第 ${day.id} 天收市：${state.dayResult.mood}`, 4);
  syncButtons();
}

function enterNightMode() {
  state.mode = "night";
  state.selectedNightOption = 0;
  setMessage(getCurrentDay()?.nightSubtitle || "夜里还有一轮布置。", 4);
  syncButtons();
}

function canAffordEffect(effect) {
  if (!effect) {
    return true;
  }
  if ((effect.coins || 0) < 0 && state.coins < Math.abs(effect.coins)) {
    return false;
  }
  if ((effect.harmony || 0) < 0 && state.harmony < Math.abs(effect.harmony)) {
    return false;
  }
  if ((effect.reputation || 0) < 0 && state.reputation < Math.abs(effect.reputation)) {
    return false;
  }
  return true;
}

function applyNightEvent() {
  const event = getCurrentNightOptions()[state.selectedNightOption];
  if (!event) {
    nextDay();
    return;
  }

  if (!canAffordEffect(event.immediate)) {
    setMessage(`还承担不起“${event.title}”的代价。`, 2.4);
    return;
  }

  addDelta(event.immediate || {});
  queueNextDayModifier(event.nextDay, event.boonLabel);
  state.recentNightEvent = event.title;
  state.dayHighlights.push(`夜里定下：${event.title}`);
  nextDay();
}

function nextDay() {
  state.dayIndex += 1;
  resetDayStats();
  state.selectedFocus = (state.selectedFocus + 1) % getFocusOptions().length;
  prepareDay();
}

function showEnding() {
  state.mode = "ending";
  const total =
    state.coins + state.reputation * 2 + state.harmony * 2 + state.specialGuestsServed * 2;

  for (const rule of getSystems().endingThresholds) {
    if (total >= rule.min) {
      state.dayResult = {
        ending: rule.ending,
        text: rule.text,
        total,
      };
      break;
    }
  }

  setMessage("庙会落幕，香火还在风里。", 5);
  syncButtons();
}

function setMessage(text, duration) {
  state.message = text;
  state.messageTimer = duration;
}

function update(dt) {
  state.pulse += dt;
  state.beat += dt;
  inputCooldown = Math.max(0, inputCooldown - dt);

  if (state.messageTimer > 0) {
    state.messageTimer -= dt;
  }

  for (const petal of state.petals) {
    petal.y += petal.speed * dt;
    petal.x += Math.sin(state.beat + petal.phase) * petal.drift * dt;
    if (petal.y > HEIGHT + 20) {
      petal.y = 120;
      petal.x = (petal.x + 220) % WIDTH;
    }
  }

  if (state.paused || state.mode === "loading" || state.mode === "error") {
    return;
  }

  if (state.mode === "market") {
    updateMarket(dt);
  }
}

function handleHoldInput() {
  if (state.mode === "market") {
    if (keys.has("ArrowLeft") || keys.has("KeyA")) {
      cycleGood(-1);
    }
    if (keys.has("ArrowRight") || keys.has("KeyD")) {
      cycleGood(1);
    }
  }

  if (state.mode === "prep") {
    if (keys.has("ArrowLeft") || keys.has("KeyA")) {
      cycleFocus(-1);
    }
    if (keys.has("ArrowRight") || keys.has("KeyD")) {
      cycleFocus(1);
    }
  }

  if (state.mode === "night") {
    if (keys.has("ArrowLeft") || keys.has("KeyA")) {
      cycleNightOption(-1);
    }
    if (keys.has("ArrowRight") || keys.has("KeyD")) {
      cycleNightOption(1);
    }
  }
}

function cycleGood(direction) {
  if (inputCooldown > 0) {
    return;
  }
  inputCooldown = 0.16;
  state.selectedGood = (state.selectedGood + direction + getGoods().length) % getGoods().length;
}

function cycleFocus(direction) {
  if (inputCooldown > 0) {
    return;
  }
  inputCooldown = 0.16;
  state.selectedFocus =
    (state.selectedFocus + direction + getFocusOptions().length) % getFocusOptions().length;
  state.inventory = buildInventory(getCurrentFocus().effects);
}

function cycleNightOption(direction) {
  if (inputCooldown > 0) {
    return;
  }
  const options = getCurrentNightOptions();
  if (options.length === 0) {
    return;
  }
  inputCooldown = 0.16;
  state.selectedNightOption =
    (state.selectedNightOption + direction + options.length) % options.length;
  setMessage(options[state.selectedNightOption].desc, 2.8);
}

function triggerPrimaryAction() {
  if (state.mode === "menu") {
    resetGame();
    return;
  }
  if (state.mode === "prep") {
    startService();
    return;
  }
  if (state.mode === "market") {
    serveSelectedGood();
    return;
  }
  if (state.mode === "summary") {
    if (state.dayIndex >= getDays().length - 1) {
      showEnding();
    } else if (getCurrentNightOptions().length > 0) {
      enterNightMode();
    } else {
      nextDay();
    }
    return;
  }
  if (state.mode === "night") {
    applyNightEvent();
    return;
  }
  if (state.mode === "ending") {
    resetGame();
  }
}

function syncButtons() {
  startBtn.classList.toggle("hidden", state.mode !== "menu");
  actionBtn.classList.toggle("hidden", !["prep", "summary", "night"].includes(state.mode));
  restartBtn.classList.toggle("hidden", !["market", "night"].includes(state.mode));

  if (state.mode === "prep") {
    actionBtn.textContent = "敲锣开市";
  }
  if (state.mode === "summary") {
    actionBtn.textContent =
      state.dayIndex >= getDays().length - 1 ? "收灯看结局" : "入夜布置";
  }
  if (state.mode === "night") {
    actionBtn.textContent = "收灯布置";
  }

  if (state.mode === "market") {
    restartBtn.textContent = "重开这天";
  } else if (state.mode === "night") {
    restartBtn.textContent = "重排夜市";
  }
}

function draw() {
  drawBackground();
  drawPaperLayers();
  drawHeader();

  if (state.mode === "loading") {
    drawLoadingScreen();
  } else if (state.mode === "error") {
    drawErrorScreen();
  } else if (state.mode === "menu") {
    drawMenu();
  } else if (state.mode === "prep") {
    drawPrepScreen();
  } else if (state.mode === "market") {
    drawMarketScreen();
  } else if (state.mode === "summary") {
    drawSummaryScreen();
  } else if (state.mode === "night") {
    drawNightScreen();
  } else if (state.mode === "ending") {
    drawEndingScreen();
  }

  drawMessageRibbon();
  if (state.paused) {
    drawPauseOverlay();
  }
}

function getActivePalette() {
  return getCurrentDay()?.palette || DEFAULT_PALETTE;
}

function drawBackground() {
  const [light, warm, green] = getActivePalette();
  const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  sky.addColorStop(0, "#f8ecd1");
  sky.addColorStop(0.35, light);
  sky.addColorStop(1, "#cfab73");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = "rgba(88, 113, 86, 0.25)";
  drawMountain(0, 360, 320, 0.42);
  drawMountain(240, 410, 290, 0.34);
  drawMountain(700, 380, 360, 0.36);
  drawMountain(920, 430, 240, 0.3);

  ctx.fillStyle = "rgba(71, 56, 42, 0.2)";
  ctx.fillRect(0, 520, WIDTH, 210);

  for (const lantern of state.lanterns) {
    const sway = Math.sin(state.pulse * 1.6 + lantern.sway) * 10;
    ctx.strokeStyle = "rgba(90, 56, 34, 0.45)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(lantern.x, 0);
    ctx.lineTo(lantern.x + sway * 0.1, lantern.y - 30);
    ctx.stroke();

    const glow = ctx.createRadialGradient(
      lantern.x + sway,
      lantern.y,
      8,
      lantern.x + sway,
      lantern.y,
      lantern.size * 2.4,
    );
    glow.addColorStop(0, "rgba(255, 228, 167, 0.8)");
    glow.addColorStop(1, "rgba(255, 228, 167, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(lantern.x + sway, lantern.y, lantern.size * 2.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = warm;
    roundRect(ctx, lantern.x - 18 + sway, lantern.y - 24, 36, 50, 14, true, false);
    ctx.fillStyle = "rgba(255, 239, 201, 0.6)";
    roundRect(ctx, lantern.x - 9 + sway, lantern.y - 24, 18, 50, 8, true, false);
  }

  for (const petal of state.petals) {
    ctx.save();
    ctx.translate(petal.x, petal.y);
    ctx.rotate(Math.sin(state.beat + petal.phase) * 0.5);
    ctx.fillStyle = "rgba(190, 91, 78, 0.22)";
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 4, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.fillStyle = "rgba(98, 72, 44, 0.2)";
  ctx.fillRect(0, 606, WIDTH, 8);
}

function drawMountain(x, y, size, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.moveTo(x, HEIGHT);
  ctx.lineTo(x + size * 0.4, y);
  ctx.lineTo(x + size * 0.72, y + 58);
  ctx.lineTo(x + size, HEIGHT);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawPaperLayers() {
  ctx.fillStyle = "rgba(244, 229, 201, 0.9)";
  roundRect(ctx, 52, 46, 1176, 620, 32, true, false);
  ctx.strokeStyle = "rgba(112, 74, 46, 0.24)";
  ctx.lineWidth = 2;
  roundRect(ctx, 52, 46, 1176, 620, 32, false, true);
}

function drawHeader() {
  const day = getCurrentDay();
  ctx.fillStyle = "#4d3022";
  ctx.font = '600 34px "STKaiti", "KaiTi", serif';
  ctx.fillText("山野香火铺", 96, 104);
  ctx.font = '18px "Songti SC", Georgia, serif';
  ctx.fillStyle = "rgba(78, 47, 28, 0.72)";
  ctx.fillText(day ? `第 ${day.id} 天 · ${day.title}` : "夜里风声和灯火都在换气", 98, 136);

  drawResourcePill(730, 78, 108, "铜钱", state.coins, "#c98938");
  drawResourcePill(846, 78, 108, "口碑", state.reputation, "#4d8f59");
  drawResourcePill(962, 78, 108, "缘分", state.harmony, "#b54d46");
  drawResourcePill(1078, 78, 108, "热闹", state.bustle, "#8d613f");
}

function drawResourcePill(x, y, width, label, value, color) {
  ctx.fillStyle = "rgba(255, 248, 232, 0.82)";
  roundRect(ctx, x, y, width, 52, 18, true, false);
  ctx.fillStyle = color;
  ctx.font = '600 18px "Songti SC", Georgia, serif';
  ctx.fillText(label, x + 12, y + 22);
  ctx.fillStyle = "#3d271b";
  ctx.font = '700 24px "Songti SC", Georgia, serif';
  ctx.fillText(String(value), x + 12, y + 44);
}

function drawLoadingScreen() {
  state.activeCardRects = [];
  drawPanel(100, 190, 1080, 300, "正在挂起幡头");
  ctx.fillStyle = "#4d3022";
  ctx.font = '44px "STKaiti", "KaiTi", serif';
  ctx.fillText("正在请出节庆账本……", 134, 292);
  ctx.font = '24px "Songti SC", Georgia, serif';
  ctx.fillStyle = "rgba(79, 51, 35, 0.78)";
  ctx.fillText("把庙会天数、来客和夜里布置都从数据里装进来。", 136, 344);
}

function drawErrorScreen() {
  state.activeCardRects = [];
  drawPanel(100, 190, 1080, 300, "账本没有打开");
  ctx.fillStyle = "#4d3022";
  ctx.font = '44px "STKaiti", "KaiTi", serif';
  ctx.fillText("数据装载失败", 134, 292);
  ctx.font = '24px "Songti SC", Georgia, serif';
  ctx.fillStyle = "rgba(79, 51, 35, 0.78)";
  wrapText(state.errorText, 136, 344, 960, 34);
}

function drawMenu() {
  state.activeCardRects = [];
  ctx.fillStyle = "rgba(70, 44, 28, 0.85)";
  ctx.font = '64px "STKaiti", "KaiTi", serif';
  ctx.fillText("庙会将开", 100, 228);

  ctx.font = '28px "Songti SC", Georgia, serif';
  ctx.fillStyle = "#5d3a26";
  ctx.fillText("经营香火、供果与福牌，在白天接客、夜里布置中积攒人情与烟火。", 102, 282);

  drawPanel(86, 324, 1108, 238, "这版新增了什么");
  ctx.fillStyle = "#4f3323";
  ctx.font = '24px "Songti SC", Georgia, serif';
  ctx.fillText("1. 商品、幡头、节庆天数和事件都改成了数据驱动。", 124, 398);
  ctx.fillText("2. 特殊来客会留下回礼和次日加成。", 124, 438);
  ctx.fillText("3. 每晚都能做一次布置决定，影响第二天的经营节奏。", 124, 478);
  ctx.fillText("4. 热闹度和连单会让好手感滚起来，玩法更像连续经营。", 124, 518);

  ctx.font = '20px "Songti SC", Georgia, serif';
  ctx.fillStyle = "rgba(79, 51, 35, 0.7)";
  wrapText(getMenuHintText(), 92, 622, 1040, 26);
  drawPrimaryCanvasButton("入市开张");
}

function drawPrepScreen() {
  const day = getCurrentDay();
  drawPanel(86, 166, 1108, 422, "今日起手");

  ctx.fillStyle = "#4e3022";
  ctx.font = '34px "STKaiti", "KaiTi", serif';
  ctx.fillText(day.title, 118, 230);
  ctx.font = '22px "Songti SC", Georgia, serif';
  ctx.fillStyle = "rgba(79, 51, 35, 0.82)";
  ctx.fillText(day.subtitle, 118, 266);

  ctx.fillStyle = "rgba(79, 51, 35, 0.72)";
  ctx.font = '19px "Songti SC", Georgia, serif';
  wrapText(
    `今日地气：${day.dayBlessing?.desc || "今日无额外地气"}${
      state.activeBoonLabels.length > 1 ? `  夜里带来的加成：${state.activeBoonLabels.slice(1).join("、")}` : ""
    }`,
    118,
    298,
    940,
    28,
  );

  state.activeCardRects = [];
  getFocusOptions().forEach((option, index) => {
    const x = 124 + index * 344;
    const y = 340;
    const selected = state.selectedFocus === index;
    state.activeCardRects.push({ type: "focus", index, x, y, w: 292, h: 152 });
    ctx.fillStyle = selected ? "rgba(244, 215, 168, 0.95)" : "rgba(255, 247, 230, 0.92)";
    roundRect(ctx, x, y, 292, 152, 22, true, false);
    ctx.strokeStyle = selected ? option.aura : "rgba(112, 74, 46, 0.15)";
    ctx.lineWidth = selected ? 4 : 2;
    roundRect(ctx, x, y, 292, 152, 22, false, true);

    ctx.fillStyle = option.aura;
    ctx.font = '32px "STKaiti", "KaiTi", serif';
    ctx.fillText(option.name, x + 22, y + 42);
    ctx.fillStyle = "#5d3b27";
    ctx.font = '18px "Songti SC", Georgia, serif';
    wrapText(option.desc, x + 22, y + 78, 248, 28);

    const inventory = buildInventory(option.effects);
    ctx.fillStyle = "rgba(78, 50, 32, 0.75)";
    ctx.fillText(
      `库存：香 ${inventory.incense} / 果 ${inventory.fruit} / 福 ${inventory.talisman}`,
      x + 22,
      y + 128,
    );
  });

  ctx.font = '20px "Songti SC", Georgia, serif';
  ctx.fillStyle = "rgba(79, 51, 35, 0.75)";
  wrapText(getPrepHintText(), 118, 530, 960, 28);
  drawPrimaryCanvasButton("敲锣开市");
}

function drawMarketScreen() {
  drawPanel(84, 166, 428, 346, "当前来客");
  drawPanel(528, 166, 668, 346, "摊口案台");

  state.activeCardRects = [];

  if (state.currentGuest) {
    const patienceRatio = Math.max(
      0,
      state.currentGuest.patience / state.currentGuest.patienceMax,
    );
    ctx.fillStyle = "#4d3022";
    ctx.font = '38px "STKaiti", "KaiTi", serif';
    ctx.fillText(state.currentGuest.name, 118, 236);
    ctx.font = '22px "Songti SC", Georgia, serif';
    ctx.fillStyle = "rgba(79, 51, 35, 0.85)";
    wrapText(state.currentGuest.wish, 118, 282, 340, 32);
    ctx.fillStyle = "rgba(79, 51, 35, 0.6)";
    wrapText(state.currentGuest.detail, 118, 344, 340, 28);

    const desired = getGoodById(state.currentGuest.desiredGood);
    drawSeal(370, 230, desired.short, desired.color);

    if (state.currentGuest.special) {
      drawSecondaryCanvasBadge(
        state.currentGuest.special.badge,
        118,
        382,
        116,
        38,
      );
      ctx.font = '17px "Songti SC", Georgia, serif';
      ctx.fillStyle = "rgba(79, 51, 35, 0.78)";
      wrapText(state.currentGuest.special.ruleText, 118, 446, 332, 24);
    }

    ctx.fillStyle = "rgba(94, 65, 44, 0.18)";
    roundRect(ctx, 118, 470, 310, 18, 10, true, false);
    ctx.fillStyle =
      patienceRatio > 0.5 ? "#6f9c58" : patienceRatio > 0.25 ? "#d39f4f" : "#b34432";
    roundRect(ctx, 118, 470, 310 * patienceRatio, 18, 10, true, false);
    ctx.fillStyle = "#5c3926";
    ctx.font = '18px "Songti SC", Georgia, serif';
    ctx.fillText("耐心", 118, 460);
  } else {
    ctx.fillStyle = "#5d3b27";
    ctx.font = '30px "STKaiti", "KaiTi", serif';
    ctx.fillText("下一位来客正在走来", 118, 264);
    ctx.font = '20px "Songti SC", Georgia, serif';
    ctx.fillStyle = "rgba(79, 51, 35, 0.78)";
    ctx.fillText("趁这会儿看看案台，准备好下一单。", 118, 304);
  }

  getGoods().forEach((good, index) => {
    const x = 560 + index * 212;
    const y = 246;
    const selected = state.selectedGood === index;
    state.activeCardRects.push({ type: "good", index, x, y, w: 180, h: 188 });
    ctx.fillStyle = selected ? "rgba(255, 243, 220, 0.96)" : "rgba(251, 247, 238, 0.9)";
    roundRect(ctx, x, y, 180, 188, 18, true, false);
    ctx.strokeStyle = selected ? good.color : "rgba(93, 55, 31, 0.16)";
    ctx.lineWidth = selected ? 4 : 2;
    roundRect(ctx, x, y, 180, 188, 18, false, true);

    drawSeal(x + 90, y + 54, good.short, good.color);
    ctx.fillStyle = "#4d3022";
    ctx.font = '30px "STKaiti", "KaiTi", serif';
    ctx.fillText(good.label, x + 26, y + 118);
    ctx.font = '18px "Songti SC", Georgia, serif';
    ctx.fillStyle = "rgba(79, 51, 35, 0.82)";
    ctx.fillText(good.bonusText, x + 26, y + 144);
    ctx.fillText(`库存 ${state.inventory[good.id]}`, x + 26, y + 168);
  });

  ctx.font = '19px "Songti SC", Georgia, serif';
  ctx.fillStyle = "rgba(79, 51, 35, 0.75)";
  ctx.fillText(`剩余来客：${state.guestQueue.length + (state.currentGuest ? 1 : 0)}`, 562, 468);
  ctx.fillText(`连单：${state.streak}`, 562, 500);
  ctx.fillText(`热闹加成：+${getBustleTierBonus()} 铜钱`, 562, 532);
  if (state.activeBoonLabels.length > 0) {
    wrapText(`今日加成：${state.activeBoonLabels.join("、")}`, 562, 566, 360, 24);
  }
  drawSecondaryCanvasBadge(getRestartHintText(), 948, 548, 216, 42);
}

function drawSummaryScreen() {
  state.activeCardRects = [];
  drawPanel(112, 176, 1056, 382, "收市札记");

  ctx.fillStyle = "#4d3022";
  ctx.font = '42px "STKaiti", "KaiTi", serif';
  ctx.fillText(state.dayResult.title, 148, 250);
  ctx.font = '28px "Songti SC", Georgia, serif';
  ctx.fillStyle = "rgba(79, 51, 35, 0.84)";
  ctx.fillText(state.dayResult.mood, 150, 292);

  const stats = [
    ["成交", state.dayResult.served],
    ["跑单", state.dayResult.missed],
    ["稀客", state.dayResult.specials],
    ["热闹", state.dayResult.bustle],
    ["铜钱", state.dayResult.coins],
  ];

  stats.forEach(([label, value], index) => {
    const x = 148 + index * 182;
    ctx.fillStyle = "rgba(255, 247, 230, 0.9)";
    roundRect(ctx, x, 332, 148, 118, 18, true, false);
    ctx.fillStyle = "#4e3022";
    ctx.font = '22px "Songti SC", Georgia, serif';
    ctx.fillText(label, x + 22, 372);
    ctx.font = '40px "Songti SC", Georgia, serif';
    ctx.fillText(String(value), x + 22, 420);
  });

  ctx.font = '18px "Songti SC", Georgia, serif';
  ctx.fillStyle = "rgba(79, 51, 35, 0.75)";
  const highlightText =
    state.dayResult.highlights.length > 0
      ? `今日留痕：${state.dayResult.highlights.join(" / ")}`
      : "今日留痕：还没有触发额外回礼。";
  wrapText(highlightText, 150, 492, 920, 26);

  if (state.dayIndex >= getDays().length - 1) {
    ctx.fillText("最后一夜已经收灯，点击按钮收下你的结局。", 150, 536);
    drawPrimaryCanvasButton("收灯看结局");
  } else {
    ctx.fillText("收市之后，你还能做一次夜里布置，决定明天的经营节奏。", 150, 536);
    drawPrimaryCanvasButton("入夜布置");
  }
}

function drawNightScreen() {
  const day = getCurrentDay();
  const options = getCurrentNightOptions();
  state.activeCardRects = [];

  drawPanel(92, 162, 1092, 404, day.nightTitle || "夜里布置");
  ctx.fillStyle = "#4d3022";
  ctx.font = '32px "STKaiti", "KaiTi", serif';
  ctx.fillText(day.nightTitle || "夜里布置", 126, 228);
  ctx.font = '20px "Songti SC", Georgia, serif';
  ctx.fillStyle = "rgba(79, 51, 35, 0.78)";
  wrapText(day.nightSubtitle || "收市之后，夜里还有一轮安排。", 126, 266, 900, 30);

  options.forEach((option, index) => {
    const x = 126 + index * 470;
    const y = 330;
    const selected = state.selectedNightOption === index;
    state.activeCardRects.push({ type: "night", index, x, y, w: 412, h: 170 });
    ctx.fillStyle = selected ? "rgba(244, 215, 168, 0.95)" : "rgba(255, 247, 230, 0.92)";
    roundRect(ctx, x, y, 412, 170, 22, true, false);
    ctx.strokeStyle = selected ? "#b6563c" : "rgba(112, 74, 46, 0.15)";
    ctx.lineWidth = selected ? 4 : 2;
    roundRect(ctx, x, y, 412, 170, 22, false, true);

    ctx.fillStyle = "#4d3022";
    ctx.font = '32px "STKaiti", "KaiTi", serif';
    ctx.fillText(option.title, x + 24, y + 42);
    ctx.font = '18px "Songti SC", Georgia, serif';
    ctx.fillStyle = "rgba(79, 51, 35, 0.8)";
    wrapText(option.desc, x + 24, y + 76, 368, 24);
    ctx.fillStyle = "#b14b35";
    ctx.fillText(option.costText, x + 24, y + 136);
    ctx.fillStyle = "rgba(79, 51, 35, 0.74)";
    wrapText(`明日加成：${option.boonLabel}`, x + 140, y + 136, 248, 24);

    if (!canAffordEffect(option.immediate)) {
      drawSecondaryCanvasBadge("暂时负担不起", x + 256, y + 20, 132, 34);
    }
  });

  ctx.font = '18px "Songti SC", Georgia, serif';
  ctx.fillStyle = "rgba(79, 51, 35, 0.76)";
  wrapText(getNightHintText(), 126, 534, 920, 26);
  drawPrimaryCanvasButton("收灯布置");
}

function drawEndingScreen() {
  state.activeCardRects = [];
  drawPanel(112, 168, 1054, 390, "庙会终章");
  ctx.fillStyle = "#4d3022";
  ctx.font = '56px "STKaiti", "KaiTi", serif';
  ctx.fillText(state.dayResult.ending, 150, 256);
  ctx.font = '28px "Songti SC", Georgia, serif';
  ctx.fillStyle = "rgba(79, 51, 35, 0.84)";
  wrapText(state.dayResult.text, 150, 320, 880, 40);

  ctx.font = '22px "Songti SC", Georgia, serif';
  ctx.fillStyle = "rgba(79, 51, 35, 0.75)";
  ctx.fillText(
    `结算：铜钱 ${state.coins} · 口碑 ${state.reputation} · 缘分 ${state.harmony} · 热闹 ${state.bustle}`,
    150,
    450,
  );
  ctx.fillText("按按钮即可再开一局，继续打磨你的小铺。", 150, 494);
  drawPrimaryCanvasButton("再开一局");
}

function drawMessageRibbon() {
  ctx.fillStyle = "rgba(70, 42, 28, 0.82)";
  roundRect(ctx, 88, 612, 1100, 38, 18, true, false);
  ctx.fillStyle = "#fff1db";
  ctx.font = '18px "Songti SC", Georgia, serif';
  ctx.fillText(state.message, 108, 638);
}

function drawPauseOverlay() {
  ctx.fillStyle = "rgba(25, 15, 12, 0.24)";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = "#fff1db";
  ctx.font = '42px "STKaiti", "KaiTi", serif';
  ctx.fillText("已暂停", 574, 344);
}

function drawPrimaryCanvasButton(label) {
  const x = 510;
  const y = 566;
  const w = 260;
  const h = 58;
  state.activeCardRects.push({ type: "primary", index: 0, x, y, w, h });
  const gradient = ctx.createLinearGradient(x, y, x, y + h);
  gradient.addColorStop(0, "#c65b41");
  gradient.addColorStop(1, "#973321");
  ctx.fillStyle = gradient;
  roundRect(ctx, x, y, w, h, 28, true, false);
  ctx.strokeStyle = "rgba(255, 231, 200, 0.28)";
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, w, h, 28, false, true);
  ctx.fillStyle = "#fff3e1";
  ctx.font = '26px "STKaiti", "KaiTi", serif';
  ctx.fillText(label, x + 78, y + 37);
}

function drawSecondaryCanvasBadge(label, x, y, w, h) {
  ctx.fillStyle = "rgba(255, 245, 223, 0.88)";
  roundRect(ctx, x, y, w, h, 18, true, false);
  ctx.strokeStyle = "rgba(112, 74, 46, 0.14)";
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, w, h, 18, false, true);
  ctx.fillStyle = "rgba(79, 51, 35, 0.76)";
  ctx.font = '18px "Songti SC", Georgia, serif';
  ctx.fillText(label, x + 16, y + 23);
}

function drawPanel(x, y, w, h, title) {
  ctx.fillStyle = "rgba(248, 239, 220, 0.93)";
  roundRect(ctx, x, y, w, h, 26, true, false);
  ctx.strokeStyle = "rgba(102, 67, 42, 0.18)";
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, w, h, 26, false, true);
  ctx.fillStyle = "#5d3b27";
  ctx.font = '28px "STKaiti", "KaiTi", serif';
  ctx.fillText(title, x + 26, y + 40);
}

function drawSeal(x, y, character, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff7eb";
  ctx.font = '30px "Songti SC", Georgia, serif';
  ctx.fillText(character, -15, 12);
  ctx.restore();
}

function wrapText(text, x, y, maxWidth, lineHeight) {
  const characters = [...text];
  let current = "";
  let row = 0;
  for (const character of characters) {
    const test = current + character;
    if (ctx.measureText(test).width > maxWidth) {
      ctx.fillText(current, x, y + row * lineHeight);
      current = character;
      row += 1;
    } else {
      current = test;
    }
  }
  if (current) {
    ctx.fillText(current, x, y + row * lineHeight);
  }
}

function roundRect(context, x, y, width, height, radius, fill, stroke) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
  if (fill) {
    context.fill();
  }
  if (stroke) {
    context.stroke();
  }
}

function gameLoop(timestamp) {
  if (!previousTs) {
    previousTs = timestamp;
  }
  const dt = Math.min(0.033, (timestamp - previousTs) / 1000);
  previousTs = timestamp;

  handleHoldInput();
  update(dt);
  draw();
  animationFrame = window.requestAnimationFrame(gameLoop);
}

function onKeyDown(event) {
  keys.add(event.code);

  if (["ArrowLeft", "ArrowRight", "Space"].includes(event.code)) {
    event.preventDefault();
  }

  if (event.code === "Space" || event.code === "Enter") {
    triggerPrimaryAction();
  }
  if (event.code === "KeyR") {
    resetGame();
  }
  if (event.code === "KeyP") {
    state.paused = !state.paused;
  }
  if (event.code === "KeyF") {
    toggleFullscreen();
  }
}

function onKeyUp(event) {
  keys.delete(event.code);
}

function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    canvas.requestFullscreen().catch(() => {});
  }
}

function handleCanvasClick(event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = WIDTH / rect.width;
  const scaleY = HEIGHT / rect.height;
  const x = (event.clientX - rect.left) * scaleX;
  const y = (event.clientY - rect.top) * scaleY;

  const hit = state.activeCardRects.find(
    (entry) =>
      x >= entry.x &&
      x <= entry.x + entry.w &&
      y >= entry.y &&
      y <= entry.y + entry.h,
  );

  if (!hit) {
    return;
  }

  if (hit.type === "focus" && state.mode === "prep") {
    state.selectedFocus = hit.index;
    state.inventory = buildInventory(getCurrentFocus().effects);
    setMessage(`已选 ${getCurrentFocus().name}。`, 2);
  }

  if (hit.type === "good" && state.mode === "market") {
    state.selectedGood = hit.index;
    serveSelectedGood();
  }

  if (hit.type === "night" && state.mode === "night") {
    state.selectedNightOption = hit.index;
    setMessage(getCurrentNightOptions()[hit.index].desc, 2.8);
  }

  if (hit.type === "primary") {
    triggerPrimaryAction();
  }
}

function buildTextState() {
  const isNight = state.mode === "night";
  return JSON.stringify({
    coordinate_system: "origin at top-left, x grows right, y grows down",
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      touch: isTouchLayout(),
      portrait: isPortraitLayout(),
      guidance_visible: !mobileGuidance.classList.contains("hidden"),
    },
    mode: state.mode,
    day: getCurrentDay()?.id ?? null,
    day_title: getCurrentDay()?.title ?? null,
    selected_focus: getCurrentFocus()?.name ?? null,
    selected_good: getSelectedGood()?.id ?? null,
    selected_night_option: isNight
      ? getCurrentNightOptions()[state.selectedNightOption]?.id ?? null
      : null,
    resources: {
      coins: state.coins,
      reputation: state.reputation,
      harmony: state.harmony,
      bustle: state.bustle,
      streak: state.streak,
    },
    current_guest: state.currentGuest
      ? {
          name: state.currentGuest.name,
          desired_good: state.currentGuest.desiredGood,
          patience: Number(state.currentGuest.patience.toFixed(2)),
          patience_max: state.currentGuest.patienceMax,
          special: state.currentGuest.special?.badge || null,
          wish: state.currentGuest.wish,
        }
      : null,
    queue_remaining: state.guestQueue.length,
    inventory: Object.fromEntries(
      getGoods().map((good) => [good.id, state.inventory[good.id] ?? null]),
    ),
    active_boons: state.activeBoonLabels,
    next_day_boons: state.nextDayBoonLabels,
    night_options: isNight
      ? getCurrentNightOptions().map((option) => ({
          id: option.id,
          title: option.title,
          affordable: canAffordEffect(option.immediate),
        }))
      : [],
    action_cards: state.activeCardRects.map((entry) => ({
      type: entry.type,
      index: entry.index,
      x: Math.round(entry.x),
      y: Math.round(entry.y),
      w: Math.round(entry.w),
      h: Math.round(entry.h),
    })),
    message: state.message,
    buttons: {
      start_visible: !startBtn.classList.contains("hidden"),
      action_visible: !actionBtn.classList.contains("hidden"),
      restart_visible: !restartBtn.classList.contains("hidden"),
    },
    ending: state.mode === "ending" ? state.dayResult : null,
  });
}

function advanceTime(ms) {
  const steps = Math.max(1, Math.round(ms / (1000 / 60)));
  for (let index = 0; index < steps; index += 1) {
    handleHoldInput();
    update(FIXED_STEP);
  }
  draw();
}

async function boot() {
  initializeDecor();
  updateResponsiveUI();
  syncButtons();
  draw();

  try {
    content = await loadFestivalContent();
    const systems = getSystems();
    state.coins = systems.startingResources.coins;
    state.reputation = systems.startingResources.reputation;
    state.harmony = systems.startingResources.harmony;
    state.bustle = systems.startingBustle;
    state.mode = "menu";
    setMessage("节庆账本已经展开。", 2);
  } catch (error) {
    state.mode = "error";
    state.errorText = String(error);
    setMessage("账本没有打开。", 3);
  }

  syncButtons();
  draw();
  animationFrame = window.requestAnimationFrame(gameLoop);
}

startBtn.addEventListener("click", resetGame);
actionBtn.addEventListener("click", triggerPrimaryAction);
restartBtn.addEventListener("click", resetGame);
canvas.addEventListener("click", handleCanvasClick);
window.addEventListener("resize", updateResponsiveUI);
window.addEventListener("keydown", onKeyDown);
window.addEventListener("keyup", onKeyUp);
window.addEventListener("blur", () => {
  keys.clear();
});

window.render_game_to_text = buildTextState;
window.advanceTime = advanceTime;
window.resetGame = resetGame;

boot();
