const test = require('node:test');
const assert = require('node:assert');
const Board = require('../board.js');

// Deterministic RNG (mulberry32)
function seeded(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const F = (color) => ({ type: 'fish', color });
const B = () => ({ type: 'ball', color: -1 });

// Build a grid from a compact spec: digits = fish colour, 'B' = ball
function grid(rows) {
  return rows.map((row) => row.split('').map((ch) => (ch === 'B' ? B() : F(Number(ch)))));
}

const key = ([r, c]) => r + ',' + c;

test('createBoard fills every cell with a fish or ball', () => {
  const g = Board.createBoard(9, 8, seeded(1));
  assert.strictEqual(g.length, 9);
  for (const row of g) {
    assert.strictEqual(row.length, 8);
    for (const p of row) {
      assert.ok(p.type === 'fish' || p.type === 'ball');
      if (p.type === 'fish') assert.ok(p.color >= 0 && p.color < Board.COLORS);
    }
  }
});

test('createBoard produces both fish and balls', () => {
  const g = Board.createBoard(9, 8, seeded(2));
  const flat = g.flat();
  assert.ok(flat.some((p) => p.type === 'fish'));
  assert.ok(flat.some((p) => p.type === 'ball'));
});

test('tapping a fish clears itself and 3 other fish targets', () => {
  const g = grid(['000', '111', '222']);
  const res = Board.blast(g, { kind: 'tap', at: [1, 1] }, seeded(3));
  assert.ok(res.cleared.has('1,1'));
  assert.strictEqual(res.cleared.size, 4);
  assert.strictEqual(res.waves[0][0].kind, 'fish');
  assert.strictEqual(res.waves[0][0].targets.length, 3);
});

test('fish that are hit just pop and do not fire', () => {
  const g = grid(['000', '111', '222']);
  const res = Board.blast(g, { kind: 'tap', at: [0, 0] }, seeded(4));
  assert.strictEqual(res.waves.length, 1);
});

test('tapping a ball clears every fish of the most common colour', () => {
  const g = grid(['B11', '112', '203']);
  const res = Board.blast(g, { kind: 'tap', at: [0, 0] }, seeded(5));
  const expected = ['0,0', '0,1', '0,2', '1,0', '1,1'];
  assert.deepStrictEqual([...res.cleared].sort(), expected.sort());
  assert.strictEqual(res.waves[0][0].kind, 'ball');
  assert.strictEqual(res.waves[0][0].color, 1);
});

test('a ball hit by a fish fires too (chain)', () => {
  // Only one other cell besides the ball's colour group, so the fish must hit the ball
  const g = grid(['0B']);
  const res = Board.blast(g, { kind: 'tap', at: [0, 0] }, seeded(6));
  assert.ok(res.cleared.has('0,1'));
  assert.strictEqual(res.waves.length, 2);
  assert.strictEqual(res.waves[1][0].kind, 'ball');
});

test('fish + fish swap sends 6 fish', () => {
  const g = grid(['0000', '1111', '2222', '3333']);
  const res = Board.blast(g, { kind: 'swap', a: [0, 0], b: [0, 1] }, seeded(7));
  assert.ok(res.cleared.has('0,0') && res.cleared.has('0,1'));
  const total = res.waves[0].reduce((n, a) => n + a.targets.length, 0);
  assert.strictEqual(total, 6);
  assert.strictEqual(res.cleared.size, 8);
});

test('fish + ball swap clears all fish of that colour and each sends one more fish', () => {
  const g = grid(['0B1', '0111', '2222'].map((r) => r.slice(0, 3)));
  // grid: 0 B 1 / 0 1 1 / 2 2 2 ; colour 0 fish: (0,0),(1,0)
  const res = Board.blast(g, { kind: 'swap', a: [0, 0], b: [0, 1] }, seeded(8));
  for (const k of ['0,0', '0,1', '1,0']) assert.ok(res.cleared.has(k), k);
  assert.strictEqual(res.waves[0][0].kind, 'fishball');
  // 2 colour-0 fish each send 1 target
  assert.strictEqual(res.cleared.size, 3 + 2);
});

test('ball + ball swap clears the whole board', () => {
  const g = grid(['BB0', '123', '401']);
  const res = Board.blast(g, { kind: 'swap', a: [0, 0], b: [0, 1] }, seeded(9));
  assert.strictEqual(res.cleared.size, 9);
  assert.strictEqual(res.waves[0][0].kind, 'all');
});

test('swap of non-adjacent cells does nothing', () => {
  const g = grid(['000', '111']);
  const res = Board.blast(g, { kind: 'swap', a: [0, 0], b: [1, 2] }, seeded(10));
  assert.strictEqual(res.cleared.size, 0);
});

test('removeCleared + gravity + refill leaves a full board and reports moves', () => {
  const g = grid(['012', '340', '123']);
  Board.removeCleared(g, new Set(['2,0', '1,0']));
  assert.strictEqual(g[2][0], null);
  const moves = Board.applyGravity(g);
  assert.deepStrictEqual(moves, [{ from: [0, 0], to: [2, 0] }]);
  assert.strictEqual(g[2][0].color, 0);
  assert.strictEqual(g[0][0], null);
  const added = Board.refill(g, seeded(11));
  assert.strictEqual(added.length, 2);
  assert.ok(g.flat().every((p) => p !== null));
  // new pieces report how many rows above the board they start
  assert.deepStrictEqual(added.map((a) => a.at).sort(), [[0, 0], [1, 0]].sort());
});

test('refill never lets balls pile up past ~15% of the board', () => {
  const rng = seeded(13);
  const g = Board.createBoard(9, 8, rng);
  for (let i = 0; i < 300; i++) {
    // only ever pop fish, so balls would accumulate without a cap
    const fish = [];
    g.forEach((row, r) => row.forEach((p, c) => { if (p.type === 'fish') fish.push(r + ',' + c); }));
    Board.removeCleared(g, new Set(fish.slice(0, 10)));
    Board.applyGravity(g);
    Board.refill(g, rng);
  }
  const balls = g.flat().filter((p) => p.type === 'ball').length;
  assert.ok(balls <= Math.round(9 * 8 * 0.15), 'balls: ' + balls);
});

test('long random play never leaves the board empty or broken', () => {
  const rng = seeded(12);
  const g = Board.createBoard(9, 8, rng);
  for (let i = 0; i < 2000; i++) {
    const r = Math.floor(rng() * 9), c = Math.floor(rng() * 8);
    const action = rng() < 0.5
      ? { kind: 'tap', at: [r, c] }
      : { kind: 'swap', a: [r, c], b: [r, Math.min(7, c + 1)] };
    const res = Board.blast(g, action, rng);
    Board.removeCleared(g, res.cleared);
    Board.applyGravity(g);
    Board.refill(g, rng);
    assert.ok(g.flat().every((p) => p && (p.type === 'fish' || p.type === 'ball')));
  }
});
