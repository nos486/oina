Put audio files here (served by Pages at /audio/...). Naming:

- tg/letters/<letterId>-name.mp3   name of the letter
- tg/letters/<letterId>-sound.mp3  the pure sound
- tg/words/<wordId>.mp3

mp3, mono, 64 kbps, about 0.15 s of silence before and 0.2 s after (no more). After adding files run `pnpm audio:list`
from the repo root; it updates content/audio-manifest.json so the app enables those buttons.
