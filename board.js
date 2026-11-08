// Pure game logic: no DOM. Works in the browser (window.Board) and in node (require).
(function (root) {
  const COLORS = 5;
  const BALL_CHANCE = 0.15;

  const key = (r, c) => r + ',' + c;
  const parse = (k) => k.split(',').map(Number);

  // Balls only ever clear fish, so they'd pile up; cap them at ~15% of the board.
  const maxBalls = (g) => Math.round(g.length * g[0].length * BALL_CHANCE);
  const countBalls = (g) => g.reduce((n, row) => n + row.filter((p) => p && p.type === 'ball').length, 0);

  function randomPiece(rng, allowBall = true) {
    if (allowBall && rng() < BALL_CHANCE) return { type: 'ball', color: -1 };
    return { type: 'fish', color: Math.floor(rng() * COLORS) };
  }

  function createBoard(rows, cols, rng) {
    const g = [];
    const max = Math.round(rows * cols * BALL_CHANCE);
    let balls = 0;
    for (let r = 0; r < rows; r++) {
      g.push([]);
      for (let c = 0; c < cols; c++) {
        const p = randomPiece(rng, balls < max);
        if (p.type === 'ball') balls++;
        g[r].push(p);
      }
    }
    return g;
  }

  function adjacent(a, b) {
    return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;
  }

  // Pick up to n random distinct cells that are not yet cleared.
  function pickTargets(g, cleared, n, rng) {
    const pool = [];
    for (let r = 0; r < g.length; r++)
      for (let c = 0; c < g[r].length; c++)
        if (g[r][c] && !cleared.has(key(r, c))) pool.push([r, c]);
    const out = [];
    while (out.length < n && pool.length) {
      const i = Math.floor(rng() * pool.length);
      out.push(pool.splice(i, 1)[0]);
    }
    return out;
  }

  function fishOfColor(g, cleared, color) {
    const out = [];
    for (let r = 0; r < g.length; r++)
      for (let c = 0; c < g[r].length; c++) {
        const p = g[r][c];
        if (p && p.type === 'fish' && p.color === color && !cleared.has(key(r, c))) out.push([r, c]);
      }
    return out;
  }

  function mostCommonColor(g, cleared, rng) {
    const counts = new Array(COLORS).fill(0);
    for (let r = 0; r < g.length; r++)
      for (let c = 0; c < g[r].length; c++) {
        const p = g[r][c];
        if (p && p.type === 'fish' && !cleared.has(key(r, c))) counts[p.color]++;
      }
    const max = Math.max(...counts);
    if (max === 0) return -1;
    const best = counts.map((n, i) => (n === max ? i : -1)).filter((i) => i >= 0);
    return best[Math.floor(rng() * best.length)];
  }

  // Fire one piece at `at`. Mutates `cleared`, returns an activation record.
  function activate(g, at, cleared, rng) {
    const p = g[at[0]][at[1]];
    cleared.add(key(at[0], at[1]));
    if (p.type === 'fish') {
      const targets = pickTargets(g, cleared, 3, rng);
      targets.forEach(([r, c]) => cleared.add(key(r, c)));
      return { kind: 'fish', from: at, color: p.color, targets };
    }
    const color = mostCommonColor(g, cleared, rng);
    const targets = color < 0 ? [] : fishOfColor(g, cleared, color);
    targets.forEach(([r, c]) => cleared.add(key(r, c)));
    return { kind: 'ball', from: at, color, targets };
  }

  // Resolve an action into waves of activations. Balls hit in one wave fire in the next;
  // fish that are hit just pop (otherwise every tap would wipe the board).
  function blast(g, action, rng) {
    const cleared = new Set();
    const waves = [];
    let first = [];

    if (action.kind === 'tap') {
      const [r, c] = action.at;
      if (!g[r] || !g[r][c]) return { waves, cleared };
      first.push(activate(g, action.at, cleared, rng));
    } else {
      const { a, b } = action;
      const pa = g[a[0]] && g[a[0]][a[1]];
      const pb = g[b[0]] && g[b[0]][b[1]];
      if (!pa || !pb || !adjacent(a, b)) return { waves, cleared };
      cleared.add(key(a[0], a[1]));
      cleared.add(key(b[0], b[1]));

      if (pa.type === 'ball' && pb.type === 'ball') {
        const targets = [];
        for (let r = 0; r < g.length; r++)
          for (let c = 0; c < g[r].length; c++)
            if (g[r][c] && !cleared.has(key(r, c))) { targets.push([r, c]); cleared.add(key(r, c)); }
        first.push({ kind: 'all', from: b, targets });
        waves.push(first);
        return { waves, cleared };
      }

      if (pa.type === 'fish' && pb.type === 'fish') {
        const targets = pickTargets(g, cleared, 6, rng);
        targets.forEach(([r, c]) => cleared.add(key(r, c)));
        first.push({ kind: 'fish', from: b, color: pa.color, targets });
      } else {
        const fishAt = pa.type === 'fish' ? a : b;
        const color = g[fishAt[0]][fishAt[1]].color;
        const group = [fishAt, ...fishOfColor(g, cleared, color)];
        group.forEach(([r, c]) => cleared.add(key(r, c)));
        // every fish of that colour swims off to one more target
        const sends = group.map((from) => {
          const t = pickTargets(g, cleared, 1, rng);
          t.forEach(([r, c]) => cleared.add(key(r, c)));
          return { from, targets: t };
        });
        first.push({ kind: 'fishball', from: b, color, group, sends, targets: group });
      }
    }

    waves.push(first);
    // Chain: any ball that got hit fires in the next wave
    let prev = first;
    while (prev.length) {
      const next = [];
      for (const act of prev) {
        const hits = act.kind === 'fishball' ? act.sends.flatMap((s) => s.targets) : act.targets;
        for (const [r, c] of hits) {
          const p = g[r][c];
          if (p && p.type === 'ball' && !p._fired) {
            p._fired = true;
            next.push(activateBall(g, [r, c], cleared, rng));
          }
        }
      }
      if (next.length) waves.push(next);
      prev = next;
    }
    for (const row of g) for (const p of row) if (p) delete p._fired;
    return { waves, cleared };
  }

  function activateBall(g, at, cleared, rng) {
    const color = mostCommonColor(g, cleared, rng);
    const targets = color < 0 ? [] : fishOfColor(g, cleared, color);
    targets.forEach(([r, c]) => cleared.add(key(r, c)));
    return { kind: 'ball', from: at, color, targets };
  }

  function removeCleared(g, cleared) {
    for (const k of cleared) {
      const [r, c] = parse(k);
      g[r][c] = null;
    }
  }

  // Drop pieces down into empty cells. Returns [{from, to}] for animation.
  function applyGravity(g) {
    const moves = [];
    const rows = g.length, cols = g[0].length;
    for (let c = 0; c < cols; c++) {
      let write = rows - 1;
      for (let r = rows - 1; r >= 0; r--) {
        if (g[r][c]) {
          if (r !== write) {
            g[write][c] = g[r][c];
            g[r][c] = null;
            moves.push({ from: [r, c], to: [write, c] });
          }
          write--;
        }
      }
    }
    return moves;
  }

  // Fill empty cells with new pieces. Returns [{at, piece, dropFrom}] where dropFrom is
  // the (negative) row the piece starts falling from.
  function refill(g, rng) {
    const added = [];
    const cols = g[0].length;
    const max = maxBalls(g);
    let balls = countBalls(g);
    for (let c = 0; c < cols; c++) {
      let empty = 0;
      for (let r = 0; r < g.length && !g[r][c]; r++) empty++;
      for (let r = 0; r < empty; r++) {
        const piece = randomPiece(rng, balls < max);
        if (piece.type === 'ball') balls++;
        g[r][c] = piece;
        added.push({ at: [r, c], piece, dropFrom: r - empty });
      }
    }
    return added;
  }

  const Board = { COLORS, createBoard, randomPiece, blast, removeCleared, applyGravity, refill, key };
  if (typeof module !== 'undefined' && module.exports) module.exports = Board;
  else root.Board = Board;
})(this);
