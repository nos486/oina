/** Small feedback effects: tones for right/wrong and a short vibration on Android. */
let ctx: AudioContext | null = null;

function tone(freqs: number[], duration = 0.12) {
  try {
    ctx ??= new AudioContext();
    const t0 = ctx.currentTime;
    freqs.forEach((f, i) => {
      const o = ctx!.createOscillator();
      const g = ctx!.createGain();
      o.frequency.value = f;
      o.type = 'sine';
      g.gain.setValueAtTime(0.0001, t0 + i * duration);
      g.gain.exponentialRampToValueAtTime(0.15, t0 + i * duration + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + (i + 1) * duration);
      o.connect(g).connect(ctx!.destination);
      o.start(t0 + i * duration);
      o.stop(t0 + (i + 1) * duration + 0.02);
    });
  } catch {
    /* audio not available */
  }
}

export function fxCorrect(sound: boolean) {
  if (sound) tone([660, 880]);
}

export function fxWrong(sound: boolean) {
  if (sound) tone([220, 180], 0.15);
  try {
    navigator.vibrate?.(80);
  } catch {
    /* not supported */
  }
}

export function fxFinish(sound: boolean) {
  if (sound) tone([523, 659, 784, 1046], 0.1);
}
