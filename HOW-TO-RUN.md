# Fish & Ball Crush: how to run

An endless fish-and-colour-ball crushing game for the phone. There are no levels and no game over.

## Play on your phone (home Wi‑Fi)

1. On the Mac, open Terminal in this folder and start the server:

   ```sh
   cd ~/Documents/code/playground/crash
   python3 -m http.server 8000
   ```

2. Find the Mac's Wi‑Fi address:

   ```sh
   ipconfig getifaddr en0
   ```

   It looks like `192.168.8.147`.

3. Connect the phone to the **same Wi‑Fi**. In Chrome on the phone, open `http://<that-address>:8000`, for example `http://192.168.8.147:8000`.
4. Optional: in Chrome's ⋮ menu, choose **Add to Home screen** to get an app icon.

The Mac has to stay on with the server running while the kids play. To stop the server, press `Ctrl+C` in Terminal.

## Play anywhere, offline (optional)

Upload this folder to any free secure (https) static host, such as GitHub Pages, Netlify or Cloudflare Pages. Then open the link on the phone and choose **Add to Home screen** (or **Install app**). It then opens full screen like a real app and works without internet or the Mac.

Upload these files:

- `index.html`
- `style.css`
- `board.js`
- `game.js`
- `sw.js`
- `manifest.webmanifest`
- the `icons/` and `fonts/` folders

## Play on the Mac

Start the server as in step 1, then open http://localhost:8000. A mouse works too: click to tap, and drag to swipe.

## How to play

| Move              | What happens                                                                       |
| ----------------- | ---------------------------------------------------------------------------------- |
| Tap a fish        | It swims off and pops 3 pieces                                                     |
| Tap a colour ball | Zaps every fish of the most common colour                                          |
| Swipe fish + fish | 6 fish fly out                                                                     |
| Swipe fish + ball | Every fish of that colour gets zapped, and each one swims off to pop another piece |
| Swipe ball + ball | Clears the whole board                                                             |

The 🔊 button at the top right turns sound and vibration on and off.

## Run the tests

You need Node.js 18 or newer:

```sh
node --test test/
```

## Troubleshooting

- **The phone can't open the page:**
  - Check that the phone and Mac are on the same Wi‑Fi and that the server is still running.
  - macOS may ask whether to allow incoming connections for Python. Click **Allow**.
- **No sound:** tap the board once, because phones only allow sound after the first touch. Also check the phone isn't on silent and the 🔊 button isn't muted.
- **You changed the code but the phone shows the old version:** pull down to refresh, or clear the site data in Chrome.
