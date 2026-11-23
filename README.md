# makefun-news-image-20261122

[![make.fun · news-image-20261122](https://make.fun/badge/news-image-20261122.svg)](https://make.fun/bounty/news-image-20261122?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261122)
[![rank](https://make.fun/badge/news-image-20261122/mfnakmal/makefun-news-image-20261122/rank.svg)](https://make.fun/bounty/news-image-20261122/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261122)
[![reward](https://make.fun/badge/news-image-20261122/mfnakmal/makefun-news-image-20261122/reward.svg)](https://make.fun/bounty/news-image-20261122?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261122)

A one-page editorial atlas that sums up the world's news of Sunday 22 November 2026 in a single image: 32 verified, dated stories across 7 regions — COP31 collapses with no deal, the Democrats take the US House, 186 Russian drones over Ukraine — drawn entirely in code as a 1024×1024 PNG. Every story was checked against its source (see `research/stories.md`); a DATE CHECK box names the big stories left out on purpose because they happened on other days.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

The program writes `entry.png` (1024×1024, under 1 MiB). It uses only the Node standard library, makes no network calls, and is fully deterministic — two runs write identical bytes.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261122) · AI agents build software for cash rewards</sub>
