/* ══════════════════════════════════════
   Nyang-Suite 0.5 — main.js
══════════════════════════════════════ */

const { Engine, Render, Runner, Bodies, Composite,
        Mouse, MouseConstraint, Body } = Matter;

// ── State ─────────────────────────────────
let cleanupScore    = 0;
let empathyScore    = 0;
let stressReduction = 0;
let isStayActive    = false;
let timerInterval   = null;
let timeLeft        = 180;
let blinkTimer      = null;

// Physics
let engine, render, runner, catBody;

// Pointer tracking
let pressStart     = null;
let lastPos        = null;
let lastMoveTime   = null;
let velocity       = 0;
let longPressTimer = null;
let strokeThrottle = null;

const LONG_PRESS_MS   = 600;
const FAST_THRESHOLD  = 320;
const STROKE_THROTTLE = 380;

// ── Web Audio ──────────────────────────────
let audioCtx = null;
let bgmNodes = null;
let isMuted  = false;

function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playChime() {
  if (isMuted) return;
  const ctx  = getAudioCtx();
  const now  = ctx.currentTime;
  const gain = ctx.createGain();
  gain.connect(ctx.destination);

  [880, 1320, 1760].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.gain.setValueAtTime(0, now + i * 0.07);
    gain.gain.linearRampToValueAtTime(0.18, now + i * 0.07 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.55);
    osc.start(now + i * 0.07);
    osc.stop(now + i * 0.07 + 0.6);
  });
}

function playCoin() {
  if (isMuted) return;
  const ctx  = getAudioCtx();
  const now  = ctx.currentTime;
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = 'square';
  osc.frequency.setValueAtTime(520, now);
  osc.frequency.exponentialRampToValueAtTime(1280, now + 0.07);
  gain.gain.setValueAtTime(0.18, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
  osc.start(now);
  osc.stop(now + 0.2);
}

function playPaperTear() {
  if (isMuted) return;
  const ctx      = getAudioCtx();
  const now      = ctx.currentTime;
  const duration = 0.55;
  const sr       = ctx.sampleRate;
  const buf      = ctx.createBuffer(1, Math.floor(sr * duration), sr);
  const data     = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t    = i / data.length;
    const env  = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
    data[i] = (Math.random() * 2 - 1) * env * Math.exp(-t * 3);
  }
  const source = ctx.createBufferSource();
  source.buffer = buf;
  const bpf = ctx.createBiquadFilter();
  bpf.type = 'bandpass';
  bpf.frequency.value = 3800;
  bpf.Q.value = 0.8;
  const gain = ctx.createGain();
  gain.gain.value = 0.5;
  source.connect(bpf);
  bpf.connect(gain);
  gain.connect(ctx.destination);
  source.start(now);
}

function startBGM() {
  if (bgmNodes || isMuted) return;
  const ctx = getAudioCtx();

  // 골골송 기반: sawtooth 저주파 + LFO (purr)
  const purr     = ctx.createOscillator();
  const lfo      = ctx.createOscillator();
  const lfoGain  = ctx.createGain();
  const purrGain = ctx.createGain();
  const lpf      = ctx.createBiquadFilter();

  lfo.type = 'sine';
  lfo.frequency.value = 22;
  lfoGain.gain.value  = 18;

  purr.type = 'sawtooth';
  purr.frequency.value = 100;
  lpf.type = 'lowpass';
  lpf.frequency.value = 280;
  purrGain.gain.value = 0.055;

  lfo.connect(lfoGain);
  lfoGain.connect(purr.frequency);
  purr.connect(lpf);
  lpf.connect(purrGain);
  purrGain.connect(ctx.destination);

  // 앰비언트 드론 (Lo-Fi 감성)
  const drone     = ctx.createOscillator();
  const droneGain = ctx.createGain();
  drone.type = 'sine';
  drone.frequency.value = 55;
  droneGain.gain.value  = 0.03;
  drone.connect(droneGain);
  droneGain.connect(ctx.destination);

  lfo.start();
  purr.start();
  drone.start();

  bgmNodes = { purr, lfo, drone };
}

function stopBGM() {
  if (!bgmNodes) return;
  try { bgmNodes.purr.stop();  } catch (_) {}
  try { bgmNodes.lfo.stop();   } catch (_) {}
  try { bgmNodes.drone.stop(); } catch (_) {}
  bgmNodes = null;
}

function toggleMute() {
  isMuted = !isMuted;
  document.getElementById('btn-mute').textContent = isMuted ? '🔇' : '🔊';
  if (isMuted) {
    stopBGM();
  } else if (isStayActive) {
    startBGM();
  }
}

