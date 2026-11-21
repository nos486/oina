/** Small feedback effects: a short vibration on phones that support it. The app has no sound. */
function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* not supported */
  }
}

export function fxCorrect() {
  vibrate(15);
}

export function fxWrong() {
  vibrate(80);
}

export function fxFinish() {
  vibrate([30, 60, 30]);
}
