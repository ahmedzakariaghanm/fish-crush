# 🐟 Fish & Ball Crush

An endless fish-and-colour-ball crushing game for kids, made for phones. There are no levels and no game over: just keep crushing.

## Play

**▶ https://USERNAME.github.io/fish-crush/**

> Replace `USERNAME` with your GitHub username once GitHub Pages is turned on (see [Publish on GitHub Pages](#publish-on-github-pages)).

## Install for offline play

Open the link on the phone, then:

- **Android (Chrome):** tap **⋮** → **Install app** (or **Add to Home screen**).
- **iPhone (Safari):** tap **Share** → **Add to Home Screen**.

Open it once while online. After that it runs full screen from the home-screen icon and works without internet.

## How to play

| Move              | What happens                                                                       |
| ----------------- | ---------------------------------------------------------------------------------- |
| Tap a fish        | It swims off and pops 3 pieces                                                     |
| Tap a colour ball | Zaps every fish of the most common colour                                          |
| Swipe fish + fish | 6 fish fly out                                                                     |
| Swipe fish + ball | Every fish of that colour gets zapped, and each one swims off to pop another piece |
| Swipe ball + ball | Clears the whole board                                                             |

The 🔊 button at the top right turns sound and vibration on and off.

## Run locally

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000. A mouse works too: click to tap, and drag to swipe.

To play on a phone over home Wi‑Fi, or for troubleshooting, see [HOW-TO-RUN.md](HOW-TO-RUN.md).

## Publish on GitHub Pages

1. Push this folder to a **public** GitHub repository (for example `fish-crush`).
2. In the repo, go to **Settings** → **Pages**.
3. Set **Source** to **Deploy from a branch**, **Branch** to `main`, and the folder to `/ (root)`, then click **Save**.
4. After a minute or two, the game is live at `https://USERNAME.github.io/fish-crush/`.

## Updating

1. Commit and push your changes. Pages redeploys automatically.
2. Open the app once while online so it downloads the new version.
3. If a phone keeps showing the old version, bump the cache name in `sw.js` (for example `fish-crush-v2` → `fish-crush-v3`) and push again.

## Tests

You need Node.js 18 or newer:

```sh
node --test test/
```

## Project files

| File / folder          | Purpose                                 |
| ---------------------- | --------------------------------------- |
| `index.html`           | Page shell and service-worker setup     |
| `style.css`            | Page styles                             |
| `board.js`             | Game logic, no DOM (also used by tests) |
| `game.js`              | Drawing, touch input, animation, sound  |
| `sw.js`                | Service worker for offline caching      |
| `manifest.webmanifest` | App name, icons, and install settings   |
| `icons/`               | App icons                               |
| `fonts/`               | Lilita One font                         |
| `test/`                | Board logic tests                       |
