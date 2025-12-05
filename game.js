
// ==========================================
// 1. ГЛОБАЛЬНЫЕ НАСТРОЙКИ
// ==========================================
const BASE_W = 400, BASE_H = 700;
const BASE_PLAYER_W = 200, BASE_PLAYER_H = 243;
const VISUAL_SCALE = 0.75;
let DPR = Math.max(1, Math.round(window.devicePixelRatio || 1));

// Физика
const G=2200, JUMP_VY=-770, SPEED_X=220, MAX_FALL=1400, MAX_RISE=1000;
const MAX_JUMP_PX = Math.floor((JUMP_VY*JUMP_VY) / (2*G));
const MIN_OVERLAP=9, TOP_TOLERANCE=2.5;
const FRICTION_GROUND=0.82, FRICTION_AIR=0.985;
const COYOTE=0.08, BUFFER=0.10;

// Падающие платформы
const FALL_SHAKE_TIME = 0.5;
const FALL_SHAKE_AMP = 3;
const FALL_SHAKE_FREQ = 50;
const FALL_GRAVITY = 800;
const FALL_MAX_VY = 600;

// Управление
const MOBILE_SPEED_FACTOR = 0.85;
const AIR_CONTROL_FACTOR = 0.5;
const ACCEL_GROUND_PER_S = 8.0;
const ACCEL_AIR_PER_S = 4.0;
const HOLD_DELAY_MS = 130;
const TAP_MAX_MS = 140;
const NUDGE_DURATION = 0.16;
const NUDGE_SPEED_SCALE = 0.6;

// Анимации
const POP_IN_START = 0.86, POP_IN_OVERSHOOT = 1.04, ALPHA_SOLID_THRESHOLD = 0.95;
const T_PREVIEW=0.18, T_ON=1.20, T_WARN=0.30, T_OFF=0.30, REST_DELAY=0.35;
const CYCLE=T_PREVIEW+T_ON+T_WARN+T_OFF, CYCLE_EXT=CYCLE+REST_DELAY;
const APPEAR_SOLID_DELAY=0.05, VANISH_COYOTE=0.10;
const SCALE_GREEN = 0.18, SCALE_YELLOW = 0.205;

// ==========================================
// 2. БАЗОВЫЕ ФУНКЦИИ (HELPERS)
// ==========================================
function applyFriction(vx, onGround, dt){ 
  const k = Math.pow(onGround ? FRICTION_GROUND : FRICTION_AIR, dt*60); 
  return Math.abs(vx) < 1 ? 0 : vx * k; 
}

function easeOutBack(t){ const c1=1.70158, c3=c1+1; return 1 + c3*Math.pow(t-1,3) + c1*Math.pow(t-1,2); }
function easeInQuad(t){ return t*t; }

function roundRectPath(x,y,w,h,r){
  const rr = Math.min(r, w/2, h/2);
  ctx.beginPath(); ctx.moveTo(x+rr, y); ctx.arcTo(x+w, y, x+w, y+h, rr); ctx.arcTo(x+w, y+h, x, y+h, rr); ctx.arcTo(x, y+h, x, y, rr); ctx.arcTo(x, y, x+w, y, rr); ctx.closePath();
}

function drawOutlinedText(ctx,text,x,y,opt){
  opt = opt || {};
  ctx.save(); 
  ctx.font = opt.font || 'bold 14px system-ui';
  ctx.textAlign = opt.align || 'center';
  ctx.textBaseline = opt.baseline || 'middle';
  ctx.lineWidth = opt.width || 3; 
  ctx.strokeStyle = opt.stroke || 'rgba(0,0,0,0.95)'; 
  ctx.lineJoin='round'; ctx.miterLimit=2; 
  ctx.strokeText(text,x,y);
  ctx.fillStyle = opt.fill || '#fff'; 
  ctx.fillText(text,x,y); 
  ctx.restore();
}

function getTimerTotal(level){ 
  if(level===1) return 12.0;
  if(level===2) return 10.0;
  if(level===3) return 8.5;
  if(level===4) return 12.0; // ~12 sec on level 4
  if(level===5) return 13.0;
  if(level===6) return 18.5;
  if(level===7) return 19.0;
  if(level===8) return 22.0;
  return 8.5; 
}

// ==========================================
// 3. ИНИЦИАЛИЗАЦИЯ
// ==========================================
const c = document.getElementById('cv');
const bgC = document.getElementById('bg');
let ctx = c.getContext('2d', { alpha: true });
let bgCtx = bgC ? bgC.getContext('2d') : null;
ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';

let W = BASE_W, H = BASE_H;
let matrixFontSize = 16;
let matrixColumns = 0;
let matrixDrops = [];
const MATRIX_CHARS = '0123456789ABCDEF';
let matrixTimer = 0;
let gameState = 'menu'; // Start in MENU state
let timeSec=0, lastGroundTime=-1, lastJumpPress=-1;
let timerElapsed=0;
let TIMER_TOTAL = 12.0;

const hoppy = { img: new Image(), ready: false, naturalW: 0, naturalH: 0 };
const player = { x: 0, y: 20, w: BASE_PLAYER_W, h: BASE_PLAYER_H, vx:0, vy: 20, dir:1, on:false, jumpHeld:false, ground:null };
const keys = { left:false, right:false, up:false };
let overrideMove = { active:false, side:0, until:0 };

let cameraY = 0, cameraMaxY = 0;
let platforms = [];
let currentLevel = 1;
const LAST_LEVEL = 8;
let cookie = null;

// Assets
hoppy.img.src = "assets/hoppy.png";
const SPRITES = { green: [], yellow: [] };
const finish = { x:60, y: 20, w:280, h:44 };
let cancelImg = new Image();
let cancelImgOK = false;
cancelImg.onload = ()=>{ cancelImgOK = true; };
cancelImg.src = "assets/cancel.png";

const OVERLAY = {
  win:  { img: new Image(), ready: false },
  lose: { img: new Image(), ready: false }
};
OVERLAY.win.img.src  = "assets/continue.png";
OVERLAY.lose.img.src = "assets/gameover.png";
let uiButtons=[];
let overlayClock = 0;

(function loadPacks(){
  ["assets/green_1.png","assets/green_2.png","assets/green_3.png"].forEach(fn=>{
    const i = new Image(); i.onload=()=>i._ok=true; i.onerror=()=>i._ok=false; i.src=fn; SPRITES.green.push(i);
  });
  ["assets/yellow_1.png","assets/yellow_2.png","assets/yellow_3.png"].forEach(fn=>{
    const i=new Image(); i.onload=()=>i._ok=true; i.onerror=()=>i._ok=false; i.src=fn; SPRITES.yellow.push(i);
  });
})();

