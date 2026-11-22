import { describe, expect, it } from "vitest";
import { newDir, scoreDir, scoreName, thresholdFrom, type DirState, type NameState } from "./music";

const fresh = (): DirState => ({ ...newDir(), up: true, step: 400 });

describe("adaptive staircase (2-down 1-up)", () => {
  it("one wrong answer makes the step bigger", () => {
    const { state, ok } = scoreDir(fresh(), false);   // said lower, note went up -> wrong
    expect(ok).toBe(false);
    expect(state.step).toBeGreaterThan(400);
    expect(state.lastDirn).toBe("up");
  });
  it("two correct answers in a row make the step smaller", () => {
    let s = fresh();
    s = scoreDir(s, true).state;   // correct 1 -> no move yet
    expect(s.step).toBe(400);
    s = scoreDir({ ...s, up: true }, true).state;   // correct 2 -> move down
    expect(s.step).toBeLessThan(400);
    expect(s.lastDirn).toBe("down");
  });
  it("records a reversal when direction changes", () => {
    let s = fresh();
    s = scoreDir(s, false).state;                 // move up (step grows)
    s = scoreDir({ ...s, up: true }, true).state; // correct 1
    s = scoreDir({ ...s, up: true }, true).state; // correct 2 -> move down = reversal
    expect(s.reversals.length).toBe(1);
  });
  it("never steps below 5 or above 1200 cents", () => {
    let s: DirState = { ...fresh(), step: 10 };
    for (let i = 0; i < 6; i++) s = scoreDir({ ...s, up: true }, true).state;
    expect(s.step).toBeGreaterThanOrEqual(5);
    let u: DirState = { ...fresh(), step: 1000 };
    for (let i = 0; i < 6; i++) u = scoreDir({ ...u, up: true }, false).state;
    expect(u.step).toBeLessThanOrEqual(1200);
  });
  it("finishes and reports a threshold after 8 reversals", () => {
    let s = fresh(); let guard = 0;
    while (!s.done && guard++ < 500) { const say = Math.random() < 0.5; s = scoreDir({ ...s, up: Math.random() < 0.5 }, say).state; }
    expect(s.done).toBe(true);
    expect(s.threshold).toBeGreaterThan(0);
  });
});

describe("thresholdFrom", () => {
  it("is the geometric mean of the last reversals", () => expect(thresholdFrom([100, 100, 100], 50)).toBe(100));
  it("falls back to the current step when there are no reversals", () => expect(thresholdFrom([], 37)).toBe(37));
});

describe("name-the-swara round", () => {
  it("ends after ten questions with a percentage", () => {
    let s: NameState = { level: 0, n: 0, correct: 0, cur: 0, done: false };
    let pct: number | null = null;
    for (let i = 0; i < 10; i++) { const r = scoreName({ ...s, cur: 0 }, i < 8 ? 0 : 5); s = r.state; pct = r.pct; }
    expect(s.done).toBe(true); expect(pct).toBe(80);
  });
});
