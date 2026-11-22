/* Pitch ear-training built on Carnatic swaras, for hearing-aid and cochlear-implant users who
   want to practise pitch discrimination. The logic here (adaptive staircase, swara ratios) is
   kept separate from the sound so it can be tested. Content preserved. */

export const SRUTI: [string, number][] = [
  ["C (1 kattai)", 130.81], ["C# (1½)", 138.59], ["D (2)", 146.83], ["D# (2½)", 155.56], ["E (3)", 164.81],
  ["F (4)", 174.61], ["F# (4½)", 185.0], ["G (5)", 196.0], ["G# (5½)", 207.65], ["A (6)", 220.0]
];
export const SWARAS: [string, number][] = [["Sa", 1], ["Ri", 9 / 8], ["Ga", 5 / 4], ["Ma", 4 / 3], ["Pa", 3 / 2], ["Da", 5 / 3], ["Ni", 15 / 8], ["Ṡa", 2]];
export const NAME_LEVELS: [string, number[]][] = [["Easy: Sa, Pa, Ṡa", [0, 4, 7]], ["Medium: Sa, Ga, Pa, Ṡa", [0, 2, 4, 7]], ["Hard: all eight", [0, 1, 2, 3, 4, 5, 6, 7]]];

export const cents = (f: number, c: number): number => f * Math.pow(2, c / 1200);

/** Geometric mean of the last up-to-6 reversal step sizes (the threshold estimate). */
export function thresholdFrom(reversals: number[], fallbackStep: number): number {
  const last = reversals.slice(-6);
  if (!last.length) return Math.round(fallbackStep);
  return Math.round(Math.exp(last.reduce((s, x) => s + Math.log(x), 0) / last.length));
}

export interface DirState { step: number; correctRun: number; lastDirn: "up" | "down" | null; reversals: number[]; trials: number; up: boolean; done: boolean; threshold: number | null }
export const newDir = (): DirState => ({ step: 400, correctRun: 0, lastDirn: null, reversals: [], trials: 0, up: Math.random() < 0.5, done: false, threshold: null });
export const dirSecond = (sa: number, s: DirState): number => cents(sa, (s.up ? 1 : -1) * s.step);

/** 2-down / 1-up adaptive staircase (converges near the 70.7%-correct point). Pure. */
export function scoreDir(s: DirState, saidUp: boolean): { state: DirState; ok: boolean } {
  const ok = saidUp === s.up;
  let { step, correctRun, lastDirn } = s;
  const reversals = [...s.reversals];
  let move: "up" | "down" | null = null;
  if (ok) { correctRun++; if (correctRun === 2) { correctRun = 0; move = "down"; } } else { correctRun = 0; move = "up"; }
  if (move) {
    if (lastDirn && lastDirn !== move) reversals.push(step);
    lastDirn = move;
    step = move === "down" ? Math.max(5, step / 1.41) : Math.min(1200, step * 1.41);
  }
  const trials = s.trials + 1;
  const done = reversals.length >= 8 || trials >= 40;
  const state: DirState = {
    step, correctRun, lastDirn, reversals, trials, up: s.up, done,
    threshold: done ? thresholdFrom(reversals, step) : null
  };
  return { state, ok };
}

export interface NameState { level: number; n: number; correct: number; cur: number; done: boolean }
export function scoreName(s: NameState, pick: number): { state: NameState; ok: boolean; pct: number | null } {
  const ok = pick === s.cur;
  const n = s.n + 1, correct = s.correct + (ok ? 1 : 0), done = n >= 10;
  return { state: { ...s, n, correct, done }, ok, pct: done ? correct * 10 : null };
}

export interface LogEntry { date: string; ex: "dir" | "name"; threshold?: number; trials?: number; level?: number; pct?: number }
