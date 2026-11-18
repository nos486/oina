"""
Downloads human Tajik word recordings from Lingua Libre (Wikimedia Commons, all CC0) listed in
content/audio-sources/lingualibre-tg.json and writes them as mp3 (mono, 64 kbps, trimmed, short pad)
into apps/web/public/audio. They replace any machine-made clip at the same path.

    python3 scripts/audio/fetch_lingualibre.py && pnpm audio:list

Needs Python 3.9+ and ffmpeg. Wikimedia rate-limits busy shared IPs; run it from a normal
connection or the "Fetch Lingua Libre audio" GitHub Action.
"""
import json, subprocess, sys, time, urllib.error, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "apps/web/public/audio"
UA = {"User-Agent": "Oina/0.1 (free Tajik reading app; https://github.com/nos486/oina)"}
TRIM = "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05"
AF = f"{TRIM},areverse,{TRIM},areverse,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=24000,adelay=150:all=1,apad=pad_dur=0.2"


def get(url: str) -> bytes:
    for i in range(10):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read()
        except urllib.error.HTTPError as e:
            if e.code != 429:
                raise
            wait = 20 * (i + 1)
            print(f"  rate limited, waiting {wait}s", flush=True)
            time.sleep(wait)
    raise RuntimeError(f"gave up on {url}")


def main() -> int:
    sources = json.loads((ROOT / "content/audio-sources/lingualibre-tg.json").read_text("utf-8"))
    failed = 0
    for n, s in enumerate(sources, 1):
        try:
            wav = get(s["url"])
            dest = OUT / s["file"]
            dest.parent.mkdir(parents=True, exist_ok=True)
            subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", "-", "-af", AF, "-ac", "1", "-ar", "24000",
                            "-c:a", "libmp3lame", "-b:a", "64k", str(dest)], input=wav, check=True)
            print(f"[{n}/{len(sources)}] {s['word']} -> {s['file']}", flush=True)
        except Exception as e:  # keep going; report at the end
            failed += 1
            print(f"[{n}/{len(sources)}] {s['word']} FAILED: {e}", flush=True)
        time.sleep(1)
    print(f"{len(sources) - failed} written, {failed} failed")
    return 1 if failed == len(sources) else 0


if __name__ == "__main__":
    sys.exit(main())
