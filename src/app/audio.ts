/* Web Audio sound for the ear-training app: a harmonic complex tone (richer and easier to hear
   than a pure tone) and a tanpura-like drone. Kept out of the logic module so the logic can be
   tested without a browser audio context. */
type WindowWithWebkit = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private drone: OscillatorNode[] | null = null;
  getVol: () => number = () => 0.3;

  private ac(): AudioContext {
    if (!this.ctx) { const W = window as WindowWithWebkit; this.ctx = new (window.AudioContext || W.webkitAudioContext!)(); }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  /** A note built from six harmonics, with a gentle attack and release. */
  tone(freq: number, when = 0, dur = 0.8): void {
    const c = this.ac(), t0 = c.currentTime + when, g = c.createGain(), v = this.getVol();
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(v, t0 + 0.03);
    g.gain.setValueAtTime(v, t0 + dur - 0.12); g.gain.linearRampToValueAtTime(0, t0 + dur);
    g.connect(c.destination);
    for (let h = 1; h <= 6; h++) {
      const o = c.createOscillator(), hg = c.createGain();
      o.frequency.value = freq * h; hg.gain.value = 0.5 / h;
      o.connect(hg).connect(g); o.start(t0); o.stop(t0 + dur + 0.05);
    }
  }

  droneOn(): boolean {
    return this.drone !== null;
  }
  toggleDrone(sa: number): boolean {
    if (this.drone) { this.drone.forEach(n => { try { n.stop(); } catch { /* ignore */ } }); this.drone = null; return false; }
    const c = this.ac(), g = c.createGain(); g.gain.value = this.getVol() * 0.35; g.connect(c.destination); this.drone = [];
    [sa / 2, sa * 3 / 4, sa / 2 * 1.003].forEach(f => {
      const o = c.createOscillator(); o.type = "sawtooth"; o.frequency.value = f;
      const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 900;
      o.connect(lp).connect(g); o.start(); this.drone!.push(o);
    });
    return true;
  }
  restartDroneIfOn(sa: number): void { if (this.drone) { this.toggleDrone(sa); this.toggleDrone(sa); } }
}
