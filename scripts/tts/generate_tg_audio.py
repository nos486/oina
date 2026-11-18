"""
Placeholder Tajik audio from Meta's MMS TTS model (facebook/mms-tts-tgk, CC-BY-NC-4.0;
fine for Oina because the app is free and non-commercial).

    python -m venv .venv && . .venv/bin/activate
    pip install torch transformers numpy
    python scripts/tts/generate_tg_audio.py            # only files that are missing
    python scripts/tts/generate_tg_audio.py --force    # regenerate everything
    pnpm audio:list                                    # refresh content/audio-manifest.json

Needs ffmpeg on PATH. Output: apps/web/public/audio/tg/..., mp3, mono, 64 kbps,
silence trimmed at both ends. Replace any file with a real recording at the same path.
"""
import argparse, json, subprocess, sys
from pathlib import Path

import numpy as np
import torch
from transformers import AutoTokenizer, VitsModel

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "apps/web/public/audio"

# Tajik letter names (what a teacher says when naming the letter). Review with a speaker.
NAMES = {
    "a": "а", "b": "бе", "v": "ве", "g": "ге", "gh": "ғе", "d": "де", "ye": "е", "yo": "ё",
    "zh": "же", "z": "зе", "i": "и", "ii": "ӣ", "y": "йе", "k": "ке", "q": "қе", "l": "эл",
    "m": "эм", "n": "эн", "o": "о", "p": "пе", "r": "эр", "s": "эс", "t": "те", "u": "у",
    "uu": "ӯ", "f": "эф", "kh": "хе", "h": "ҳе", "ch": "че", "j": "ҷе", "sh": "ше",
    "hard": "аломати ҷудоӣ", "e": "э", "yu": "ю", "ya": "я",
}
# The pure sound. A lone letter often comes out silent (MMS uses the id of "о" as its blank, so a
# bare "о" is silence), so short texts are tried as "xъ", "xxъ" and "x" and the most audible wins.
SOUNDS = {"hard": "аъ"}


def candidates(text: str) -> list[str]:
    if len(text) > 1:
        return [text]
    return [text + "ъ", text * 2 + "ъ", text]


def audible_seconds(wave: np.ndarray) -> float:
    frames = wave[: len(wave) // 320 * 320].reshape(-1, 320)
    db = 20 * np.log10(np.sqrt((frames**2).mean(1)) + 1e-9)
    return float((db > -45).sum() * 0.02)


def best(model, tok, text: str) -> np.ndarray:
    return max((synth(model, tok, c) for c in candidates(text)), key=audible_seconds)


def synth(model, tok, text: str, seed: int = 1) -> np.ndarray:
    torch.manual_seed(seed)
    inputs = tok(text.lower(), return_tensors="pt")
    with torch.no_grad():
        return model(**inputs).waveform[0].numpy()


def to_mp3(wave: np.ndarray, sr: int, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    pcm = (np.clip(wave, -1, 1) * 32767).astype("<i2").tobytes()
    trim = "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.03"
    af = f"{trim},areverse,{trim},areverse,loudnorm=I=-16:TP=-1.5:LRA=11"
    subprocess.run(
        ["ffmpeg", "-loglevel", "error", "-y", "-f", "s16le", "-ar", str(sr), "-ac", "1", "-i", "-",
         "-af", af, "-ar", "22050", "-ac", "1", "-c:a", "libmp3lame", "-b:a", "64k", str(dest)],
        input=pcm, check=True,
    )


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    letters = json.loads((ROOT / "content/letters.json").read_text("utf-8"))
    words = json.loads((ROOT / "content/words.json").read_text("utf-8"))
    jobs: list[tuple[str, str]] = []
    for l in letters:
        if "tg" not in l["tracks"]:
            continue
        jobs.append((f"tg/letters/{l['id']}-name.mp3", NAMES[l["id"]]))
        jobs.append((f"tg/letters/{l['id']}-sound.mp3", SOUNDS.get(l["id"], l["lower"])))
    for w in words:
        if w["lang"] == "tg":
            jobs.append((f"tg/words/{w['id']}.mp3", w["cyrillic"]))

    todo = [j for j in jobs if args.force or not (OUT / j[0]).exists()]
    print(f"{len(jobs)} files expected, {len(todo)} to generate")
    if not todo:
        return
    tok = AutoTokenizer.from_pretrained("facebook/mms-tts-tgk")
    model = VitsModel.from_pretrained("facebook/mms-tts-tgk").eval()
    sr = model.config.sampling_rate
    for n, (rel, text) in enumerate(todo, 1):
        to_mp3(best(model, tok, text), sr, OUT / rel)
        print(f"[{n}/{len(todo)}] {rel}  ←  {text}", flush=True)


if __name__ == "__main__":
    sys.exit(main())