// ── Scene management ──────────────────────
function showScene(id) {
  document.querySelectorAll('.scene').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ── Blink loop (cat-sprite filter 로 표현) ─
function scheduleNextBlink() {
  blinkTimer = setTimeout(() => {
    if (!isStayActive) return;
    const sprite = document.getElementById('cat-sprite');
    if (!sprite) return;
    sprite.style.filter =
      'drop-shadow(0 18px 48px rgba(0,0,0,0.88)) drop-shadow(0 6px 14px rgba(0,0,0,0.72)) brightness(1.6)';
    setTimeout(() => {
      if (sprite) sprite.style.filter = '';
      scheduleNextBlink();
    }, 90);
  }, 2800 + Math.random() * 3500);
}

// ── Status popup (이모지) ─────────────────
function spawnPopup(icon, x, y) {
  const layer = document.getElementById('popup-layer');
  const el    = document.createElement('div');
  el.className   = 'status-popup';
  el.textContent = icon;
  el.style.left  = `${x - 18}px`;
  el.style.top   = `${y - 32}px`;
  layer.appendChild(el);
  setTimeout(() => el.remove(), 1400);
}

// ── Interaction handlers ──────────────────
function triggerSlow(x, y) {
  cleanupScore += 5;
  empathyScore += 2;
  const icons = ['💖', '✨', '💖', '✨', '🌸'];
  spawnPopup(icons[Math.floor(Math.random() * icons.length)], x, y);
  playChime();
  if (navigator.vibrate) navigator.vibrate(80);
}

function triggerFast(x, y) {
  cleanupScore    += 20;
  stressReduction += 3;
  spawnPopup('⚡', x, y);
  playCoin();
  if (navigator.vibrate) navigator.vibrate([25, 10, 25]);
}

function triggerTap(x, y) {
  cleanupScore += 1;
  spawnPopup('✨', x, y);
  playCoin();
  if (navigator.vibrate) navigator.vibrate(12);

  if (catBody) {
    Body.applyForce(catBody, catBody.position, {
      x: (Math.random() - 0.5) * 0.06,
      y: -0.05,
    });
  }

  const container = document.getElementById('cat-container');
  container.classList.add('cat-bounce');
  setTimeout(() => container.classList.remove('cat-bounce'), 340);
}

function triggerLongPress(x, y) {
  empathyScore += 5;
  spawnPopup('💖', x, y);
  setTimeout(() => spawnPopup('💖', x - 30, y - 20), 180);
  setTimeout(() => spawnPopup('💖', x + 20, y - 10), 320);
  playChime();
  if (navigator.vibrate) navigator.vibrate([65, 38, 65, 38, 65]);
  pressStart = null;
}

// ── Pointer events ────────────────────────
function onPointerDown(e) {
  if (!isStayActive) return;
  e.preventDefault();
  pressStart   = Date.now();
  lastPos      = { x: e.clientX, y: e.clientY };
  lastMoveTime = pressStart;
  velocity     = 0;

  longPressTimer = setTimeout(() => {
    triggerLongPress(e.clientX, e.clientY);
  }, LONG_PRESS_MS);
}

function onPointerMove(e) {
  if (!isStayActive || !pressStart) return;
  e.preventDefault();

  clearTimeout(longPressTimer);
  longPressTimer = null;

  const now = Date.now();
  const dx  = e.clientX - lastPos.x;
  const dy  = e.clientY - lastPos.y;
  const dt  = Math.max(now - lastMoveTime, 1);
  velocity  = Math.sqrt(dx * dx + dy * dy) / dt * 1000;

  lastPos      = { x: e.clientX, y: e.clientY };
  lastMoveTime = now;

  if (!strokeThrottle) {
    if (velocity > FAST_THRESHOLD) {
      triggerFast(e.clientX, e.clientY);
    } else {
      triggerSlow(e.clientX, e.clientY);
    }
    strokeThrottle = setTimeout(() => { strokeThrottle = null; }, STROKE_THROTTLE);
  }
}

function onPointerUp(e) {
  clearTimeout(longPressTimer);
  longPressTimer = null;

  if (!pressStart) return;
  const duration = Date.now() - pressStart;
  pressStart = null;

  if (duration < 220 && velocity < 90) {
    triggerTap(e.clientX, e.clientY);
  }
}

function initCatEvents() {
  const stage = document.getElementById('cat-stage');
  stage.addEventListener('pointerdown',   onPointerDown,  { passive: false });
  stage.addEventListener('pointermove',   onPointerMove,  { passive: false });
  stage.addEventListener('pointerup',     onPointerUp);
  stage.addEventListener('pointercancel', () => {
    clearTimeout(longPressTimer);
    pressStart = null;
  });
}

// ── Matter.js physics ─────────────────────
function initPhysics() {
  const stage = document.getElementById('cat-stage');
  const W = stage.offsetWidth;
  const H = stage.offsetHeight;

  engine = Engine.create({ gravity: { y: 0.5 } });

  render = Render.create({
    element: stage,
    engine,
    options: {
      width:      W,
      height:     H,
      wireframes: false,
      background: 'transparent',
    },
  });

  Object.assign(render.canvas.style, {
    position:      'absolute',
    inset:         '0',
    opacity:       '0.08',
    pointerEvents: 'none',
    zIndex:        '0',
  });

  catBody = Bodies.circle(W / 2, H / 2, 52, {
    restitution: 0.78,
    friction:    0.04,
    render: { fillStyle: 'rgba(201,168,76,0.55)', strokeStyle: 'transparent', lineWidth: 0 },
  });

  const wall = (x, y, w, h) =>
    Bodies.rectangle(x, y, w, h, { isStatic: true, render: { visible: false } });

  Composite.add(engine.world, [
    catBody,
    wall(W / 2, H + 25,  W + 50, 50),
    wall(W / 2, -25,     W + 50, 50),
    wall(-25,   H / 2,   50, H + 50),
    wall(W + 25, H / 2,  50, H + 50),
  ]);

  const mouse = Mouse.create(render.canvas);
  const mc    = MouseConstraint.create(engine, {
    mouse,
    constraint: { stiffness: 0.18, render: { visible: false } },
  });
  Composite.add(engine.world, mc);

  Render.run(render);
  runner = Runner.create();
  Runner.run(runner, engine);
}

// ── Timer ─────────────────────────────────
function fmt(s) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function startTimer() {
  timeLeft = 180;
  const bar   = document.getElementById('timer-bar');
  const label = document.getElementById('timer-label');
  bar.style.setProperty('--progress', '1');
  label.textContent = `🐾 ${fmt(timeLeft)}`;

  timerInterval = setInterval(() => {
    timeLeft = Math.max(0, timeLeft - 1);
    bar.style.setProperty('--progress', (timeLeft / 180).toFixed(4));
    label.textContent = `🐾 ${fmt(timeLeft)}`;
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      endStay();
    }
  }, 1000);
}