// ==========================================
// 4. УПРАВЛЕНИЕ
// ==========================================
const IS_TOUCH = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

(function(){
  const DEADZONE = 16;
  const DEADZONE_DEACTIVATE = DEADZONE * 0.55;
  const PATH_MIN = 40;
  const UP_MIN = 32;
  const VERT_DOM_RATIO = 1.05;
  const DIAG_X_MIN = 28;
  const DIAG_RATIO = 0.65;
  const JUMP_SWipe_MIN = 40;
  const JUMP_SWipe_MAX = 160;
  const JUMP_SCALE_MIN = 1.0;
  const JUMP_SCALE_MAX = 1.18;
  const RECENTER_DIST = 120;

  let activeId = null;
  let originX = 0, originY = 0;
  let lastX = 0, lastY = 0;
  let startTS = 0;
  let didJump = false;
  let moveActive = false;
  let holdTimer = null;

  function canvasPos(t){
    const r = c.getBoundingClientRect();
    return { x: (t.clientX - r.left), y: (t.clientY - r.top), w: r.width, h: r.height };
  }
  function engageMoveBy(dx, w){
    const side = (dx < 0) ? -1 : +1;
    if(side < 0){ keys.left = true; keys.right = false; player.dir = -1; }
    else { keys.right = true; keys.left = false; player.dir = +1; }
    moveActive = true;
  }
  function stopMove(){ keys.left = false; keys.right = false; moveActive = false; }
  function jumpWithStrength(absSwipeY, dx, w){
    let t = (absSwipeY - JUMP_SWipe_MIN) / Math.max(1, (JUMP_SWipe_MAX - JUMP_SWipe_MIN));
    t = Math.max(0, Math.min(1, t));
    const scale = JUMP_SCALE_MIN + (JUMP_SCALE_MAX - JUMP_SCALE_MIN) * t;
    lastJumpPress = timeSec; player.jumpHeld = true; keys.up = true;
    const absX = Math.abs(dx);
    if(absX >= DIAG_X_MIN && (absX / Math.max(1, absSwipeY)) >= DIAG_RATIO){
      engageMoveBy(dx, w);
    }
    didJump = true;
    player._pendingJumpScale = scale;
  }
  window._applyPendingJumpScale = function(){
    if(typeof player._pendingJumpScale === 'number' && player.vy < 0){
      player.vy *= player._pendingJumpScale;
      delete player._pendingJumpScale;
    }
  };

  c.addEventListener('touchstart', (e)=>{
    if(activeId !== null) return;
    const t = e.changedTouches[0]; const p = canvasPos(t);
    activeId = t.identifier; originX = lastX = p.x; originY = lastY = p.y;
    startTS = performance.now(); didJump = false; moveActive = false;
    if(holdTimer){ clearTimeout(holdTimer); holdTimer = null; }
    
    // Menu Interaction
    if(gameState === 'menu'){
        // Handled by global click/touch handler
        return;
    }
    
    if(gameState === 'play'){
      holdTimer = setTimeout(()=>{
        if(activeId !== null && !didJump && !moveActive){
          const dx = lastX - originX;
          if(Math.hypot(dx, 0) > DEADZONE){ engageMoveBy(dx, p.w); }
        }
      }, HOLD_DELAY_MS);
      e.preventDefault();
    }
  }, { passive:false });

  c.addEventListener('touchmove', (e)=>{
    if(activeId === null) return;
    let t = null; for(const tt of e.changedTouches){ if(tt.identifier === activeId){ t = tt; break; } }
    if(!t) return;
    const p = canvasPos(t);
    const dx = p.x - originX, dy = p.y - originY;
    lastX = p.x; lastY = p.y;
    if(gameState === 'play'){
      const absX = Math.abs(dx), absY = Math.abs(dy);
      const pathLen = Math.hypot(dx, dy);
      if(pathLen > RECENTER_DIST && !moveActive && !keys.left && !keys.right && !didJump){
        originX = p.x; originY = p.y;
      }
      if(didJump){
        if(absX > DEADZONE * 1.1){ engageMoveBy(dx, p.w); }
        e.preventDefault(); return;
      }
      const pureUp = (pathLen > PATH_MIN) && (-dy > UP_MIN) && (absY > absX * VERT_DOM_RATIO);
      const diagUp = (-dy > UP_MIN) && (absX >= DIAG_X_MIN) && ((absX/Math.max(1,absY)) >= DIAG_RATIO);
      if(pureUp || diagUp){
        if(holdTimer){ clearTimeout(holdTimer); holdTimer = null; }
        jumpWithStrength(absY, dx, p.w);
        e.preventDefault(); return;
      }
      if(absX > DEADZONE && absX >= absY * 0.8){
        if(holdTimer){ clearTimeout(holdTimer); holdTimer = null; }
        engageMoveBy(dx, p.w);
      } else if(absX <= DEADZONE_DEACTIVATE && !didJump && moveActive){
        stopMove();
      }
      e.preventDefault();
    }
  }, { passive:false });

  function endTouch(){
    if(holdTimer){ clearTimeout(holdTimer); holdTimer = null; }
    stopMove();
    if(keys.up){ keys.up = false; player.jumpHeld = false; if(player.vy < 0) player.vy *= 0.55; }
    activeId = null;
  }
  c.addEventListener('touchend', (e)=>{
    let has = false; for(const tt of e.changedTouches){ if(tt.identifier === activeId){ has = true; break; } }
    if(!has) return; if(gameState === 'play'){ e.preventDefault(); } endTouch();
  }, { passive:false });
  c.addEventListener('touchcancel', (e)=>{
    let has = false; for(const tt of e.changedTouches){ if(tt.identifier === activeId){ has = true; break; } }
    if(!has) return; if(gameState === 'play'){ e.preventDefault(); } endTouch();
  }, { passive:false });
})();

