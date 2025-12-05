function assignSizeFromSprite(p){
  const pack = SPRITES[p.spriteColor];
  const img = (pack && pack.length) ? pack[p.spriteIndex % pack.length] : null;
  if(img && img._ok){
    const s = (p.spriteColor === 'yellow') ? SCALE_YELLOW : SCALE_GREEN;
    p.w = Math.max(1, Math.round(img.naturalWidth * s));
    p.h = Math.max(1, Math.round(img.naturalHeight * s));
  } else {
    p.w = 180; p.h = 20;
  }
}
function recomputeSizesWhenReady(){
  const all = [...SPRITES.green, ...SPRITES.yellow];
  if(all.every(i => i && i._ok)) { for(const p of platforms){ assignSizeFromSprite(p); } }
  else { setTimeout(recomputeSizesWhenReady, 30); }
}

function basePrand(x){
  const s = Math.sin((x + 0.123) * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}
function prand(i, seed){
  const off = (seed || 0) * 0.001;
  return basePrand(i + off);
}

function addGreen(list, x, y, spriteIndex){
  const g = {
    x: x,
    y: y,
    perm: true,
    spriteColor: 'green',
    spriteIndex: (spriteIndex || 0) % 3,
    anim: { phase: 'idle', t: 0, dur: 0, alpha: 1, scale: 1 }
  };
  assignSizeFromSprite(g);
  list.push(g);
  return g;
}

function addTilt(list, x, y, spriteIndex){
  const p = {
    x: x,
    y: y,
    perm: true,
    spriteColor: 'green',
    spriteIndex: (spriteIndex || 0) % 3,
    slippery: true,
    tilt: 0,
    targetTilt: 0,
    anim: { phase: 'idle', t: 0, dur: 0, alpha: 1, scale: 1 }
  };
  assignSizeFromSprite(p);
  list.push(p);
  return p;
}
function addYellow(list, x, y, spriteIndex, extraConfig){
  const idx = (spriteIndex || 0) % 3;
  const yel = {
    x: x,
    y: y,
    perm: false,
    spriteColor: 'yellow',
    spriteIndex: idx,
    state: 'on',
    t: 0,
    phase: 0,
    phaseOffset: 0,
    speed: 1 + (idx - 1) * 0.06,
    solidDelay: 0,
    grace: 0,
    waitExit: false,
    tLocal: 0,
    prevState: 'off',
    anim: { phase: 'idle', t: 0, dur: 0, alpha: 1, scale: 1 }
  };
  if (extraConfig){
    if (extraConfig.anim){
      yel.anim = Object.assign({}, yel.anim, extraConfig.anim);
      const { anim, ...rest } = extraConfig;
      Object.assign(yel, rest);
    } else {
      Object.assign(yel, extraConfig);
    }
  }
  assignSizeFromSprite(yel);
  list.push(yel);
  return yel;
}

function addFalling(list, x, y, spriteIndex){
  const f = {
    x: x,
    y: y,
    perm: true,
    spriteColor: 'green',
    spriteIndex: (spriteIndex || 0) % 3,
    falling: true,
    fallState: 'stable',
    fallTimer: 0,
    fallVY: 0,
    anim: { phase: 'idle', t: 0, dur: 0, alpha: 1, scale: 1 }
  };
  assignSizeFromSprite(f);
  list.push(f);
  return f;
}
function varyNormal(i, seed, normalBase){
  const d = Math.round((prand(i, seed) - 0.5) * 10);
  return Math.max(80, Math.min(normalBase + d, Math.floor(MAX_JUMP_PX) - 2));
}
function varyBridge(i, seed, bridgeBase){
  const d = Math.round((prand(100 + i, seed) - 0.5) * 24);
  const raw = bridgeBase + d;
  const hi = 2 * Math.floor(MAX_JUMP_PX) - 6;
  const lo = Math.floor(MAX_JUMP_PX) + 6;
  return Math.max(lo, Math.min(raw, hi));
}

function buildLevel1(){
  platforms = [];
  const left = 50, right = 230;
  const safeBottom = H - 280;
  const gapY = 130;
  addGreen(platforms, left, safeBottom, 0);
  addGreen(platforms, right, safeBottom - gapY, 1);
  addGreen(platforms, left, safeBottom - 2 * gapY, 2);
  addGreen(platforms, right, safeBottom - 3 * gapY, 0);
  cameraY = 0;
  cameraMaxY = 0;
}
function buildLevel2(){
  platforms = [];
  const left = 50, right = 230;
  const safeBottom = H - 220;
  const gapY = 120;
  addGreen(platforms, left, safeBottom, 0);
  addGreen(platforms, right, safeBottom - gapY, 1);
  addYellow(platforms, 140, safeBottom - 2 * gapY + 5, 2, {
    phaseOffset: 0.15,
    state: 'off',
    prevState: 'off',
    tLocal: 0,
    grace: 0,
    solidDelay: 20,
    waitExit: false,
    anim: { alpha: 0, scale: 1, phase: 'out', t: 0, dur: 0 }
  });
  addGreen(platforms, left, safeBottom - 3 * gapY, 2);
  addGreen(platforms, right, safeBottom - 4 * gapY, 0);
  cameraY = 0;
  cameraMaxY = 0;
}
const BUTTON_WORLD_Y = 12;

// --- УРОВЕНЬ 3 ---
function buildLevel3(){
  platforms = [];
  finish.y = BUTTON_WORLD_Y;

  const LEVEL3_SEED = 300;

  const topNoPlatsY = finish.y + MAX_JUMP_PX;
  const left = 40, right = 240;
  const STEPS = 8;

  const NORMAL_BASE = Math.min(120, Math.max(90, Math.floor(MAX_JUMP_PX) - 10));
  const BRIDGE_BASE = Math.min(2 * Math.floor(MAX_JUMP_PX) - 10, Math.floor(MAX_JUMP_PX) + 56);

  const requireMid = new Set([0, 2, 3, 5]);

  const G = new Array(STEPS);
  let y = topNoPlatsY;
  G[0] = addGreen(platforms, left, y, 0);
  for (let i = 1; i < STEPS; i++){
    const gap = requireMid.has(i - 1)
      ? varyBridge(i - 1, LEVEL3_SEED, BRIDGE_BASE)
      : varyNormal(i - 1, LEVEL3_SEED, NORMAL_BASE);
    y += gap;
    const x = (i % 2 === 0) ? left : right;
    G[i] = addGreen(platforms, x, y + 30, i % 3);
  }

  if (G[6]) G[6].y += 20;

  function jitter(i){
    return prand(i + 31, LEVEL3_SEED) * 2 - 1;
  }
  function rand01(i){
    return prand(i + 1000, LEVEL3_SEED);
  }

  for (let i = 0; i < STEPS; i++){
    const p = G[i];
    const baseAmp = (i % 2 === 0) ? 36 : 58;
    let dx = Math.round(jitter(31 + i) * baseAmp);
    const edgeBias = (i % 2 === 0) ? -1 : 1;
    const centerBias = (i % 2 === 0) ? 1 : -1;
    const chooseEdge = rand01(100 + i) < 0.45;
    const biasAmp = chooseEdge
      ? (12 + Math.round(rand01(200 + i) * 16))
      : (10 + Math.round(rand01(300 + i) * 14));
    dx += (chooseEdge ? edgeBias : centerBias) * biasAmp;
    const minX = 8;
    const maxX = BASE_W - (p.w || 180) - 8;
    p.x = Math.max(minX, Math.min(maxX, p.x + dx));
  }

  const lerp = (a, b, t) => Math.round(a * (1 - t) + b * t);
  const midY = (a, b) => Math.round((a + b) / 2) + 6;

  function midAuto(a, b, idx, phaseSeed){
    const t = 0.5 + (prand(a * 17 + b * 31 + phaseSeed, LEVEL3_SEED) - 0.5) * 0.18;
    addYellow(platforms, lerp(G[a].x, G[b].x, t), midY(G[a].y, G[b].y), idx, {
      phase: prand(999 + idx, LEVEL3_SEED) + phaseSeed * 0.01,
      phaseOffset: prand(999 + idx, LEVEL3_SEED) + phaseSeed * 0.01
    });
  }

  if (requireMid.has(0)) midAuto(0, 1, 2, 7);
  if (requireMid.has(2)) midAuto(2, 3, 1, 31);
  if (requireMid.has(3)) midAuto(3, 4, 0, 64);
  if (requireMid.has(5)) midAuto(5, 6, 1, 18);

  let minY = Math.min(finish.y, ...platforms.map(p => p.y));
  let maxY = Math.max(...platforms.map(p => p.y + (p.h || 0)));
  cameraMaxY = Math.max(0, Math.round((maxY - minY) - H));
  cameraY = Math.max(0, Math.min(cameraMaxY, G[STEPS - 1].y - (H - 120)));
}

// --- УРОВЕНЬ 4 (New) ---
function buildLevel4(){
  platforms = [];
  finish.y = BUTTON_WORLD_Y;

  const LEVEL4_SEED = 400;

  const topNoPlatsY = finish.y + MAX_JUMP_PX;
  const left = 40, right = 240;
  const STEPS = 14;
  const NORMAL_BASE = Math.min(120, Math.max(90, Math.floor(MAX_JUMP_PX) - 10));
  const BRIDGE_BASE = Math.min(2 * Math.floor(MAX_JUMP_PX) - 10, Math.floor(MAX_JUMP_PX) + 56);

  const requireMid = new Set([2, 5, 9, 11]);

  const G = new Array(STEPS);
  let y = topNoPlatsY;
  G[0] = addGreen(platforms, left, y, 0);

  for (let i = 1; i < STEPS; i++){
    const gap = requireMid.has(i - 1)
      ? varyBridge(i - 1, LEVEL4_SEED, BRIDGE_BASE)
      : varyNormal(i - 1, LEVEL4_SEED, NORMAL_BASE);
    y += gap;
    const x = (i % 2 === 0) ? left : right;
    G[i] = addGreen(platforms, x, y + 30, i % 3);
  }

  if (G[6]) G[6].y += 20;

  if (G[0] && G[1]) {
    G[1].y = G[0].y + 122;
  }
  if (G[1] && G[2]) {
    G[2].y = G[1].y + 115;
  }

  function jitter(i){
    return prand(i + 31, LEVEL4_SEED) * 2 - 1;
  }
  function rand01(i){
    return prand(i + 1000, LEVEL4_SEED);
  }

  for (let i = 0; i < STEPS; i++){
    const p = G[i];
    const baseAmp = (i % 2 === 0) ? 36 : 58;
    let dx = Math.round(jitter(31 + i) * baseAmp);
    const edgeBias = (i % 2 === 0) ? -1 : 1;
    const centerBias = (i % 2 === 0) ? 1 : -1;
    const chooseEdge = rand01(100 + i) < 0.45;
    const biasAmp = chooseEdge
      ? (12 + Math.round(rand01(200 + i) * 16))
      : (10 + Math.round(rand01(300 + i) * 14));
    dx += (chooseEdge ? edgeBias : centerBias) * biasAmp;
    const minX = 8;
    const maxX = BASE_W - (p.w || 180) - 8;
    p.x = Math.max(minX, Math.min(maxX, p.x + dx));
  }

  const lerp = (a, b, t) => Math.round(a * (1 - t) + b * t);
  const midY = (a, b) => Math.round((a + b) / 2) + 6;

  function midAuto(a, b, idx, phaseSeed){
    const t = 0.5 + (prand(a * 17 + b * 31 + phaseSeed, LEVEL4_SEED) - 0.5) * 0.18;
    const phaseVal = prand(999 + idx, LEVEL4_SEED) + phaseSeed * 0.01;
    addYellow(platforms, lerp(G[a].x, G[b].x, t), midY(G[a].y, G[b].y), idx, {
      phase: phaseVal,
      phaseOffset: phaseVal
    });
  }

  if (requireMid.has(2)) midAuto(2, 3, 0, 0.2);

  if (requireMid.has(5)) {
    const ya = G[5].y, yb = G[6].y;
    const xa = G[5].x, xb = G[6].x;
    const gapY = yb - ya;

    let y1 = ya + gapY * 0.35;
    const minDiff = MAX_JUMP_PX + 6;
    if (yb - y1 <= minDiff) {
      y1 = yb - minDiff;
    }
    y1 = Math.max(ya + 32, y1);

    const y2 = ya + gapY * 0.70;

    addYellow(platforms, lerp(xa, xb, 0.35), y1, 1, { phase: 0.0, phaseOffset: 0.0 });
    addYellow(platforms, lerp(xa, xb, 0.65), y2, 2, { phase: 0.5, phaseOffset: 0.5 });
  }

  if (requireMid.has(9)) midAuto(9, 10, 0, 0.75);
  if (requireMid.has(11)) midAuto(11, 12, 1, 0.15);

  let minY = Math.min(finish.y, ...platforms.map(p => p.y));
  let maxY = Math.max(...platforms.map(p => p.y + (p.h || 0)));
  cameraMaxY = Math.max(0, Math.round((maxY - minY) - H));
  cameraY = Math.max(0, Math.min(cameraMaxY, G[STEPS - 1].y - (H - 120)));

  cookie = null;
  const greens = platforms.filter(p => p.perm);
  if (greens.length > 0) {
    const mid = greens[Math.floor(greens.length / 2)];
    const w = mid.w || 180;
    cookie = {
      x: mid.x + w * 0.5,
      y: mid.y - 28,
      r: 14,
      taken: false
    };
  }
}



// --- LEVEL 5: SLIPPERY SLOPE ---
function buildLevel5(){
  platforms = [];
  finish.y = BUTTON_WORLD_Y;

  const LEVEL5_SEED = 500;

  const topNoPlatsY = finish.y + MAX_JUMP_PX;
  const left = 40, right = 240;
  const STEPS = 10; // основная "ось" из платформ

  const NORMAL_BASE = Math.min(120, Math.max(90, Math.floor(MAX_JUMP_PX) - 10));
  const BRIDGE_BASE = Math.min(2 * Math.floor(MAX_JUMP_PX) - 10, Math.floor(MAX_JUMP_PX) + 56);

  // Чуть более крупные "мосты", чтобы получить суммарную высоту ~1300px.
  const requireMid = new Set([2, 5, 7]);

  const G = new Array(STEPS);
  let y = topNoPlatsY;

  // Нижняя безопасная платформа
  G[0] = addGreen(platforms, left, y, 0);

  // Строим остальную ось зеленых платформ
  for (let i = 1; i < STEPS; i++){
    const gap = requireMid.has(i - 1)
      ? varyBridge(i - 1, LEVEL5_SEED, BRIDGE_BASE)
      : varyNormal(i - 1, LEVEL5_SEED, NORMAL_BASE);
    y += gap;
    const x = (i % 2 === 0) ? left : right;
    G[i] = addGreen(platforms, x, y + 30, i % 3);
  }

  // Немного выровняем первые шаги, чтобы низ был комфортным
  if (G[0] && G[1]) {
    G[1].y = G[0].y + 120;
  }
  if (G[1] && G[2]) {
    G[2].y = G[1].y + 118;
  }

  // Хелпер для перевода зеленой платформы в падающую
  function convertToFalling(index, addAltSafe){
    const base = G[index];
    if (!base) return null;
    const spriteIdx = (typeof base.spriteIndex === 'number') ? base.spriteIndex : (index % 3);
    // Создаем падающую платформу на том же месте
    const f = addFalling(platforms, base.x, base.y, spriteIdx);
    // Удаляем оригинальную зеленую из массива платформ
    const baseIdx = platforms.indexOf(base);
    if (baseIdx >= 0) {
      platforms.splice(baseIdx, 1);
    }
    G[index] = f;

    // При необходимости добавляем безопасную альтернативу рядом
    if (addAltSafe){
      const altX = (base.x === left) ? right : left;
      addGreen(platforms, altX, base.y + 4, (spriteIdx + 1) % 3);
    }
    return f;
  }

  // --- Низ: безопасная зона + первая падающая с явной альтернативой ---
  const bottomFallIndex = 2;
  const bottomFalling = convertToFalling(bottomFallIndex, false);

  // --- Середина: зигзаг, вторая падающая, желтые мосты-обходы и cookie над ней ---
  const midFallIndex = 5;
  const midFalling = convertToFalling(midFallIndex, false);

  // Желтые платформы как альтернативный путь вокруг второй падающей
  if (G[4] && G[6]){
    const a = G[4];
    const b = G[6];
    const ya = a.y;
    const yb = b.y;
    const xa = a.x;
    const xb = b.x;
    const gapY = yb - ya;

    // Первая желтая — ближе к нижней платформе
    addYellow(platforms,
      Math.round((xa * 2 + xb) / 3),
      ya + Math.round(gapY * 0.42),
      0,
      {
        phaseOffset: prand(410, LEVEL5_SEED),
        state: 'on',
        prevState: 'on'
      }
    );

    // Вторая желтая — ближе к верхней платформе
    addYellow(platforms,
      Math.round((xa + xb * 2) / 3),
      ya + Math.round(gapY * 0.72),
      1,
      {
        phaseOffset: prand(420, LEVEL5_SEED),
        state: 'on',
        prevState: 'on'
      }
    );
  }

  // Cookie над второй падающей (риск-награда)
  cookie = null;
  if (midFalling){
    const w = midFalling.w || 180;
    cookie = {
      x: midFalling.x + w * 0.5,
      y: midFalling.y - 32,
      r: 14,
      taken: false
    };
  }

  // --- Верх: третья падающая-ловушка + безопасный путь к финишу ---
  const topFallIndex = 8;
  const topFalling = convertToFalling(topFallIndex, false);

  // Финальная проверка: вертикальные гэпы не больше MAX_JUMP_PX
  (function enforceVerticalGaps(){
    const sorted = [...platforms].sort((a, b) => a.y - b.y);
    for (let i = 0; i < sorted.length - 1; i++){
      const p = sorted[i];
      const q = sorted[i + 1];
      let dy = q.y - p.y;
      if (dy > MAX_JUMP_PX){
        const needed = Math.ceil(dy / MAX_JUMP_PX) - 1;
        for (let k = 1; k <= needed; k++){
          const t = k / (needed + 1);
          const ny = Math.round(p.y + dy * t);
          const nx = Math.round((p.x + q.x) * 0.5);
          const np = addGreen(platforms, nx, ny, 0);
          sorted.splice(i + 1, 0, np);
          i++;
        }
      }
    }
  })();

  // Камера
  let minY = Math.min(finish.y, ...platforms.map(p => p.y));
  let maxY = Math.max(...platforms.map(p => p.y + (p.h || 0)));
  cameraMaxY = Math.max(0, Math.round((maxY - minY) - H));
  cameraY = Math.max(0, Math.min(
    cameraMaxY,
    G[STEPS - 1].y - (H - 120)
  ));
}
// --- LEVEL 6: ENDURANCE TRIAL ---
function buildLevel6(){
  platforms = [];
  finish.y = BUTTON_WORLD_Y;

  const LEVEL6_SEED = 600;

  const topNoPlatsY = finish.y + MAX_JUMP_PX;
  const left = 40, right = 240;
  const STEPS = 15; // длинная ось для испытания на выносливость

  const NORMAL_BASE = Math.min(120, Math.max(90, Math.floor(MAX_JUMP_PX) - 10));
  const BRIDGE_BASE = Math.min(2 * Math.floor(MAX_JUMP_PX) - 10, Math.floor(MAX_JUMP_PX) + 56);

  const requireMid = new Set([5, 9, 12]);

  const G = new Array(STEPS);
  let y = topNoPlatsY;

  // Нижняя стартовая платформа
  G[0] = addGreen(platforms, left, y, 0);

  // Строим основную ось платформ
  for (let i = 1; i < STEPS; i++){
    const gap = requireMid.has(i - 1)
      ? varyBridge(i - 1, LEVEL6_SEED, BRIDGE_BASE)
      : varyNormal(i - 1, LEVEL6_SEED, NORMAL_BASE);
    y += gap;
    const x = (i % 2 === 0) ? left : right;
    if (i === 4 || i === 7 || i === 8 || i === 12){
      G[i] = addYellow(platforms, x, y + 30, i % 3, { state: 'on', phase: 0, speed: 1.0, waitExit: false });
    } else {
      G[i] = addGreen(platforms, x, y + 30, i % 3);
    }
  }

  // Хелпер перевода зеленой платформы в падающую
  function convertToFalling(index, addAltSafe){
    const base = G[index];
    if (!base) return null;
    const spriteIdx = (typeof base.spriteIndex === 'number') ? base.spriteIndex : (index % 3);
    const f = addFalling(platforms, base.x, base.y, spriteIdx);
    const baseIdx = platforms.indexOf(base);
    if (baseIdx >= 0){
      platforms.splice(baseIdx, 1);
    }
    G[index] = f;

    if (addAltSafe){
      const altX = (base.x === left) ? right : left;
      addGreen(platforms, altX, base.y + 4, (spriteIdx + 1) % 3);
    }
    return f;
  }

  // --- Низ: коридор из падающих платформ 1–3 без страховки ---
  const lowFall1 = convertToFalling(1, false);
  const lowFall2 = convertToFalling(2, false);
  const lowFall3 = convertToFalling(3, false);

  // --- Середина: большие разрывы с желтыми мостами на индексах 5 и 9 ---
  if (G[5] && G[6]){
    const a = G[5];
    const b = G[6];
    const ya = a.y;
    const yb = b.y;
    const xa = a.x;
    const xb = b.x;
    const gapY = yb - ya;

    addYellow(
      platforms,
      Math.round((xa + xb) / 2),
      ya + Math.round(gapY * 0.55),
      0,
      {
        phaseOffset: prand(610, LEVEL6_SEED),
        state: 'on',
        prevState: 'on'
      }
    );
  }

  if (G[9] && G[10]){
    const a = G[9];
    const b = G[10];
    const ya = a.y;
    const yb = b.y;
    const xa = a.x;
    const xb = b.x;
    const gapY = yb - ya;

    addYellow(
      platforms,
      Math.round((xa + xb) / 2),
      ya + Math.round(gapY * 0.55),
      1,
      {
        phaseOffset: prand(620, LEVEL6_SEED),
        state: 'on',
        prevState: 'on'
      }
    );
  }

  // --- Верх: падающая ловушка на 13-й платформе ---
  const topTrapIndex = 13;
  const topTrap = convertToFalling(topTrapIndex, false);

  // Cookie над зелёной платформой G[6], следующей за парой жёлтых
  cookie = null;
  if (G[6]){
    const base = G[6];
    const w = base.w || 180;
    cookie = {
      x: base.x + w * 0.5,
      y: base.y - 32,
      r: 14,
      taken: false
    };
  }

  // Гарантия физической проходимости: ровно как в buildLevel5
  (function enforceVerticalGaps(){
    const sorted = [...platforms].sort((a, b) => a.y - b.y);
    for (let i = 0; i < sorted.length - 1; i++){
      const p = sorted[i];
      const q = sorted[i + 1];
      let dy = q.y - p.y;
      if (dy > MAX_JUMP_PX){
        const needed = Math.ceil(dy / MAX_JUMP_PX) - 1;
        for (let k = 1; k <= needed; k++){
          const t = k / (needed + 1);
          const ny = Math.round(p.y + dy * t);
          const nx = Math.round((p.x + q.x) * 0.5);
          const np = addGreen(platforms, nx, ny, 0);
          sorted.splice(i + 1, 0, np);
          i++;
        }
      }
    }
  })();

  // Камера
  let minY = Math.min(finish.y, ...platforms.map(p => p.y));
  let maxY = Math.max(...platforms.map(p => p.y + (p.h || 0)));
  cameraMaxY = Math.max(0, Math.round((maxY - minY) - H));
  cameraY = Math.max(0, Math.min(
    cameraMaxY,
    G[STEPS - 1].y - (H - 120)
  ));
}
// --- LEVEL 7: TILTED TRIAL ---
function buildLevel7(){
  platforms = [];
  finish.y = BUTTON_WORLD_Y;

  const LEVEL7_SEED = 700;

  const topNoPlatsY = finish.y + MAX_JUMP_PX;
  const left = 40, centerX = 140, right = 240;
  const STEPS = 15;

  const NORMAL_BASE = Math.min(120, Math.max(90, Math.floor(MAX_JUMP_PX) - 10));

  const G = new Array(STEPS);
  let y = topNoPlatsY;

  function pickX(i){
    const pattern = i % 3;
    if (pattern === 0) return left;
    if (pattern === 1) return right;
    return centerX;
  }

  // Верхняя платформа (индекс 0) — часть финишной прямой
  G[0] = addGreen(platforms, pickX(0), y, 0);

  for (let i = 1; i < STEPS; i++){
    const gap = varyNormal(i - 1, LEVEL7_SEED, NORMAL_BASE);
    y += gap;

    const x = pickX(i);
    let p;

    if (i === 4){
      // Падающая платформа — ловушка
      p = addFalling(platforms, x, y, i % 3);
    } else if (i === 6 || i === 9){
      // Жёлтые платформы — существующие ловушки
      p = addYellow(platforms, x, y, i % 3, {
        state: 'on',
        prevState: 'on'
      });
    } else if (i === 5 || i === 8 || i === 11){
      // Скользкие наклонные платформы
      p = addTilt(platforms, x, y, i % 3);
    } else {
      // Остальные — обычные зелёные
      p = addGreen(platforms, x, y, i % 3);
    }

    G[i] = p;
  }

  // Cookie на скользкой платформе G[8], смещённой к краю
  cookie = null;
  if (G[8]){
    const base = G[8];
    const w = base.w || 180;
    cookie = {
      x: base.x + w * 0.4,
      y: base.y - 30,
      r: 14,
      taken: false
    };
  }

  // Гарантия физической проходимости
  (function enforceVerticalGaps(){
    const sorted = [...platforms].sort((a, b) => a.y - b.y);
    for (let i = 0; i < sorted.length - 1; i++){
      const p = sorted[i];
      const q = sorted[i + 1];
      let dy = q.y - p.y;
      if (dy > MAX_JUMP_PX){
        const needed = Math.ceil(dy / MAX_JUMP_PX) - 1;
        for (let k = 1; k <= needed; k++){
          const t = k / (needed + 1);
          const ny = Math.round(p.y + dy * t);
          const nx = Math.round((p.x + q.x) * 0.5);
          const np = addGreen(platforms, nx, ny, 0);
          sorted.splice(i + 1, 0, np);
          i++;
        }
      }
    }
  })();

  // Камера
  let minY = Math.min(finish.y, ...platforms.map(p => p.y));
  let maxY = Math.max(...platforms.map(p => p.y + (p.h || 0)));
  cameraMaxY = Math.max(0, Math.round((maxY - minY) - H));
  cameraY = Math.max(0, Math.min(
    cameraMaxY,
    G[STEPS - 1].y - (H - 120)
  ));
}



function buildLevel8(){
  platforms = [];
  finish.y = BUTTON_WORLD_Y;

  addGreen(platforms, 200, 2600, 0);
  addTilt(platforms, 60, 2480, 1);
  addFalling(platforms, 238, 2365, 2);
  addGreen(platforms, 200, 2240, 0);
  addYellow(platforms, 200, 2140, 1, { phaseOffset: 0.60, state: 'on', prevState: 'on' });
  addTilt(platforms, 60, 2040, 2);
  addFalling(platforms, 280, 1920, 0);
  addGreen(platforms, 200, 1800, 1);
  addYellow(platforms, 270, 1700, 2, { phaseOffset: 1.20, state: 'on', prevState: 'on' });
  addTilt(platforms, 130, 1600, 0);
  addFalling(platforms, 200, 1480, 1);
  addGreen(platforms, 60, 1360, 2);
  addTilt(platforms, 280, 1240, 0);
  addFalling(platforms, 200, 1120, 1);
  addGreen(platforms, 60, 1000, 2);
  addYellow(platforms, 200, 900, 0, { phaseOffset: 2.25, state: 'on', prevState: 'on' });
  addTilt(platforms, 280, 800, 1);
  addFalling(platforms, 60, 680, 2);
  addTilt(platforms, 200, 560, 0);
  addYellow(platforms, 174, 436, 1, { phaseOffset: 2.85, state: 'on', prevState: 'on' });
  addGreen(platforms, 173, 306, 2);
  addGreen(platforms, 111, 189, 0);
  addFalling(platforms, 192, 99, 1);

  cookie = {
    x: 290,
    y: 1670,
    r: 14,
    taken: false
  };

  // Камера
  let minY = Math.min(finish.y, ...platforms.map(p => p.y));
  let maxY = Math.max(...platforms.map(p => p.y + (p.h || 0)));
  cameraMaxY = Math.max(0, Math.round((maxY - minY) - H));
  cameraY = cameraMaxY;
}

function shiftPlatformsBy(dy){ for(const p of platforms){ p.y = Math.round(p.y + dy); } }
function setLevel(n){
  currentLevel = n; timeSec = 0; timerElapsed = 0; gameState='play'; cookie = null;
  if(n === 1) buildLevel1(); 
  else if(n === 2) buildLevel2(); 
  else if(n === 3) buildLevel3(); 
  else if(n === 4) buildLevel4();
  else if(n === 5) buildLevel5();
  else if(n === 6) buildLevel6();
  else if(n === 7) buildLevel7();
  else if(n === 8) buildLevel8();

  if(n===1 || n===2){ 
    const shiftK = IS_TOUCH ? 0.12 : 0.05;
    shiftPlatformsBy(H * shiftK); 
  }
  recomputeSizesWhenReady(); spawnOnBottomPlatform();
}
