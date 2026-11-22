/* Carnatic Ear Training: play swaras over a drone, practise "higher or lower" on an adaptive
   staircase, and "name the swara", with progress charts. For hearing-aid and CI users. On-device. */
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Music2, Play, Repeat } from "lucide-react";
import { AppShell } from "@/shell/AppShell";
import { Button, Callout, Field, Panel, Segmented, Select, cx } from "@/shell/ui";
import { LineChart } from "@/shell/LineChart";
import { References } from "@/shell/References";
import { usePersistent } from "@/shell/storage";
import { downloadCSV, todayISO } from "@/shell/lib";
import { AudioEngine } from "./audio";
import { NAME_LEVELS, SRUTI, SWARAS, dirSecond, newDir, scoreDir, scoreName, type DirState, type LogEntry, type NameState } from "./music";
import refs from "./refs.json";

export default function App() {
  const { t } = useTranslation();
  const engineRef = useRef<AudioEngine | null>(null);
  const engine = () => (engineRef.current ??= new AudioEngine());
  const [log, setLog] = usePersistent<LogEntry[]>("cet-log", []);
  const [sruti, setSruti] = usePersistent<number>("cet-sruti", 138.59);
  const [vol, setVol] = useState(0.3);
  const [droneOn, setDroneOn] = useState(false);
  const [ex, setEx] = useState<"dir" | "name">("dir");
  const [dir, setDir] = useState<DirState | null>(null);
  const [name, setName] = useState<NameState | null>(null);
  const [nameLevel, setNameLevel] = useState(0);
  const [fb, setFb] = useState<{ text: string; ok: boolean } | null>(null);

  // keep the engine's volume getter current
  engine().getVol = () => vol;
  const sa = sruti;

  const playKey = (ratio: number) => engine().tone(sa * ratio);
  const toggleDrone = () => { setDroneOn(engine().toggleDrone(sa)); };
  const changeSruti = (v: number) => { setSruti(v); engine().restartDroneIfOn(v); };

  // higher-or-lower
  const startDir = () => { const d = { ...newDir() }; setDir(d); setFb(null); setTimeout(() => playSeq(sa, dirSecond(sa, d)), 60); };
  const playSeq = (a: number, b: number) => { engine().tone(a, 0); engine().tone(b, 1.0); };
  const answerDir = (saidUp: boolean) => {
    if (!dir || dir.done) return;
    const { state, ok } = scoreDir(dir, saidUp);
    setDir(state);
    if (state.done) {
      const th = state.threshold!;
      setFb({ text: `Finished. You can hear pitch steps of about ${th} cents (${(th / 100).toFixed(1)} semitones).`, ok: true });
      setLog(l => [...l, { date: todayISO(), ex: "dir", threshold: th, trials: state.trials }]);
    } else {
      setFb({ text: ok ? "Correct" : `Not quite: it went ${dir.up ? "higher" : "lower"}`, ok });
      setTimeout(() => { setDir(s => { if (!s) return s; const fresh = { ...s, up: Math.random() < 0.5 }; setTimeout(() => playSeq(sa, dirSecond(sa, fresh)), 40); return fresh; }); }, 900);
    }
  };

  // name the swara
  const pickSwara = (level: number): number => { const set = NAME_LEVELS[level][1]; return set[Math.floor(Math.random() * set.length)]; };
  const startName = () => { const s: NameState = { level: nameLevel, n: 0, correct: 0, cur: pickSwara(nameLevel), done: false }; setName(s); setFb(null); setTimeout(() => playSeq(sa, sa * SWARAS[s.cur][1]), 60); };
  const answerName = (pick: number) => {
    if (!name || name.done) return;
    const { state, ok, pct } = scoreName(name, pick);
    if (state.done) {
      setName(state);
      setFb({ text: `Finished: ${state.correct} of 10 correct.${pct! >= 80 && name.level < 2 ? " Try the next level." : ""}`, ok: true });
      setLog(l => [...l, { date: todayISO(), ex: "name", level: name.level, pct: pct! }]);
    } else {
      setFb({ text: ok ? "Correct" : `That was ${SWARAS[name.cur][0]}`, ok });
      setTimeout(() => { const cur = pickSwara(name.level); setName({ ...state, cur }); setTimeout(() => playSeq(sa, sa * SWARAS[cur][1]), 40); }, 1100);
    }
  };

  const dirLog = useMemo(() => log.filter(x => x.ex === "dir"), [log]);
  const nameLog = useMemo(() => log.filter(x => x.ex === "name"), [log]);
  const csv = () => downloadCSV([["date", "exercise", "result", "detail"], ...log.map(x => x.ex === "dir" ? [x.date, "Higher or lower", `${x.threshold} cents`, `${x.trials} trials`] : [x.date, "Name the swara", `${x.pct}%`, NAME_LEVELS[x.level!][0]])], `carnatic-ear-training-${todayISO()}.csv`);

  return (
    <AppShell title={t("appName")} subtitle={t("appSub")} footer={<p className="m-0">{t("disclaimer")}</p>}>
      <div className="mx-auto grid max-w-2xl gap-5">
        <Panel title="Set up the sound">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Sruti (pitch of Sa)" className="mt-0">{id => <Select id={id} value={sruti} onChange={e => changeSruti(Number(e.target.value))}>{SRUTI.map(([l, f]) => <option key={f} value={f}>{l}</option>)}</Select>}</Field>
            <Field label={`Volume`} className="mt-0">{id => <input id={id} type="range" min={0.05} max={0.6} step={0.05} value={vol} onChange={e => setVol(Number(e.target.value))} className="h-11 w-full accent-[var(--color-accent)]" />}</Field>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button variant={droneOn ? "primary" : "ghost"} onClick={toggleDrone}><Music2 className="h-4 w-4" aria-hidden />{droneOn ? "Stop drone" : "Start drone (Sa–Pa)"}</Button>
          </div>
          <div className="mt-3">
            <p className="m-0 mb-1.5 text-[0.85rem] text-muted">Tap a swara to hear it:</p>
            <div className="flex flex-wrap gap-2">{SWARAS.map(([s, r], i) => (
              <button key={i} type="button" onClick={() => playKey(r)} className="min-h-11 min-w-12 rounded-md border border-line bg-paper px-3 font-semibold hover:bg-surface active:bg-ink active:text-paper">{s}</button>))}</div>
          </div>
        </Panel>

        <Panel title="Exercise">
          <Segmented label="Exercise" value={ex} onChange={v => { setEx(v); setFb(null); }} options={[{ value: "dir", label: "Higher or lower" }, { value: "name", label: "Name the swara" }]} />

          {ex === "dir" ? (
            <div className="mt-4">
              <p className="m-0 text-[0.95rem] text-muted">You hear Sa, then a second note. Is the second note higher or lower? The step gets smaller as you get it right, and bigger when you miss.</p>
              {!dir ? <div className="mt-3"><Button variant="primary" onClick={startDir}><Play className="h-4 w-4" aria-hidden />Start</Button></div> : (
                <>
                  <div className="mt-3 flex items-center gap-3">
                    <Button onClick={() => playSeq(sa, dirSecond(sa, dir))}><Repeat className="h-4 w-4" aria-hidden />Play again</Button>
                    <span className="text-[0.82rem] text-muted">Trial {dir.trials + (dir.done ? 0 : 1)} · step {Math.round(dir.step)} cents · {dir.reversals.length} of 8 reversals</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button variant="primary" disabled={dir.done} onClick={() => answerDir(true)}>Higher ↑</Button>
                    <Button variant="primary" disabled={dir.done} onClick={() => answerDir(false)}>Lower ↓</Button>
                  </div>
                  {dir.done && <div className="mt-3"><Button onClick={startDir}>Start again</Button></div>}
                </>
              )}
            </div>
          ) : (
            <div className="mt-4">
              <p className="m-0 text-[0.95rem] text-muted">You hear Sa, then another swara. Which one was it?</p>
              <Field label="Level">{id => <Select id={id} value={nameLevel} onChange={e => { setNameLevel(Number(e.target.value)); setName(null); setFb(null); }}>{NAME_LEVELS.map((l, i) => <option key={i} value={i}>{l[0]}</option>)}</Select>}</Field>
              {!name ? <div className="mt-3"><Button variant="primary" onClick={startName}><Play className="h-4 w-4" aria-hidden />Start</Button></div> : (
                <>
                  <div className="mt-3 flex items-center gap-3">
                    <Button onClick={() => playSeq(sa, sa * SWARAS[name.cur][1])}><Repeat className="h-4 w-4" aria-hidden />Play again</Button>
                    <span className="text-[0.82rem] text-muted">Question {Math.min(name.n + 1, 10)} of 10 · {name.correct} correct</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">{NAME_LEVELS[name.level][1].map(i => (
                    <Button key={i} variant="primary" disabled={name.done} onClick={() => answerName(i)}>{SWARAS[i][0]}</Button>))}</div>
                  {name.done && <div className="mt-3"><Button onClick={startName}>Start again</Button></div>}
                </>
              )}
            </div>
          )}

          {fb && <div role="status" aria-live="polite" className={cx("mt-3 rounded-md px-3 py-2 font-semibold", fb.ok ? "bg-ok/12 text-ok" : "bg-mid/15 text-mid")}>{fb.text}</div>}
        </Panel>

        <Panel title="Progress" action={log.length ? <Button size="sm" onClick={csv}>CSV</Button> : undefined}>
          <h3 className="m-0 text-base font-bold">Smallest pitch step you can hear (cents, lower is better)</h3>
          {dirLog.length ? <LineChart yMin={0} yLabel="cents" series={[{ label: "Threshold", color: "var(--color-accent)", points: dirLog.map((x, i) => ({ x: i + 1, y: x.threshold! })) }]} />
            : <p className="m-0 text-[0.9rem] text-muted">Complete a “Higher or lower” round to see this.</p>}
          <h3 className="mb-0 mt-5 text-base font-bold">Name the swara (% correct)</h3>
          {nameLog.length ? <LineChart yMin={0} yMax={100} yLabel="% correct" series={[{ label: "% correct", color: "var(--color-ok)", points: nameLog.map((x, i) => ({ x: i + 1, y: x.pct! })) }]} />
            : <p className="m-0 text-[0.9rem] text-muted">Complete a “Name the swara” round to see this.</p>}
        </Panel>

        <Callout tone="info">Pitch comes through differently with each device. If a sound is unclear or uncomfortable, tell your audiologist — the implant or aid settings can often be adjusted.</Callout>
        <References refs={refs} contextQuery={ex === "dir" ? "adaptive staircase pitch discrimination cents" : "name swara cochlear implant pitch training"} contextLabel="About this practice" />
      </div>
    </AppShell>
  );
}