// ==========================================
// 5. ЛОГИКА УРОВНЕЙ
// ==========================================
function resizeCanvas(){
  DPR = Math.max(1, Math.round(window.devicePixelRatio || 1));
  const vw = Math.max(320, window.innerWidth);
  const vh = Math.max(480, window.innerHeight);
  const aspect = BASE_W / BASE_H;
  let cssW, cssH;
  if (IS_TOUCH && vh >= vw) {
    const deviceAspect = vw / vh;
    if (deviceAspect >= 0.52) { cssH = Math.min(vh, 900); cssW = Math.round(cssH * aspect); }
    else { cssW = vw - 24; cssH = Math.round(cssW / aspect); }
  } else {
    cssH = Math.min(vh - 24, 900); cssW = Math.round(cssH * aspect);
    if (cssW > vw - 24) { cssW = vw - 24; cssH = Math.round(cssW / aspect); }
  }
  const gameContainer = document.getElementById('game-container');
  if (gameContainer) {
    gameContainer.style.width = cssW + 'px';
    gameContainer.style.height = cssH + 'px';
  }
  c.style.width = cssW + 'px'; c.style.height = cssH + 'px';
  c.width = Math.round(cssW * DPR); c.height = Math.round(cssH * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  if (bgC && bgCtx){
    bgC.style.width = cssW + 'px'; bgC.style.height = cssH + 'px';
    bgC.width = Math.round(cssW * DPR); bgC.height = Math.round(cssH * DPR);
    bgCtx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  W = cssW; H = cssH;
  recalcPlayerSize();
  initMatrixBackground();
}
addEventListener('resize', resizeCanvas, { passive:true });

function recalcPlayerSize(){
  if(!hoppy || !hoppy.ready){ return; }
  const s = H / BASE_H;
  const effectiveDPR = IS_TOUCH ? Math.min(DPR, 2) : DPR;
  const maxCssH = Math.floor(hoppy.naturalH / effectiveDPR);
  const maxCssW = Math.floor(hoppy.naturalW / effectiveDPR);
  player.h = Math.max(1, Math.floor(Math.min(Math.round(BASE_PLAYER_H * s), maxCssH) * VISUAL_SCALE));
  player.w = Math.max(1, Math.floor(Math.min(Math.round(BASE_PLAYER_W * s), maxCssW) * VISUAL_SCALE));
  player.x = Math.max(0, Math.min(BASE_W - player.w, player.x||0));
  player.y = Math.max(-99999, Math.min(99999, player.y||0));
  updateHitboxOffsets();
}

let HITBOX_OFFSET_X = 34, HITBOX_OFFSET_Y = 0;
let RENDER_FEET_OVERLAP = 18;
function updateHitboxOffsets(){
  const kx = player.w / BASE_PLAYER_W; const ky = player.h / BASE_PLAYER_H;
  HITBOX_OFFSET_X = Math.round(34 * kx); HITBOX_OFFSET_Y = Math.round(0 * ky);
  RENDER_FEET_OVERLAP = Math.round(18 * ky);
}
function getHitbox(){ return { x:player.x+HITBOX_OFFSET_X, y:player.y+HITBOX_OFFSET_Y, w:player.w-HITBOX_OFFSET_X*2, h:player.h-HITBOX_OFFSET_Y }; }

function timerProgress(){ return Math.max(0, Math.min(1, timerElapsed/TIMER_TOTAL)); }

// ==========================================
// 6. АНИМАЦИИ (UPDATE)
// ==========================================
function setAnim(p,phase,dur){ if(!p.anim) p.anim={}; p.anim.phase=phase; p.anim.t=0; p.anim.dur=dur; if(phase==='out'){ p.anim.alpha = 0; } }
function updateAnim(p,dt){
  if(!p.anim) return; p.anim.t += dt;
  if(p.anim.phase==='in'){
    const t=Math.min(1,p.anim.t/Math.max(0.0001,p.anim.dur)); const e=easeOutBack(t); p.anim.alpha=t;
    const s=POP_IN_START + (POP_IN_OVERSHOOT-POP_IN_START)*e; p.anim.scale = (t<0.9)?s:(1 + (s-1)*(1 - (t-0.9)/0.1));
    if(t>=1){ p.anim.phase='idle'; p.anim.alpha=1; p.anim.scale=1; }
  } else if(p.anim.phase==='pulse'){
    const amp=0.02; p.anim.scale=1 + Math.sin(timeSec*10)*amp; p.anim.alpha=1;
  } else if(p.anim.phase==='out'){
    const t=Math.min(1,p.anim.t/Math.max(0.0001,p.anim.dur)); p.anim.scale = 1 - 0.5 * easeInQuad(t); p.anim.alpha = (t < 0.98) ? 1 : 0;
  } else { p.anim.alpha=1; p.anim.scale=1; }
}
function platformPhaseNow(p){ const base=(timeSec+(p.phaseOffset||0)*CYCLE_EXT); return (base)%CYCLE_EXT; }
function updateBridgeState(p,dt,playerHB){
  if(p.perm) return; p.tLocal=platformPhaseNow(p); const t=p.tLocal;
  const newState=(t<T_PREVIEW)?'preview':(t<T_PREVIEW+T_ON)?'on':(t<T_PREVIEW+T_ON+T_WARN)?'warn':(t<CYCLE)?'off':'rest';
  if(newState!==p.state){
    p.prevState=p.state; p.state=newState;
    if(p.state==='preview'){ p.solidDelay=APPEAR_SOLID_DELAY; p.waitExit=false; setAnim(p,'in',T_PREVIEW); p.anim.alpha=0; p.anim.scale=POP_IN_START; }
    if(p.state==='on'){ p.solidDelay=Math.max(0,p.solidDelay); p.anim.phase='idle'; p.anim.alpha=1; p.anim.scale=1; }
    if(p.state==='warn'){ p.anim.phase='pulse'; }
    if(p.state==='off'){ p.grace=VANISH_COYOTE; p.solidDelay=0; p.waitExit=false; setAnim(p,'out',T_OFF); }
    if(p.state==='rest'){ p.anim.phase='out'; p.anim.alpha=0; p.anim.scale=1; }
  }
  if(p.solidDelay>0)p.solidDelay=Math.max(0,p.solidDelay-dt);
  if(p.grace>0)p.grace=Math.max(0,p.grace-dt);
  if(p.state==='preview' && p.anim && p.anim.alpha < ALPHA_SOLID_THRESHOLD){ p.solidDelay = Math.max(p.solidDelay, 0.016); }
  if((p.state==='on'||p.state==='warn')&&p.waitExit){
    if(playerHB){
      const ow=Math.min(playerHB.x+playerHB.w,p.x+p.w)-Math.max(playerHB.x,p.x);
      const oh=Math.min(playerHB.y+playerHB.h,p.y+p.h)-Math.max(playerHB.y,p.y);
      if(ow>0&&oh>0) p.solidDelay=Math.max(p.solidDelay,0.016); else {p.waitExit=false; p.solidDelay=0;}
    }else{p.waitExit=false; p.solidDelay=0;}
  }
  updateAnim(p, dt);
}

function updateFallingPlatform(p, dt){
  if(!p.falling) return;
  if(!p.fallState) p.fallState = 'stable';
  if(typeof p.fallTimer !== 'number') p.fallTimer = 0;
  if(typeof p.fallVY !== 'number') p.fallVY = 0;

  if(p.fallState === 'shaking'){
    p.fallTimer += dt;
    if(p.fallTimer >= FALL_SHAKE_TIME){
      p.fallState = 'falling';
    }
  } else if(p.fallState === 'falling'){
    p.fallVY = Math.min(FALL_MAX_VY, p.fallVY + FALL_GRAVITY * dt);
    p.y += p.fallVY * dt;
    const screenY = p.y - (currentLevel >= 3 ? cameraY : 0);
    if(screenY > H + 100){
      p.fallState = 'gone';
    }
  }
}

function bridgeIsSolidForLanding(p){
  if(p.falling && p.fallState === 'gone') return false;
  if(p.perm) return true;
  if((p.state==='on'||p.state==='warn')&&p.solidDelay===0) return true;
  if(p.state==='preview' && p.solidDelay===0 && p.anim && p.anim.alpha>=ALPHA_SOLID_THRESHOLD) return true;
  if(p.grace>0) return true;
  return false;
}

// ==========================================
// 7. ОТРИСОВКА (RENDER)
// ==========================================
function initMatrixBackground(){
  if (!bgC || !bgCtx) return;
  matrixFontSize = Math.max(12, Math.round(16 * (H / BASE_H)));
  matrixColumns = Math.max(1, Math.floor(W / matrixFontSize));
  matrixDrops = [];
  const maxRows = Math.ceil(H / matrixFontSize);
  for (let i = 0; i < matrixColumns; i++){
    matrixDrops[i] = Math.floor(Math.random() * maxRows);
  }
  bgCtx.setTransform(DPR, 0, 0, DPR, 0, 0);
  bgCtx.clearRect(0, 0, W, H);
  bgCtx.fillStyle = '#0d1117';
  bgCtx.fillRect(0, 0, W, H);
}

function drawMatrix(dt){
  if (!bgC || !bgCtx || matrixColumns <= 0) return;
  bgCtx.save();
  bgCtx.setTransform(DPR, 0, 0, DPR, 0, 0);
  // Более плотная заливка для сокращения шлейфа
  bgCtx.fillStyle = 'rgba(13, 17, 23, 0.25)';
  bgCtx.fillRect(0, 0, W, H);

  // Тусклые цвета матрицы по уровням
  const lvl = currentLevel || 1;
  let col = 'rgba(0, 255, 0, 0.15)';
  if (lvl >= 1 && lvl <= 2) col = 'rgba(0, 255, 0, 0.15)';
  else if (lvl >= 3 && lvl <= 4) col = 'rgba(0, 255, 255, 0.15)';
  else if (lvl >= 5 && lvl <= 6) col = 'rgba(255, 140, 0, 0.15)';
  else if (lvl === 7) col = 'rgba(224, 255, 255, 0.15)';
  else if (lvl >= 8) col = 'rgba(255, 0, 0, 0.15)';

  bgCtx.fillStyle = col;
  bgCtx.font = matrixFontSize + 'px monospace';
  bgCtx.textBaseline = 'top';

  // Таймер для замедления падения символов
  matrixTimer += dt;
  const stepInterval = 0.075;
  const doStep = matrixTimer >= stepInterval;
  if (doStep) {
    // сбрасываем без накопления, так как dt ограничен сверху
    matrixTimer = 0;
  }

  for (let i = 0; i < matrixColumns; i++){
    const x = i * matrixFontSize;
    const y = matrixDrops[i] * matrixFontSize;
    const ch = MATRIX_CHARS.charAt(Math.floor(Math.random() * MATRIX_CHARS.length));
    bgCtx.fillText(ch, x, y);

    if (doStep) {
      if (y > H && Math.random() < 0.975){
        matrixDrops[i] = 0;
      } else {
        matrixDrops[i] += 1;
      }
    }
  }
  bgCtx.restore();
}
function drawButton(){
  if (!cancelImgOK) return;
  const targetW = Math.round(BASE_W * 0.6825); 
  const ar = cancelImg.height / cancelImg.width;
  const targetH = Math.round(targetW * ar);
  finish.w = targetW; finish.h = targetH; 
  finish.x = Math.round((W - finish.w) / 2);
  ctx.save(); if(currentLevel >= 3){ ctx.translate(0, -cameraY); }
  ctx.drawImage(cancelImg, finish.x, finish.y, finish.w, finish.h);
  ctx.restore();
}

function drawTimer(){
  const p = timerProgress();
  const pad = 8, barH = 24, radius = 12;
  
  const maxBarW = BASE_W - 40;
  const screenBarW = W * 0.85;
  const barW = Math.round(Math.min(maxBarW, screenBarW));
  
  const x = Math.round((W - barW) / 2);
  const y = H - pad - barH;
  
  ctx.save(); roundRectPath(x, y, barW, barH, radius); ctx.fillStyle = '#e6e8eb'; ctx.globalAlpha = 0.85; ctx.fill(); ctx.globalAlpha = 1;
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.stroke(); ctx.restore();
  const fillW = Math.max(0, Math.floor(barW * p));
  if (fillW > 0){
    let col = '#2ecc71'; if (p >= 0.7 && p < 0.9) col = '#f1c40f'; if (p >= 0.9) col = '#c0392b';
    if (p >= 0.9){ const blink = (Math.sin(timeSec * 10) * 0.5 + 0.5); ctx.globalAlpha = 0.75 + 0.25 * blink; }
    const rr = Math.min(radius, fillW/2, barH/2);
    ctx.save(); roundRectPath(x, y, fillW, barH, rr); ctx.fillStyle = col; ctx.fill(); ctx.globalAlpha = 1; ctx.restore();
    ctx.save(); roundRectPath(x, y, fillW, barH, rr); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(0,0,0,0.20)'; ctx.stroke(); ctx.restore();
  }
  drawOutlinedText(ctx, 'Очистка системы: ' + Math.floor(p*100) + '%', x + barW/2, y + barH/2, {
    font: 'bold 14px system-ui', baseline: 'middle', align: 'center', fill: '#fff', stroke: 'rgba(0,0,0,0.95)', width: 3
  });
  if (p >= 0.9) {
    const blink = (Math.sin(timeSec * 10) * 0.5 + 0.5);
    const redAlpha = 0.10 + 0.20 * blink;
    ctx.save(); ctx.fillStyle = `rgba(255,0,0,${redAlpha.toFixed(2)})`;
    ctx.fillRect(0, 0, W, H); ctx.restore();
  }
}

function drawPlatformSprite(p, offsetX){
  const pack = SPRITES[p.spriteColor];
  const img = (pack && pack.length>0) ? pack[p.spriteIndex % pack.length] : null;
  const worldX = Math.round(offsetX + p.x);
  const worldY = Math.round(p.y - (currentLevel >= 3 ? cameraY : 0));
  const w = Math.round(p.w||180), h = Math.round(p.h||20);
  const isSlippery = !!p.slippery;
  const tilt = (isSlippery && typeof p.tilt === 'number') ? p.tilt : 0;
  const isFallingPlat = !!p.falling;
  if(isFallingPlat && p.fallState === 'gone') return;
  let drawX = worldX;
  let drawY = worldY;
  if(isFallingPlat && p.fallState === 'shaking'){
    const shake = Math.sin(timeSec * FALL_SHAKE_FREQ) * FALL_SHAKE_AMP;
    drawX += shake;
  }
  if(p.perm){
    ctx.save();
    if(isSlippery && Math.abs(tilt) > 0.001){
      const cx = drawX + w/2, cy = drawY + h/2;
      ctx.translate(cx, cy);
      ctx.rotate(tilt);
      if(img && img._ok){ ctx.drawImage(img, -w/2, -h/2, w, h); }
      else { ctx.fillStyle='#2e7d32'; ctx.fillRect(-w/2, -h/2, w, h); }
    } else {
      if(img && img._ok){ ctx.drawImage(img, drawX, drawY, w, h); }
      else { ctx.fillStyle='#2e7d32'; ctx.fillRect(drawX, drawY, w, h); }
    }
    ctx.restore(); return;
  }
  const alpha = p.anim ? p.anim.alpha : 1; const scale = p.anim ? p.anim.scale : 1;
  if(p.state==='off' && alpha<=0.01) return;
  ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  const cx = worldX + w/2, cy = worldY + h/2;
  ctx.translate(cx, cy); ctx.scale(scale, scale);
  if(img && img._ok){ ctx.drawImage(img, -w/2, -h/2, w, h); }
  else { ctx.fillStyle='#f1c40f'; ctx.fillRect(-w/2, -h/2, w, h); }
  ctx.restore();
}

function drawCookie(offsetX){
  if (!cookie || cookie.taken) return;
  const worldX = Math.round(offsetX + cookie.x);
  const worldY = Math.round(cookie.y - (currentLevel >= 3 ? cameraY : 0));
  const r = cookie.r || 14;
  ctx.save();
  ctx.fillStyle = '#ffd27f';
  ctx.beginPath();
  ctx.arc(worldX, worldY, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.stroke();
  ctx.restore();
}

function drawPlatforms(offsetX){
  for(const p of platforms){
    if(!p.perm && (p.state==='rest' || (p.state==='off' && (!p.anim || p.anim.alpha<=0.01)))) continue;
    drawPlatformSprite(p, offsetX);
  }
}

function drawHoppy(offsetX){
  // Обновляем визуальный угол персонажа (наклон по платформе)
  let targetRot = 0;
  if (player.on && player.ground) {
    const g = player.ground;
    targetRot = (typeof g.tilt === 'number') ? g.tilt : 0;
  } else {
    targetRot = 0;
  }
  if (typeof player.visualRot !== 'number') player.visualRot = 0;
  player.visualRot += (targetRot - player.visualRot) * 0.2; // плавный lerp

  ctx.save();
  ctx.translate(offsetX, -(currentLevel >= 3 ? cameraY : 0));
  if (hoppy.ready){
    const flipLeft = (player.dir === -1);
    const dir = flipLeft ? -1 : 1;

    const baseX = Math.round(player.x);
    const drawY = Math.round(player.y + (typeof RENDER_FEET_OVERLAP !== 'undefined' ? RENDER_FEET_OVERLAP : 0));

    // Сквош/стретч по вертикали в зависимости от скорости
    const vy = (typeof player.vy === 'number') ? player.vy : 0;
    let targetY = 1 + Math.max(-0.12, Math.min(0.12, -vy / 850));
    targetY = Math.max(0.93, Math.min(1.12, targetY));
    const targetX = 1 / targetY;
    if (!player._scaleY) { player._scaleY = 1; player._scaleX = 1; }
    player._scaleY += (targetY - player._scaleY) * 0.12;
    player._scaleX += (targetX - player._scaleX) * 0.12;

    // Slope projection: дополнительное прижатие к наклонной платформе
    let yShift = 0;
    if (player.on && player.ground && typeof player.ground.tilt === 'number' && Math.abs(player.ground.tilt) > 0.0001) {
      const pxCenter = player.x + player.w / 2;
      const gxCenter = player.ground.x + player.ground.w / 2;
      yShift = Math.abs(pxCenter - gxCenter) * Math.sin(Math.abs(player.ground.tilt || 0));
    }

    // Пивот — центр по X и НИЗ по Y (пятки)
    const cx = baseX + player.w / 2;
    const cy = drawY + player.h + yShift;

    ctx.save();
    ctx.translate(cx, cy);
    // Учитываем разворот по горизонтали в угле
    const rot = player.visualRot * (flipLeft ? -1 : 1);
    ctx.rotate(rot);
    // Сначала отражаем по направлению, затем применяем сквош
    ctx.scale(dir * player._scaleX, player._scaleY);

    // Рисуем спрайт так, чтобы (0,0) было в пятках
    const imgX = -player.w / 2;
    const imgY = -player.h;
    ctx.drawImage(hoppy.img, imgX, imgY, player.w, player.h);

    ctx.restore();
  } else {
    ctx.fillStyle = '#2ecc71';
    ctx.fillRect(Math.round(player.x), Math.round(player.y), Math.round(player.w), Math.round(player.h));
  }
  ctx.restore();
}
function drawOverlay(title, actions){
  // MENU OVERRIDE: Draw Menu if in menu state
  if(gameState === 'menu'){
    drawMenu();
    return;
  }

  ctx.save(); ctx.globalAlpha = 0.55; ctx.fillStyle = '#000'; ctx.fillRect(0,0,W,H); ctx.restore();
  const kind = (gameState === 'win') ? 'win' : 'lose';
  const bg = OVERLAY[kind];
  const img = bg ? bg.img : null;
  const iW = (bg && bg.w) ? bg.w : 812; const iH = (bg && bg.h) ? bg.h : 535;
  const aspect = iW / iH;
  const maxW = Math.min(W * 0.63, 294); const maxH = Math.min(H * 0.49, 196);
  let boxW = maxW, boxH = Math.round(maxW / aspect);
  if (boxH > maxH){ boxH = maxH; boxW = Math.round(maxH * aspect); }
  const bx = Math.round((W - boxW)/2); const by = Math.round((H - boxH)/2);
  ctx.globalAlpha = 1.0;
  if (img) ctx.drawImage(img, bx, by, boxW, boxH);
  else { const r = 18; ctx.save(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(bx+r,by); ctx.arcTo(bx+boxW,by,bx+boxW,by+boxH,r); ctx.arcTo(bx+boxW,by+boxH,bx,by+boxH,r); ctx.arcTo(bx,by+boxH,bx,by,r); ctx.arcTo(bx,by,bx+boxW,by,r); ctx.closePath(); ctx.fill(); ctx.restore(); }
  const padX = Math.round(boxW * 0.09); const padY = Math.round(boxH * 0.18);
  const innerY = by + padY; const innerW = boxW - padX*2; const innerH = boxH - padY - Math.round(boxH*0.10);
  if (gameState === 'win') {
    ctx.save(); ctx.fillStyle = '#2E2E2E'; ctx.font = '700 20px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('УРОВЕНЬ ' + currentLevel, bx + boxW/2, innerY + Math.round(innerH * 0.18)); ctx.restore();
    ctx.save(); ctx.fillStyle = '#2E2E2E'; ctx.font = '600 16px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Протокол остановлен', bx + boxW/2, innerY + Math.round(innerH * 0.33)); ctx.restore();
  } else {
    ctx.save(); ctx.fillStyle = '#2E2E2E'; ctx.font = '700 20px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(title.text, bx + boxW/2, innerY + Math.round(innerH * 0.24)); ctx.restore();
  }
  uiButtons.length = 0;
  const btnW = Math.max(118, Math.min(136, Math.round(innerW*0.42))); const btnH = 40; const gap = Math.max(12, Math.round(innerW*0.08));
  const yb = innerY + Math.round(innerH*0.60);
  let x0 = bx + (boxW - (actions.length*btnW + (actions.length-1)*gap))/2;
  const w = 2*Math.PI*1.7; const clk = (typeof overlayClock==='number') ? overlayClock : 0;
  const pulse = 1.0 + 0.016 * Math.pow(Math.max(0, Math.sin(clk * w)), 2);
  for (let idx = 0; idx < actions.length; idx++) {
    const a = actions[idx]; const isPrimary = (a.label === 'Дальше');
    const x = x0; const y = yb; const isLose = (gameState === 'lose');
    if ( (gameState === 'win' && isPrimary) || (gameState === 'lose') ) {
      ctx.save(); ctx.translate(x + btnW/2, y + btnH/2); ctx.scale(pulse, pulse); ctx.translate(-(x + btnW/2), -(y + btnH/2));
    }
    const r = 12;
    ctx.beginPath(); ctx.moveTo(x+r, y); ctx.arcTo(x+btnW, y, x+btnW, y+btnH, r); ctx.arcTo(x+btnW, y+btnH, x, y+btnH, r); ctx.arcTo(x, y+btnH, x, y, r); ctx.arcTo(x, y, x+btnW, y, r); ctx.closePath();
    if (isLose) { const grad = ctx.createLinearGradient(0,y,0,y+btnH); grad.addColorStop(0, '#E74C3C'); grad.addColorStop(1, '#FF6B4A'); ctx.fillStyle = grad; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#B13A2E'; ctx.stroke(); ctx.restore(); }
    else if (isPrimary) { const grad = ctx.createLinearGradient(0,y,0,y+btnH); grad.addColorStop(0, '#4F8C45'); grad.addColorStop(1, '#67B35B'); ctx.fillStyle = grad; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#3E7336'; ctx.stroke(); ctx.restore(); }
    else { ctx.fillStyle = '#E9ECEB'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#4F8C45'; ctx.stroke(); }
    ctx.save();
    if ( (gameState === 'win' && isPrimary) || (gameState === 'lose') ) { ctx.translate(x + btnW/2, y + btnH/2); ctx.scale(pulse, pulse); ctx.translate(-(x + btnW/2), -(y + btnH/2)); }
    ctx.font = '600 15px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (isLose) { ctx.fillStyle = '#FFFFFF'; } else { ctx.fillStyle = isPrimary ? '#ffffff' : '#4F8C45'; }
    ctx.fillText(a.label, x + btnW/2, y + btnH/2); ctx.restore();
    uiButtons.push({x:x, y:y, w:btnW, h:btnH, action:a.action});
    x0 += btnW + gap;
  }
}

// --- MENU SYSTEM (NEW) ---
function drawMenu(){
  ctx.save();
  // Dark BG
  ctx.fillStyle = '#0d0f12';
  ctx.fillRect(0,0,W,H);
  
  // Title
  ctx.font = '700 32px system-ui';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.fillText('HOPPY', W/2, H*0.25);
  
  // Play Button
  const btnW = 200, btnH = 60;
  const bx = (W - btnW)/2, by = H*0.45;
  
  roundRectPath(bx, by, btnW, btnH, 12);
  ctx.fillStyle = '#2ecc71'; ctx.fill();
  
  ctx.font = '600 24px system-ui';
  ctx.fillStyle = '#fff';
  ctx.fillText('PLAY', W/2, by + btnH/2 + 2);
  
  uiButtons.push({x:bx, y:by, w:btnW, h:btnH, action:'menu_play'});
  
  // Level Selector
  ctx.font = '600 16px system-ui';
  ctx.fillStyle = '#fff';
  ctx.fillText('Select Level:', W/2, H*0.65);
  
  const levels = [1,2,3,4,5,6,7,8];
  const size = 44, gap = 16;
  const totalW = levels.length*size + (levels.length-1)*gap;
  let lx = (W - totalW)/2;
  const ly = H*0.68;
  
  for(let i=0; i<levels.length; i++){
     const lvl = levels[i];
     const isSel = (currentLevel === lvl);
     
     roundRectPath(lx, ly, size, size, 8);
     ctx.fillStyle = isSel ? '#f1c40f' : '#34495e';
     ctx.fill();
     
     ctx.fillStyle = isSel ? '#000' : '#fff';
     ctx.fillText(lvl, lx + size/2, ly + size/2 + 1);
     
     uiButtons.push({x:lx, y:ly, w:size, h:size, action:'lvl_'+lvl});
     
     lx += size + gap;
  }
  
  ctx.restore();
}


function triggerOverlayActionAt(x, y){
  // In MENU state, we just clear buttons and rebuild them each frame,
  // so we check the `uiButtons` array populated in drawMenu/drawOverlay.
  for(const b of uiButtons){
    if(x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h){
      
      if(gameState === 'menu'){
         if(b.action === 'menu_play'){
             setLevel(currentLevel); 
         } else if(b.action.startsWith('lvl_')){
             currentLevel = parseInt(b.action.split('_')[1]);
         }
         return; // Click handled
      }
    
      if(b.action === 'restart'){ setLevel(currentLevel); }
      if(b.action === 'next'){ if(currentLevel < LAST_LEVEL) setLevel(currentLevel+1); }
      if(b.action === 'again_all'){ setLevel(1); }
      break;
    }
  }
}
addEventListener('click', (e)=>{ 
    // Allow clicks in menu too
    if(!(gameState==='win'||gameState==='lose'||gameState==='menu')) return; 
    const r=c.getBoundingClientRect(); 
    triggerOverlayActionAt(e.clientX-r.left, e.clientY-r.top); 
});
let overlayPressedIndex = -1;
addEventListener('touchstart', (e)=>{ 
    if(!(gameState==='win'||gameState==='lose'||gameState==='menu')) return; 
    const t=e.changedTouches[0]; const r=c.getBoundingClientRect(); overlayPressedIndex=-1; const x=t.clientX-r.left; const y=t.clientY-r.top; 
    for(let i=0;i<uiButtons.length;i++){ const b=uiButtons[i]; if(x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h){overlayPressedIndex=i; break;} } 
    if(overlayPressedIndex!==-1)e.preventDefault(); 
}, {passive:false});
addEventListener('touchend', (e)=>{ 
    if(!(gameState==='win'||gameState==='lose'||gameState==='menu')) return; 
    if(overlayPressedIndex===-1)return; const t=e.changedTouches[0]; const r=c.getBoundingClientRect(); const b=uiButtons[overlayPressedIndex]; const x=t.clientX-r.left; const y=t.clientY-r.top; 
    if(b&&x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h){ triggerOverlayActionAt(x,y); } overlayPressedIndex=-1; e.preventDefault(); 
}, {passive:false});
addEventListener('touchcancel', ()=>{ overlayPressedIndex = -1; });

function checkWinByBodyCenter(prevHB,newHB){
  const yMid=finish.y + finish.h/2;
  const left=finish.x, right=finish.x+finish.w;
  const cxPrev=prevHB.x+prevHB.w/2, cxNew=newHB.x+newHB.w/2;
  const horizInside=(cxPrev>=left&&cxPrev<=right)||(cxNew>=left&&cxNew<=right);
  if(!horizInside) return false;
  const cyPrev=prevHB.y+prevHB.h/2, cyNew=newHB.y+newHB.h/2;
  return ((cyPrev>yMid)&&(cyNew<=yMid));
}

function spawnOnBottomPlatform(){
  let baseIndex = -1; for(let i=0;i<platforms.length;i++){ if(platforms[i].perm){ if(baseIndex===-1 || platforms[i].y>platforms[baseIndex].y) baseIndex=i; } }
  const base = platforms[baseIndex];
  if(!base){ player.x=100; player.y=H-player.h-40; player.vx=0; player.vy=0; player.on=false; player.ground=null; cameraY=0; return; }
  player.x=Math.max(0,Math.min(BASE_W-player.w,base.x+(base.w-player.w)/2));
  player.y=base.y-player.h; player.vx=0; player.vy=0; player.on=true; player.ground = base; lastGroundTime=timeSec;
  TIMER_TOTAL = getTimerTotal(currentLevel);
  if(currentLevel>=3){
    const targetScreenTop = H - 8 - 24 - player.h;
    const desiredCameraY = base.y - targetScreenTop;
    cameraMaxY = Math.max(cameraMaxY, desiredCameraY); cameraY = Math.max(0, Math.min(cameraMaxY, desiredCameraY));
  } else { cameraY = 0; }
}
function resetTransientForYellow(){
  for(const p of platforms){ 
    if(!p.perm){ p.state='off'; p.prevState='off'; p.tLocal=0; p.grace=0; p.solidDelay=0; p.waitExit=false; setAnim(p,'out',0); if(p.anim) p.anim.alpha=0; } 
  }
}

// ==========================================
// 8. ГЛАВНЫЙ ЦИКЛ (LOOP)
// ==========================================
hoppy.img.onload = ()=>{ 
    hoppy.ready=true; hoppy.naturalW=hoppy.img.naturalWidth; hoppy.naturalH=hoppy.img.naturalHeight; 
    resizeCanvas(); 
    // Не запускаем уровень сразу, а ждем в меню. Но для рендера меню нужен цикл.
    gameState = 'menu';
    requestAnimationFrame(step); 
};

let lastTS=performance.now();
function step(nowTS){
  const dt=Math.min(0.033,(nowTS-lastTS)/1000); lastTS=nowTS;
  drawMatrix(dt);
  
  if(gameState==='menu'){
      ctx.clearRect(0,0,W,H);
      drawMenu(); // Рисуем меню
      requestAnimationFrame(step);
      return;
  }

  if(gameState==='play'){ timeSec+=dt; timerElapsed+=dt; if(timerElapsed>=TIMER_TOTAL) gameState='lose'; }
  if(gameState==='play'){
    let targetVx=0;
    const baseSpeed = SPEED_X * (IS_TOUCH ? MOBILE_SPEED_FACTOR : 1.0);
    if(IS_TOUCH && overrideMove.active){
      if(timeSec <= overrideMove.until){
        if(overrideMove.side < 0){ targetVx -= baseSpeed * NUDGE_SPEED_SCALE; player.dir = -1; }
        else { targetVx += baseSpeed * NUDGE_SPEED_SCALE; player.dir = +1; }
      } else { overrideMove.active = false; keys.left = false; keys.right = false; }
    }
    if(keys.right)targetVx+=baseSpeed; if(keys.left)targetVx-=baseSpeed;
    // --- SLIPPERY LOGIC START ---
    const hbSlide = getHitbox();
    for(const p of platforms){
      if(!p.slippery) continue;
      if(player.ground === p){
        if(typeof p.tilt !== 'number') p.tilt = 0;
        if(typeof p.targetTilt !== 'number') p.targetTilt = 0;
        const pxCenter = p.x + (p.w||180)/2;
        const playerCenter = hbSlide.x + hbSlide.w/2;
        const deadZone = (p.w||180) * 0.04;
        if(playerCenter > pxCenter + deadZone) p.targetTilt = 0.30;
        else if(playerCenter < pxCenter - deadZone) p.targetTilt = -0.30;
        else p.targetTilt = 0;
      } else {
        p.targetTilt = 0;
      }
      const tiltLerp = Math.min(1, 10*dt);
      const curTilt = (typeof p.tilt === 'number') ? p.tilt : 0;
      p.tilt = curTilt + (p.targetTilt - curTilt) * tiltLerp;
    }
    if(player.ground && player.ground.slippery){
      const slideAccel = 850;
      const t = (typeof player.ground.tilt === 'number') ? player.ground.tilt : 0;
      if(t > 0.01) player.vx += slideAccel * dt;
      else if(t < -0.01) player.vx -= slideAccel * dt;
    }
    // --- SLIPPERY LOGIC END ---
    const accelBase = player.on ? ACCEL_GROUND_PER_S : (ACCEL_AIR_PER_S * AIR_CONTROL_FACTOR);
    let accelPerS = accelBase;
    if(player.on && player.ground && player.ground.slippery){
      accelPerS *= 0.40; // на скользкой платформе всё ещё сложнее, но у игрока больше контроля
    }
    const lerpK = Math.min(1, accelPerS * dt);
    const desired = targetVx;
    player.vx = player.vx + (desired - player.vx) * lerpK;
    
    if(Math.abs(desired) < 1){ player.vx = applyFriction(player.vx, player.on, dt); }
    
    const canCoyote=(timeSec-lastGroundTime)<=COYOTE;
    const buffered=(timeSec-lastJumpPress)<=BUFFER;
    if(buffered&&(player.on||canCoyote)){ player.vy=JUMP_VY; player.on=false; lastJumpPress=-1; }
    const prevHB=getHitbox(); const prevBottom=prevHB.y+prevHB.h;
    player.vy+=G*dt; if(player.vy>MAX_FALL)player.vy=MAX_FALL; if(player.vy<-MAX_RISE)player.vy=-MAX_RISE; _applyPendingJumpScale();
    player.x+=player.vx*dt; player.y+=player.vy*dt; player.on=false;
    if(currentLevel>=3){ const camTarget = Math.max(0, Math.min(cameraMaxY, player.y - H*0.60)); cameraY += (camTarget - cameraY) * 0.12; }
    const hb=getHitbox();
    if(cookie && !cookie.taken){
      const cx = cookie.x - cookie.r;
      const cy = cookie.y - cookie.r;
      const cw = cookie.r * 2;
      const ch = cookie.r * 2;
      if(hb.x < cx + cw && hb.x + hb.w > cx &&
         hb.y < cy + ch && hb.y + hb.h > cy){
        cookie.taken = true;
        timerElapsed = Math.max(0, timerElapsed - 1.5);
      }
    }
    for(const p of platforms){ if(p.falling) updateFallingPlatform(p, dt); }
    for(const p of platforms){ if(!p.perm) updateBridgeState(p,dt,hb); }
    const newHB=getHitbox(); const newBottom=newHB.y+newHB.h;
    if(player.vy>=0){
      player.ground = null;
      for(const p of platforms){
        if(!bridgeIsSolidForLanding(p)) continue;
        const top=p.y,left=p.x,right=p.x+p.w;
        const ow=Math.min(newHB.x+newHB.w,right)-Math.max(newHB.x,left);
        const enough=ow>=MIN_OVERLAP;
        const crossed=(prevBottom<top && newBottom>=top) || (Math.abs(newBottom-top)<=TOP_TOLERANCE);
        if(enough&&crossed){
          if(!p.perm && p.grace>0) p.grace=0;
          player.y=top-newHB.h-HITBOX_OFFSET_Y; player.vy=0; player.on=true; player.ground = p; lastGroundTime=timeSec;
          if(p.falling && (!p.fallState || p.fallState === 'stable')){
            p.fallState = 'shaking';
            p.fallTimer = 0;
          }
          break;
        }
      }
    }
    if(checkWinByBodyCenter(prevHB,newHB)) gameState='win';
    const offRight=player.x>BASE_W+40, offLeft=player.x+player.w<-40;
    const offBottom = (currentLevel>=3) ? ((player.y - cameraY) > H + 140) : (player.y>BASE_H+80);
    if(offBottom || offRight || offLeft){ gameState='lose'; }
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0,0,W,H);
  let offsetXBase = Math.round((W - BASE_W) / 2);
  let offsetX = offsetXBase;
  
  drawButton(); 
  drawPlatforms(offsetX); 
  drawCookie(offsetX);
  drawHoppy(offsetX); 
  drawTimer();
  if(gameState==='win'){
    if(currentLevel < LAST_LEVEL){
      drawOverlay({text:'Протокол остановлен (Уровень '+currentLevel+')', color:'#2ecc71'}, [ {label:'Дальше', action:'next'}, {label:'Заново', action:'restart'} ]);
    } else {
      drawOverlay({text:'Протокол остановлен (Все уровни)', color:'#2ecc71'}, [ {label:'Заново', action:'again_all'} ]);
    }
  }
  if(gameState==='lose'){ drawOverlay({text:'Очистка выполнена', color:'#c0392b'}, [ {label:'Заново', action:'restart'} ]); }
  if (gameState === 'win' || gameState === 'lose') { overlayClock += dt; }
  requestAnimationFrame(step);
}

resizeCanvas();

addEventListener('keydown',e=>{ if(gameState!=='play')return; if(e.key==='ArrowLeft'||e.key==='a'){keys.left=true; player.dir=-1;} if(e.key==='ArrowRight'||e.key==='d'){keys.right=true; player.dir=1;} if(e.key==='ArrowUp'||e.key==='w'||e.code==='Space'){ if(!keys.up){lastJumpPress=timeSec; player.jumpHeld=true;} keys.up=true; e.preventDefault(); } });
addEventListener('keyup',e=>{ if(e.key==='ArrowLeft'||e.key==='a') keys.left=false; if(e.key==='ArrowRight'||e.key==='d') keys.right=false; if(e.key==='ArrowUp'||e.key==='w'||e.code==='Space'){ keys.up=false; player.jumpHeld=false; if(player.vy<0) player.vy *= 0.55; e.preventDefault(); } });
addEventListener('keydown',(e)=>{ if(e.key==='r'||e.key==='R'){ setLevel(currentLevel); } if((e.key==='Enter') && (gameState === 'win' || gameState === 'lose')){ if(gameState==='win' && currentLevel < LAST_LEVEL) setLevel(currentLevel+1); else setLevel(currentLevel); } });
