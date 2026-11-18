"""
Tajik word audio from re-skill/orpheus-tj-early (Apache-2.0), checked with speech recognition.

Each word is generated up to --tries times; a clip is kept only if facebook/mms-1b-all (Tajik
adapter) hears exactly the written word. Words that never pass get no file, so the app shows
no sound button for them. Letter sounds are not generated: no model reads isolated letters well.

    python -m venv .venv && . .venv/bin/activate
    pip install torch transformers snac numpy
    python scripts/tts/orpheus_tg.py            # words without a file yet
    pnpm audio:list                             # refresh content/audio-manifest.json

Needs ffmpeg, ~16 GB RAM and ~20 GB disk for the models. About 15-60 s per word on a 4-core CPU.
"""
import argparse, json, os, subprocess, sys, time
from pathlib import Path

import numpy as np, torch
from snac import SNAC
from transformers import AutoModelForCausalLM, AutoProcessor, AutoTokenizer, Wav2Vec2ForCTC

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "apps/web/public/audio"
M = "re-skill/orpheus-tj-early"
tok = AutoTokenizer.from_pretrained(M)
model = AutoModelForCausalLM.from_pretrained(M, dtype=torch.bfloat16).eval()
snac = SNAC.from_pretrained("hubertsiuzdak/snac_24khz").eval()
proc = AutoProcessor.from_pretrained("facebook/mms-1b-all", target_lang="tgk")
asr = Wav2Vec2ForCTC.from_pretrained("facebook/mms-1b-all", target_lang="tgk", ignore_mismatched_sizes=True).eval()

def decode(codes):
    codes = [c - 128266 for c in codes]
    codes = codes[: len(codes) // 7 * 7]
    l1, l2, l3 = [], [], []
    for i in range(len(codes) // 7):
        c = codes[7 * i: 7 * i + 7]
        l1.append(c[0]); l2.append(c[1] - 4096); l3 += [c[2] - 8192, c[3] - 12288]
        l2.append(c[4] - 16384); l3 += [c[5] - 20480, c[6] - 24576]
    if not l1 or min(l1 + l2 + l3) < 0 or max(l1 + l2 + l3) > 4095:
        return None
    with torch.no_grad():
        return snac.decode([torch.tensor(x).unsqueeze(0) for x in (l1, l2, l3)])[0, 0].numpy()

def tts(text):
    ids = tok(text, return_tensors="pt").input_ids
    ids = torch.cat([torch.tensor([[128259]]), ids, torch.tensor([[128009, 128260]])], 1)
    with torch.no_grad():
        g = model.generate(ids, attention_mask=torch.ones_like(ids), max_new_tokens=500, do_sample=True,
                           temperature=0.6, top_p=0.95, repetition_penalty=1.1, eos_token_id=128258)
    new = g[0, ids.shape[1]:].tolist()
    if 128257 in new:
        new = new[len(new) - new[::-1].index(128257):]
    return decode([c for c in new if c >= 128266])

def recognise(wav24):
    x = np.interp(np.arange(0, len(wav24), 1.5), np.arange(len(wav24)), wav24).astype(np.float32)
    inp = proc(x, sampling_rate=16000, return_tensors="pt")
    with torch.no_grad():
        return proc.decode(asr(**inp).logits.argmax(-1)[0]).strip()

def cer(a, b):
    d = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        prev, d[0] = d[0], i
        for j, cb in enumerate(b, 1):
            prev, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, prev + (ca != cb))
    return d[len(b)] / max(1, len(b))



def to_mp3(wave: np.ndarray, dest: Path) -> None:
    """Trim, normalise, pad 0.15 s / 0.2 s, mp3 mono 64 kbps."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    pcm = (np.clip(wave, -1, 1) * 32767).astype("<i2").tobytes()
    trim = "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.03"
    af = f"{trim},areverse,{trim},areverse,loudnorm=I=-16:TP=-1.5:LRA=11,adelay=150:all=1,apad=pad_dur=0.2"
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-f", "s16le", "-ar", "24000", "-ac", "1", "-i", "-",
                    "-af", af, "-ac", "1", "-c:a", "libmp3lame", "-b:a", "64k", str(dest)], input=pcm, check=True)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true", help="regenerate words that already have a file")
    ap.add_argument("--tries", type=int, default=4)
    args = ap.parse_args()
    words = json.loads((ROOT / "content/words.json").read_text("utf-8"))
    todo = [w for w in words if w["lang"] == "tg" and (args.force or not (OUT / f"tg/words/{w['id']}.mp3").exists())]
    print(f"{len(todo)} words to generate")
    for n, w in enumerate(todo, 1):
        t0 = time.time(); best = None
        for t in range(args.tries):
            wav = tts(w["cyrillic"])
            if wav is None or len(wav) < 2400 or len(wav) > 24000 * 6:
                continue
            got = recognise(wav); c = cer(got, w["cyrillic"].lower())
            if best is None or c < best[0]:
                best = (c, got, wav)
            if c == 0:
                break
        ok = best is not None and best[0] == 0
        if ok:
            to_mp3(best[2], OUT / f"tg/words/{w['id']}.mp3")
        print(f"[{n}/{len(todo)}] {w['cyrillic']} -> {best[1] if best else '-'} {'kept' if ok else 'skipped'} {time.time()-t0:.0f}s", flush=True)


if __name__ == "__main__":
    sys.exit(main())