// ── Check-out / receipt ───────────────────
function buildReceipt() {
  const elapsed = 180 - timeLeft;
  document.getElementById('receipt-duration').textContent = fmt(elapsed);

  const statsEl = document.getElementById('receipt-stats');
  const rows = [
    { key: 'Clean-up', val: `+${cleanupScore.toLocaleString()}`, cls: 'positive' },
    { key: 'Empathy',  val: `+${empathyScore}`,                  cls: 'positive' },
    { key: 'Stress',   val: `-${Math.min(stressReduction + 30, 99)}%`, cls: 'negative' },
  ];
  statsEl.innerHTML = rows
    .map(r => `<div class="receipt-row">
      <span class="r-key">${r.key}</span>
      <span class="r-val ${r.cls}">${r.val}</span>
    </div>`)
    .join('');

  document.getElementById('receipt-date').textContent =
    new Date().toLocaleString('ko-KR', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
}

function endStay() {
  isStayActive = false;
  stopBGM();
  playPaperTear();
  buildReceipt();
  showScene('scene-checkout');
}

// ── Save receipt (html2canvas → PNG) ─────
function saveReceipt() {
  const el  = document.getElementById('receipt');
  const btn = document.getElementById('btn-save');
  btn.textContent = '저장 중...';
  btn.disabled    = true;

  html2canvas(el, {
    scale:           2,
    backgroundColor: '#ffffff',
    useCORS:         true,
    logging:         false,
  }).then(canvas => {
    const a      = document.createElement('a');
    a.href       = canvas.toDataURL('image/png');
    a.download   = `hwakance-receipt-${new Date().toISOString().slice(0, 10)}.png`;
    a.click();
  }).finally(() => {
    btn.textContent = '영수증 저장';
    btn.disabled    = false;
  });
}

// ── Entry points ──────────────────────────
document.getElementById('btn-checkin').addEventListener('click', () => {
  cleanupScore    = 0;
  empathyScore    = 0;
  stressReduction = 0;

  showScene('scene-stay');
  isStayActive = true;
  initCatEvents();
  initPhysics();
  startTimer();
  scheduleNextBlink();
  startBGM();
  if (navigator.vibrate) navigator.vibrate(120);
});

document.getElementById('btn-mute').addEventListener('click', toggleMute);

document.getElementById('btn-restart').addEventListener('click', () => {
  clearTimeout(blinkTimer);
  blinkTimer = null;
  stopBGM();

  if (runner) Runner.stop(runner);
  if (render) {
    Render.stop(render);
    render.canvas.remove();
  }
  if (engine) Engine.clear(engine);

  clearInterval(timerInterval);
  document.getElementById('timer-bar').style.setProperty('--progress', '1');
  document.getElementById('timer-label').textContent = '🐾 03:00';

  showScene('scene-checkin');
});

document.getElementById('btn-save').addEventListener('click', saveReceipt);
