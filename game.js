// Rendering, animation, input and sound. All game rules live in board.js.
(function () {
  const ROWS = 9, COLS = 8;
  const PALETTE = [
    { base: '#ff3b30', light: '#ffa199', dark: '#a3150e' }, // red
    { base: '#ff8f1f', light: '#ffcf8f', dark: '#b85300' }, // orange
    { base: '#ffd60a', light: '#fff3a8', dark: '#b38f00' }, // yellow
    { base: '#34c759', light: '#a8f5b4', dark: '#137a2f' }, // green
    { base: '#2f80ff', light: '#a8ccff', dark: '#0d47b0' }, // blue
  ];
  const SPRINKLES = ['#ff3b30', '#ffd60a', '#34c759', '#2f80ff', '#ffffff', '#ff6fd8', '#ff8f1f'];
  const FISH_TILT = -0.55;
  const FONT = "'Lilita One', ui-rounded, 'Arial Rounded MT Bold', system-ui, sans-serif";
  // A fish tank on a shelf in a sunny kids' room.
  const THEME = {
    wall: '#ffd45c',
    wallDot: '#f7c443',
    waterTop: '#1c8fd6',
    waterDeep: '#0e4f9a',
    air: '#dff4ff',
    glass: '#bfeaff',
    sand: '#f2d49b',
    wood: '#b86b3c',
    woodDark: '#8e4e26',
    ink: '#16285a',
    gum: '#ff5d8f',
  };
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const rng = Math.random;
  const grid = Board.createBoard(ROWS, COLS, rng);

  let W = 0, H = 0, dpr = 1, cell = 40, boardX = 0, boardY = 0, scoreH = 80;
  let tank = { x: 0, y: 0, w: 0, h: 0, surface: 0, sand: 0 };
  let now = 0, last = 0;
  let busy = true, falling = true;
  let score = 0, shownScore = 0, blastCount = 0, scoreBumpAt = -1e9;
  let slosh = 0;
  let pressed = null, swapAnim = null;
  let muted = false;

  const events = [];      // {at, fn}
  const projectiles = []; // flying fish
  const beams = [];       // colour-ball lightning
  const rings = [];       // shockwaves
  const particles = [];
  const texts = [];
  const bubbles = [];
  let fishSprites = [], ballSprite = null, bgCanvas = null;

  // ---------- layout & sprites ----------

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    scoreH = Math.max(64, Math.round(H * 0.1));
    // tank, in cells: side glass 0.22, air 0.3, water above board 0.3, sand 0.65, shelf 0.4
    const tankW = COLS + 0.44, tankH = ROWS + 0.3 + 0.3 + 0.65, shelf = 0.4;
    cell = Math.floor(Math.min((W - 24) / tankW, (H - scoreH - 24) / (tankH + shelf)));
    tank.w = tankW * cell;
    tank.h = tankH * cell;
    tank.x = Math.round((W - tank.w) / 2);
    tank.y = Math.round(scoreH + (H - scoreH - (tankH + shelf) * cell) * 0.45);
    tank.surface = tank.y + 0.3 * cell;
    tank.sand = tank.y + tank.h - 0.65 * cell;
    boardX = tank.x + 0.22 * cell;
    boardY = tank.surface + 0.3 * cell;
    buildSprites();
    buildBackground();
  }

  function makeCanvas(size) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    return c;
  }

  // Fish drawn facing left, centred, filling about 85% of the cell.
  function drawFish(g, s, col) {
    g.save();
    g.translate(s / 2, s / 2);
    const u = s / 100;
    g.lineJoin = 'round';

    // tail
    g.beginPath();
    g.moveTo(18 * u, 0);
    g.quadraticCurveTo(32 * u, -6 * u, 44 * u, -24 * u);
    g.quadraticCurveTo(38 * u, 0, 44 * u, 24 * u);
    g.quadraticCurveTo(32 * u, 6 * u, 18 * u, 0);
    g.fillStyle = col.base;
    g.fill();
    g.strokeStyle = col.dark;
    g.lineWidth = 2.5 * u;
    g.stroke();

    // dorsal fin
    g.beginPath();
    g.moveTo(-14 * u, -17 * u);
    g.quadraticCurveTo(0, -36 * u, 14 * u, -14 * u);
    g.closePath();
    g.fillStyle = col.dark;
    g.fill();

    // body
    g.beginPath();
    g.ellipse(-6 * u, 0, 30 * u, 22 * u, 0, 0, Math.PI * 2);
    const grad = g.createRadialGradient(-14 * u, -10 * u, 2 * u, -6 * u, 0, 32 * u);
    grad.addColorStop(0, col.light);
    grad.addColorStop(0.45, col.base);
    grad.addColorStop(1, col.dark);
    g.fillStyle = grad;
    g.fill();
    g.strokeStyle = col.dark;
    g.lineWidth = 2.5 * u;
    g.stroke();

    // jelly centre mark, like the real fish
    g.beginPath();
    g.arc(-2 * u, 2 * u, 10 * u, 0, Math.PI * 2);
    g.fillStyle = 'rgba(0,0,0,0.18)';
    g.fill();
    g.beginPath();
    g.arc(-2 * u, 2 * u, 10 * u, Math.PI * 1.1, Math.PI * 1.7);
    g.strokeStyle = 'rgba(255,255,255,0.5)';
    g.lineWidth = 2 * u;
    g.stroke();

    // eye
    g.beginPath();
    g.arc(-24 * u, -5 * u, 6 * u, 0, Math.PI * 2);
    g.fillStyle = '#fff';
    g.fill();
    g.beginPath();
    g.arc(-25.5 * u, -5 * u, 3.2 * u, 0, Math.PI * 2);
    g.fillStyle = '#1a1a2e';
    g.fill();
    g.beginPath();
    g.arc(-26.5 * u, -6.5 * u, 1.2 * u, 0, Math.PI * 2);
    g.fillStyle = '#fff';
    g.fill();

    // smile
    g.beginPath();
    g.arc(-30 * u, 5 * u, 4 * u, 0.2, 1.6);
    g.strokeStyle = col.dark;
    g.lineWidth = 2 * u;
    g.stroke();

    // gloss
    g.beginPath();
    g.ellipse(-12 * u, -12 * u, 14 * u, 5 * u, -0.2, 0, Math.PI * 2);
    g.fillStyle = 'rgba(255,255,255,0.45)';
    g.fill();
    g.restore();
  }

  function drawBall(g, s) {
    const u = s / 100;
    g.save();
    g.translate(s / 2, s / 2);
    g.beginPath();
    g.arc(0, 0, 40 * u, 0, Math.PI * 2);
    const grad = g.createRadialGradient(-12 * u, -14 * u, 4 * u, 0, 0, 42 * u);
    grad.addColorStop(0, '#9a5a32');
    grad.addColorStop(0.55, '#5c2f15');
    grad.addColorStop(1, '#2e1306');
    g.fillStyle = grad;
    g.fill();

    // sprinkles: fixed layout so every ball looks the same
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 26; i++) {
      const a = rand() * Math.PI * 2;
      const d = Math.sqrt(rand()) * 32 * u;
      g.save();
      g.translate(Math.cos(a) * d, Math.sin(a) * d);
      g.rotate(rand() * Math.PI);
      g.beginPath();
      g.arc(0, 0, 4.2 * u, 0, Math.PI * 2);
      g.fillStyle = SPRINKLES[i % SPRINKLES.length];
      g.fill();
      g.beginPath();
      g.arc(-1.2 * u, -1.2 * u, 1.4 * u, 0, Math.PI * 2);
      g.fillStyle = 'rgba(255,255,255,0.6)';
      g.fill();
      g.restore();
    }

    g.beginPath();
    g.ellipse(-14 * u, -18 * u, 13 * u, 7 * u, -0.6, 0, Math.PI * 2);
    g.fillStyle = 'rgba(255,255,255,0.3)';
    g.fill();
    g.restore();
  }

  function buildSprites() {
    const s = Math.max(8, Math.round(cell * dpr));
    fishSprites = PALETTE.map((col) => {
      const c = makeCanvas(s);
      drawFish(c.getContext('2d'), s, col);
      return c;
    });
    ballSprite = makeCanvas(s);
    drawBall(ballSprite.getContext('2d'), s);
  }

  function buildBackground() {
    bgCanvas = makeCanvas(1);
    bgCanvas.width = Math.round(W * dpr);
    bgCanvas.height = Math.round(H * dpr);
    const g = bgCanvas.getContext('2d');
    g.scale(dpr, dpr);

    // wallpaper: butter yellow with offset polka dots
    g.fillStyle = THEME.wall;
    g.fillRect(0, 0, W, H);
    g.fillStyle = THEME.wallDot;
    const gap = 28;
    for (let y = 0, row = 0; y < H + gap; y += gap, row++)
      for (let x = row % 2 ? gap / 2 : 0; x < W + gap; x += gap) {
        g.beginPath();
        g.arc(x, y, 4, 0, Math.PI * 2);
        g.fill();
      }

    // wooden cabinet the tank sits on, running off the bottom of the screen
    const top = tank.y + tank.h;
    const cx0 = Math.max(4, tank.x - 0.35 * cell), cw = Math.min(W - 8, tank.w + 0.7 * cell);
    g.fillStyle = 'rgba(22,40,90,0.14)';
    g.fillRect(cx0 + 10, top + 10, cw, H);
    g.fillStyle = THEME.wood;
    g.fillRect(cx0, top, cw, H);
    g.fillStyle = THEME.woodDark;
    g.fillRect(cx0, top + 0.3 * cell, cw, 0.1 * cell);
    const drawerH = Math.min(1.6 * cell, H - top - 0.8 * cell);
    if (drawerH > 0.8 * cell) {
      const dw = (cw - 0.9 * cell) / 2;
      for (let i = 0; i < 2; i++) {
        const dx = cx0 + 0.3 * cell + i * (dw + 0.3 * cell);
        pathRound(g, dx, top + 0.65 * cell, dw, drawerH, 0.15 * cell);
        g.strokeStyle = THEME.woodDark;
        g.lineWidth = Math.max(2, cell * 0.06);
        g.stroke();
        g.beginPath();
        g.arc(dx + dw / 2, top + 0.65 * cell + drawerH / 2, 0.14 * cell, 0, Math.PI * 2);
        g.fillStyle = THEME.ink;
        g.fill();
      }
    }

    // tank body
    const r = 0.35 * cell;
    g.save();
    pathRound(g, tank.x, tank.y, tank.w, tank.h, r);
    g.clip();
    g.fillStyle = THEME.air;
    g.fillRect(tank.x, tank.y, tank.w, tank.surface - tank.y + 0.2 * cell);
    const water = g.createLinearGradient(0, tank.surface, 0, tank.sand);
    water.addColorStop(0, THEME.waterTop);
    water.addColorStop(1, THEME.waterDeep);
    g.fillStyle = water;
    g.fillRect(tank.x, tank.surface + 0.1 * cell, tank.w, tank.y + tank.h - tank.surface);

    // sand with a few pebbles
    g.fillStyle = THEME.sand;
    g.beginPath();
    g.moveTo(tank.x, tank.sand + 0.15 * cell);
    for (let x = 0; x <= tank.w; x += 8) g.lineTo(tank.x + x, tank.sand + Math.sin(x / (cell * 0.9)) * 0.08 * cell + 0.1 * cell);
    g.lineTo(tank.x + tank.w, tank.y + tank.h);
    g.lineTo(tank.x, tank.y + tank.h);
    g.fill();
    const pebbles = ['#e3b873', '#f5a3b9', '#ffffff', '#c9e6a5'];
    for (let i = 0; i < 26; i++) {
      const px = tank.x + ((i * 97) % 100) / 100 * tank.w;
      const py = tank.sand + 0.25 * cell + ((i * 53) % 100) / 100 * 0.35 * cell;
      g.beginPath();
      g.ellipse(px, py, 0.07 * cell + (i % 3) * 0.02 * cell, 0.05 * cell, 0, 0, Math.PI * 2);
      g.fillStyle = pebbles[i % pebbles.length];
      g.fill();
    }
    g.restore();
  }

  function pathRound(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  // ---------- helpers ----------

  const cx = (c) => boardX + (c + 0.5) * cell;
  const cy = (r) => boardY + (r + 0.5) * cell;
  const parseKey = (k) => k.split(',').map(Number);
  const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  function schedule(delay, fn) {
    events.push({ at: now + delay, fn });
  }

  function pieceColor(p) {
    return p.type === 'fish' ? PALETTE[p.color].base : SPRINKLES[Math.floor(Math.random() * SPRINKLES.length)];
  }

  // ---------- sound ----------

  const sfx = (function () {
    let ac = null, lastPop = 0, noise = null;
    function ensure() {
      if (!ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ac = new AC();
        noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
        const d = noise.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      if (ac.state === 'suspended') ac.resume();
      return ac;
    }
    function env(gain, t, peak, len) {
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(peak, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + len);
    }
    function pop(n) {
      if (muted || !ac) return;
      const t = ac.currentTime;
      if (t - lastPop < 0.03) return;
      lastPop = t;
      const o = ac.createOscillator(), g = ac.createGain();
      const f = 420 * Math.pow(2, Math.min(n, 24) / 24) * (0.95 + Math.random() * 0.1);
      o.type = 'sine';
      o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(f * 1.8, t + 0.08);
      env(g, t, 0.18, 0.14);
      o.connect(g).connect(ac.destination);
      o.start(t);
      o.stop(t + 0.16);
    }
    function noiseBurst(type, f0, f1, peak, len) {
      if (muted || !ac) return;
      const t = ac.currentTime;
      const src = ac.createBufferSource(), flt = ac.createBiquadFilter(), g = ac.createGain();
      src.buffer = noise;
      flt.type = type;
      flt.frequency.setValueAtTime(f0, t);
      flt.frequency.exponentialRampToValueAtTime(f1, t + len);
      env(g, t, peak, len);
      src.connect(flt).connect(g).connect(ac.destination);
      src.start(t);
      src.stop(t + len + 0.05);
    }
    function whoosh() { noiseBurst('bandpass', 400, 2400, 0.25, 0.3); }
    function zap() {
      if (muted || !ac) return;
      const t = ac.currentTime;
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(300, t);
      o.frequency.exponentialRampToValueAtTime(1400, t + 0.3);
      env(g, t, 0.15, 0.4);
      o.connect(g).connect(ac.destination);
      o.start(t);
      o.stop(t + 0.45);
    }
    function boom() {
      noiseBurst('lowpass', 1200, 80, 0.5, 0.7);
      if (muted || !ac) return;
      const t = ac.currentTime;
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.setValueAtTime(140, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.5);
      env(g, t, 0.4, 0.6);
      o.connect(g).connect(ac.destination);
      o.start(t);
      o.stop(t + 0.65);
    }
    return { ensure, pop, whoosh, zap, boom };
  })();

  function buzz(ms) {
    if (!muted && navigator.vibrate) {
      try { navigator.vibrate(ms); } catch (e) { /* not allowed yet */ }
    }
  }

  // ---------- effects ----------

  function burst(x, y, p) {
    const n = p.type === 'ball' ? 22 : 12;
    for (let i = 0; i < n && particles.length < 500; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (0.6 + Math.random()) * cell * 4;
      particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - cell * 2,
        life: 0,
        max: 0.5 + Math.random() * 0.4,
        size: cell * (0.06 + Math.random() * 0.08),
        color: pieceColor(p),
        star: Math.random() < 0.3,
      });
    }
  }

  function kill(k) {
    const [r, c] = parseKey(k);
    const p = grid[r][c];
    if (!p || p.dying) return;
    p.dying = true;
    p.dieAt = now;
    burst(cx(c), cy(r), p);
    score += 10;
    scoreBumpAt = now;
    blastCount++;
    slosh = Math.min(1.2, slosh + 0.03);
    sfx.pop(blastCount);
  }

  function launchFish(from, to, color, delay) {
    schedule(delay, () => {
      projectiles.push({ from, to, color, t0: now, dur: 450 });
      sfx.whoosh();
    });
  }

  // Turn a blast result from board.js into a timeline of animations.
  function play(res, action) {
    const hitTime = new Map();
    let end = 0;
    const mark = (k, t) => {
      hitTime.set(k, t);
      end = Math.max(end, t);
      schedule(t, () => kill(k));
    };

    // the piece(s) the child touched go first
    const firstAct = res.waves[0][0];
    if (action.kind === 'tap') mark(Board.key(...action.at), 0);
    else if (firstAct.kind === 'fishball') {
      const ballAt = grid[action.a[0]][action.a[1]].type === 'ball' ? action.a : action.b;
      mark(Board.key(...ballAt), 0);
    } else {
      mark(Board.key(...action.a), 0);
      mark(Board.key(...action.b), 0);
    }

    res.waves.forEach((wave, wi) => {
      for (const act of wave) {
        const start = wi === 0 ? 0 : (hitTime.get(Board.key(...act.from)) || 0) + 120;
        const [fr, fc] = act.from;

        if (act.kind === 'fish') {
          act.targets.forEach((t, i) => {
            launchFish(act.from, t, act.color, start + i * 70);
            mark(Board.key(...t), start + i * 70 + 450);
          });
        } else if (act.kind === 'ball') {
          schedule(start, () => {
            beams.push({ from: act.from, targets: act.targets, t0: now, dur: 550 });
            sfx.zap();
            buzz(30);
          });
          act.targets.forEach((t, i) => mark(Board.key(...t), start + 200 + i * 30));
        } else if (act.kind === 'all') {
          schedule(start, () => {
            rings.push({ x: cx(fc), y: cy(fr), t0: now, dur: 900 });
            sfx.boom();
            buzz(120);
            slosh = 1.2;
          });
          act.targets.forEach((t) => {
            const d = Math.hypot(t[0] - fr, t[1] - fc);
            mark(Board.key(...t), start + 80 + d * 55);
          });
        } else if (act.kind === 'fishball') {
          schedule(start, () => {
            beams.push({ from: act.from, targets: act.group, t0: now, dur: 450 });
            sfx.zap();
            buzz(40);
            for (const [r, c] of act.group) grid[r][c].glowUntil = now + 400;
          });
          act.sends.forEach((s, i) => {
            const t0 = start + 400 + i * 40;
            mark(Board.key(...s.from), t0);
            s.targets.forEach((t) => {
              launchFish(s.from, t, act.color, t0);
              mark(Board.key(...t), t0 + 450);
            });
          });
        }
      }
    });

    schedule(end + 260, () => collapse(res));
  }

  function collapse(res) {
    Board.removeCleared(grid, res.cleared);
    Board.applyGravity(grid);
    const added = Board.refill(grid, rng);
    for (const a of added) {
      a.piece.vy = a.dropFrom;
      a.piece.vel = 0;
    }
    falling = true;
    cheer(blastCount);
  }

  function cheer(n) {
    let text = null;
    if (n >= 60) text = 'AMAZING!';
    else if (n >= 25) text = 'Wow!!';
    else if (n >= 14) text = 'Yummy!';
    else if (n >= 8) text = 'Sweet!';
    if (text) texts.push({ text, t0: now, dur: 1100 });
  }

  // ---------- actions ----------

  function act(action) {
    if (busy) return;
    busy = true;
    blastCount = 0;
    if (action.kind === 'swap') {
      swapAnim = { a: action.a, b: action.b, t0: now, dur: 140 };
      schedule(140, () => {
        swapAnim = null;
        run(action);
      });
    } else run(action);
  }

  function run(action) {
    const res = Board.blast(grid, action, rng);
    if (res.cleared.size === 0) {
      busy = false;
      return;
    }
    play(res, action);
  }

  // ---------- input ----------

  let touch = null;
  function cellAt(x, y) {
    const c = Math.floor((x - boardX) / cell);
    const r = Math.floor((y - boardY) / cell);
    return r >= 0 && r < ROWS && c >= 0 && c < COLS ? [r, c] : null;
  }

  function goFullscreen(e) {
    if (e.pointerType !== 'touch' || document.fullscreenElement) return;
    if (window.matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches) return;
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
  }

  function muteHit(x, y) {
    return Math.hypot(x - (W - 34), y - (scoreH / 2 + 6)) < 28;
  }

  canvas.addEventListener('pointerdown', (e) => {
    sfx.ensure();
    goFullscreen(e);
    if (muteHit(e.clientX, e.clientY)) {
      muted = !muted;
      return;
    }
    if (touch) return; // one finger at a time
    const at = cellAt(e.clientX, e.clientY);
    if (!at) return;
    touch = { id: e.pointerId, at, x: e.clientX, y: e.clientY, used: false };
    pressed = busy ? null : at;
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!touch || touch.id !== e.pointerId || touch.used) return;
    const dx = e.clientX - touch.x, dy = e.clientY - touch.y;
    if (Math.hypot(dx, dy) < Math.max(18, cell * 0.3)) return;
    touch.used = true;
    pressed = null;
    const [r, c] = touch.at;
    const b = Math.abs(dx) > Math.abs(dy) ? [r, c + Math.sign(dx)] : [r + Math.sign(dy), c];
    if (b[0] >= 0 && b[0] < ROWS && b[1] >= 0 && b[1] < COLS) act({ kind: 'swap', a: touch.at, b });
  });

  function endTouch(e) {
    if (!touch || touch.id !== e.pointerId) return;
    if (!touch.used && e.type === 'pointerup') act({ kind: 'tap', at: touch.at });
    touch = null;
    pressed = null;
  }
  canvas.addEventListener('pointerup', endTouch);
  canvas.addEventListener('pointercancel', endTouch);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // ---------- update ----------

  function update(dt) {
    events.sort((a, b) => a.at - b.at);
    while (events.length && events[0].at <= now) events.shift().fn();

    if (falling) {
      let moving = false;
      for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++) {
          const p = grid[r][c];
          if (p.vy === undefined) p.vy = r;
          if (p.vy < r) {
            p.vel = (p.vel || 2) + 55 * dt;
            p.vy = Math.min(r, p.vy + p.vel * dt);
            if (p.vy === r) {
              p.vel = 0;
              p.landAt = now;
            }
            moving = true;
          }
        }
      if (!moving) {
        falling = false;
        busy = false;
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const q = particles[i];
      q.life += dt;
      q.vy += cell * 9 * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      if (q.life > q.max) particles.splice(i, 1);
    }

    // bubbles rise from the sand to the surface
    if (bubbles.length < 14 && Math.random() < dt * 3) {
      bubbles.push({ x: tank.x + (0.1 + Math.random() * 0.8) * tank.w, y: tank.sand, r: 2 + Math.random() * 4, sp: 25 + Math.random() * 35, ph: Math.random() * 6 });
    }
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      b.y -= b.sp * dt;
      if (b.y < tank.surface + 4) bubbles.splice(i, 1);
    }
    slosh *= Math.exp(-dt * 1.4);

    shownScore += Math.ceil((score - shownScore) * Math.min(1, dt * 8));
  }

  // ---------- draw ----------

  // the water inside the tank, below the surface line
  function clipWater() {
    pathRound(ctx, tank.x, tank.y, tank.w, tank.h, 0.35 * cell);
    ctx.clip();
    ctx.beginPath();
    ctx.rect(tank.x, tank.surface, tank.w, tank.h);
    ctx.clip();
  }

  function waveY(x, t) {
    const a = cell * (reducedMotion ? 0.03 : 0.035 + slosh * 0.16);
    return tank.surface + a * Math.sin(x / cell * 1.6 + t * 2.6) + a * 0.5 * Math.sin(x / cell * 3.1 - t * 3.9);
  }

  // drifting light from the surface; the tank's one bit of ambient motion
  function drawLight() {
    const t = reducedMotion ? 0 : now / 1000;
    ctx.save();
    clipWater();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const x = tank.x + tank.w * (0.15 + i * 0.24) + Math.sin(t * 0.4 + i * 1.7) * cell * 0.6;
      ctx.beginPath();
      ctx.moveTo(x - cell * 0.35, tank.surface);
      ctx.lineTo(x + cell * 0.35, tank.surface);
      ctx.lineTo(x + cell * 1.4, tank.sand);
      ctx.lineTo(x + cell * 0.2, tank.sand);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255,255,255,0.045)';
      ctx.fill();
    }
    for (let i = 0; i < 6; i++) {
      const x = tank.x + tank.w * (0.5 + 0.42 * Math.sin(t * 0.23 + i * 2.1));
      const y = tank.surface + (tank.sand - tank.surface) * (0.5 + 0.45 * Math.cos(t * 0.17 + i * 1.3));
      const rad = cell * (1.6 + (i % 3) * 0.5);
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, 'rgba(255,255,255,0.08)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    ctx.restore();
  }

  // wavy water surface and the glass in front of everything in the tank
  function drawGlass() {
    const t = reducedMotion ? 0 : now / 1000;
    ctx.save();
    pathRound(ctx, tank.x, tank.y, tank.w, tank.h, 0.35 * cell);
    ctx.clip();
    ctx.beginPath();
    ctx.moveTo(tank.x, tank.y);
    for (let x = 0; x <= tank.w; x += 6) ctx.lineTo(tank.x + x, waveY(x, t));
    ctx.lineTo(tank.x + tank.w, tank.y);
    ctx.closePath();
    ctx.fillStyle = THEME.air;
    ctx.fill();
    ctx.beginPath();
    for (let x = 0; x <= tank.w; x += 6) ctx.lineTo(tank.x + x, waveY(x, t));
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = Math.max(2, cell * 0.06);
    ctx.stroke();

    // glare stripe down the left of the glass
    ctx.beginPath();
    ctx.moveTo(tank.x + cell * 0.35, tank.y);
    ctx.lineTo(tank.x + cell * 0.7, tank.y);
    ctx.lineTo(tank.x + cell * 0.45, tank.y + tank.h);
    ctx.lineTo(tank.x + cell * 0.1, tank.y + tank.h);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fill();
    ctx.restore();

    pathRound(ctx, tank.x, tank.y, tank.w, tank.h, 0.35 * cell);
    ctx.strokeStyle = THEME.glass;
    ctx.lineWidth = Math.max(4, cell * 0.14);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(22,40,90,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // rim along the top
    pathRound(ctx, tank.x - cell * 0.08, tank.y - cell * 0.08, tank.w + cell * 0.16, cell * 0.2, cell * 0.1);
    ctx.fillStyle = THEME.ink;
    ctx.fill();
  }

  function drawSprite(p, x, y, scale, rot) {
    const img = p.type === 'fish' ? fishSprites[p.color] : ballSprite;
    const s = cell * scale;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.drawImage(img, -s / 2, -s / 2, s, s);
    ctx.restore();
  }

  function drawBoard() {
    ctx.save();
    clipWater();

    const t = reducedMotion ? 0 : now / 1000;
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const p = grid[r][c];
        if (!p) continue;
        let scale = 0.9, rot = 0;
        let x = cx(c), y = boardY + ((p.vy ?? r) + 0.5) * cell;

        if (p.type === 'fish') rot = FISH_TILT + Math.sin(t * 2.2 + r * 0.7 + c * 1.3) * 0.08;
        else rot = t * 0.6 + r + c;

        if (p.dying) {
          const k = (now - p.dieAt) / 200;
          if (k >= 1) continue;
          scale *= 1 + k * 0.4;
          ctx.globalAlpha = 1 - k;
        }
        if (pressed && pressed[0] === r && pressed[1] === c) scale *= 0.85;
        if (p.landAt && now - p.landAt < 160) scale *= 1 - Math.sin(((now - p.landAt) / 160) * Math.PI) * 0.08;
        if (swapAnim) {
          const k = easeInOut(Math.min(1, (now - swapAnim.t0) / swapAnim.dur)) * 0.5;
          const { a, b } = swapAnim;
          if (a[0] === r && a[1] === c) { x += (b[1] - a[1]) * cell * k; y += (b[0] - a[0]) * cell * k; }
          if (b[0] === r && b[1] === c) { x += (a[1] - b[1]) * cell * k; y += (a[0] - b[0]) * cell * k; }
        }
        if (p.glowUntil && now < p.glowUntil) {
          const g = ctx.createRadialGradient(x, y, 0, x, y, cell * 0.7);
          g.addColorStop(0, 'rgba(255,255,255,0.9)');
          g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = g;
          ctx.fillRect(x - cell, y - cell, cell * 2, cell * 2);
          scale *= 1.1 + Math.sin(now / 40) * 0.08;
        }
        drawSprite(p, x, y, scale, rot);
        ctx.globalAlpha = 1;
      }
    ctx.restore();
  }

  function drawBeams() {
    for (let i = beams.length - 1; i >= 0; i--) {
      const b = beams[i];
      const k = (now - b.t0) / b.dur;
      if (k >= 1) { beams.splice(i, 1); continue; }
      const x0 = cx(b.from[1]), y0 = cy(b.from[0]);
      ctx.save();
      ctx.globalAlpha = 1 - k;
      ctx.lineCap = 'round';
      b.targets.forEach(([r, c], j) => {
        const x1 = cx(c), y1 = cy(r);
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        const steps = 6;
        for (let s = 1; s < steps; s++) {
          const u = s / steps;
          const jit = (Math.random() - 0.5) * cell * 0.35;
          ctx.lineTo(x0 + (x1 - x0) * u + jit, y0 + (y1 - y0) * u + jit);
        }
        ctx.lineTo(x1, y1);
        ctx.strokeStyle = SPRINKLES[j % SPRINKLES.length];
        ctx.lineWidth = cell * 0.12;
        ctx.stroke();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = cell * 0.04;
        ctx.stroke();
      });
      ctx.restore();
    }
  }

  function drawProjectiles() {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const f = projectiles[i];
      const k = (now - f.t0) / f.dur;
      if (k >= 1) { projectiles.splice(i, 1); continue; }
      const u = easeInOut(k);
      const x0 = cx(f.from[1]), y0 = cy(f.from[0]), x1 = cx(f.to[1]), y1 = cy(f.to[0]);
      const arc = cell * 1.4;
      const x = x0 + (x1 - x0) * u;
      const y = y0 + (y1 - y0) * u - Math.sin(Math.PI * u) * arc;
      const dx = x1 - x0, dy = y1 - y0 - Math.cos(Math.PI * u) * Math.PI * arc;
      const rot = Math.atan2(dy, dx) + Math.PI;
      // bubble trail
      if (Math.random() < 0.6 && particles.length < 500)
        particles.push({ x, y, vx: 0, vy: -cell, life: 0, max: 0.4, size: cell * 0.06, color: 'rgba(255,255,255,0.8)', star: false });
      drawSprite({ type: 'fish', color: f.color }, x, y, 1.05, rot);
    }
  }

  function drawParticles() {
    for (const q of particles) {
      ctx.globalAlpha = Math.max(0, 1 - q.life / q.max);
      ctx.fillStyle = q.color;
      if (q.star) {
        ctx.save();
        ctx.translate(q.x, q.y);
        ctx.rotate(q.life * 8);
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const rr = i % 2 ? q.size * 0.5 : q.size * 1.4;
          const a = (i * Math.PI) / 5;
          ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(q.x, q.y, q.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawRings() {
    for (let i = rings.length - 1; i >= 0; i--) {
      const g = rings[i];
      const k = (now - g.t0) / g.dur;
      if (k >= 1) { rings.splice(i, 1); continue; }
      ctx.save();
      clipWater();
      if (!reducedMotion) {
        ctx.globalAlpha = (1 - k) * 0.35;
        ctx.fillStyle = '#fff';
        ctx.fillRect(tank.x, tank.y, tank.w, tank.h);
      }
      ctx.globalAlpha = 1 - k;
      ctx.beginPath();
      ctx.arc(g.x, g.y, k * tank.h, 0, Math.PI * 2);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = cell * 0.4 * (1 - k) + 2;
      ctx.stroke();
      ctx.restore();
    }
  }

  // Sticker-style lettering: ink drop shadow, ink outline, white face.
  function sticker(text, x, y, fs, shadow) {
    ctx.font = `${fs}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = fs * 0.16;
    ctx.fillStyle = shadow;
    ctx.strokeStyle = shadow;
    ctx.strokeText(text, x + fs * 0.04, y + fs * 0.07);
    ctx.fillText(text, x + fs * 0.04, y + fs * 0.07);
    ctx.strokeStyle = THEME.ink;
    ctx.strokeText(text, x, y);
    ctx.fillStyle = '#fff';
    ctx.fillText(text, x, y);
  }

  function drawScore() {
    const k = Math.min(1, (now - scoreBumpAt) / 160);
    const bump = reducedMotion ? 1 : 1 + 0.1 * (1 - k);
    const my = scoreH / 2 + 6;
    ctx.save();
    // score sits centred in the wall space above the tank
    ctx.translate(W / 2, Math.max(my, tank.y / 2));
    ctx.scale(bump, bump);
    sticker(String(shownScore), 0, 0, Math.round(scoreH * 0.6), THEME.ink);
    ctx.restore();

    // mute button: a speaker drawn with paths so it looks the same on every phone
    const mx = W - 34;
    ctx.save();
    ctx.beginPath();
    ctx.arc(mx, my, 20, 0, Math.PI * 2);
    ctx.fillStyle = THEME.gum;
    ctx.fill();
    ctx.strokeStyle = THEME.ink;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(mx - 9, my - 4);
    ctx.lineTo(mx - 4, my - 4);
    ctx.lineTo(mx + 2, my - 9);
    ctx.lineTo(mx + 2, my + 9);
    ctx.lineTo(mx - 4, my + 4);
    ctx.lineTo(mx - 9, my + 4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (muted) {
      ctx.moveTo(mx + 5, my - 5); ctx.lineTo(mx + 12, my + 5);
      ctx.moveTo(mx + 12, my - 5); ctx.lineTo(mx + 5, my + 5);
    } else {
      ctx.arc(mx + 3, my, 6, -0.9, 0.9);
      ctx.moveTo(mx + 3 + 11 * Math.cos(-0.9), my + 11 * Math.sin(-0.9));
      ctx.arc(mx + 3, my, 11, -0.9, 0.9);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawTexts() {
    for (let i = texts.length - 1; i >= 0; i--) {
      const t = texts[i];
      const k = (now - t.t0) / t.dur;
      if (k >= 1) { texts.splice(i, 1); continue; }
      const pop = reducedMotion ? 1 : k < 0.2 ? easeInOut(k / 0.2) * 1.15 : 1.15 - Math.min(0.15, (k - 0.2) * 0.5);
      const fs = Math.min(W / 5, cell * 1.6);
      ctx.save();
      ctx.globalAlpha = k > 0.75 ? (1 - k) / 0.25 : 1;
      ctx.translate(W / 2, boardY + cell * ROWS * 0.45 - (reducedMotion ? 0 : k * cell));
      ctx.scale(pop, pop);
      ctx.rotate(-0.06);
      sticker(t.text, 0, 0, fs, THEME.gum);
      ctx.restore();
    }
  }

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(bgCanvas, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    drawLight();
    ctx.save();
    clipWater();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.5;
    for (const b of bubbles) {
      ctx.beginPath();
      ctx.arc(b.x + (reducedMotion ? 0 : Math.sin(now / 500 + b.ph) * 5), b.y, b.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    drawBoard();
    drawRings();
    drawGlass();
    drawBeams();
    drawProjectiles();
    drawParticles();
    drawScore();
    drawTexts();
  }

  function frame(ts) {
    now = ts;
    const dt = Math.min(0.05, (ts - (last || ts)) / 1000);
    last = ts;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  // pieces drop in from above at the start
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      grid[r][c].vy = r - ROWS - 1 - Math.random() * 0.5;
      grid[r][c].vel = 0;
    }

  window.addEventListener('resize', resize);
  resize();
  if (document.fonts) document.fonts.load(`40px ${FONT}`).catch(() => {});
  requestAnimationFrame(frame);
})();
