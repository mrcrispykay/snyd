# Snyd

The Danish bar dice game of bluffing (also called Løgn or Tænkeboks), played with everyone on their own phone.

**Play:** https://mrcrispykay.github.io/snyd/

## How a game works

1. One person taps **Start a table**. Their phone hosts the game and shows a 4-letter code and a QR code.
2. Everyone else scans the QR code, or opens the site and types the code.
3. The host picks the house rules and taps **Start game**.

The host's phone runs the game. The phones connect directly to each other over WebRTC, using the free PeerJS service to find each other. If a direct connection isn't possible, PeerJS relays the traffic. No server or PC is needed, so it works on mobile data at a bar.

**Keep the host's phone on the game screen.** If the host locks the phone or switches apps for long, the others lose the table until the host comes back. Players who drop out, or reload the page, rejoin their seat automatically. Rejoining by typing the same name and code also works. The site keeps the screen awake while you play, where the phone allows it.

## House rules (set in the lobby)

| Setting | Default | |
|---|---|---|
| Dice per player | 4 | 3 to 6 |
| Ones are wild | on | A 1 counts as the bid face. Ones can't be bid while this is on. |
| Trappe | on | 1-2, 1-2-3 … using all your dice counts as dice + 1. A lone 1 counts as 2. |
| Til stede | off | Wilds and trappes only count if at least one real die shows the bid face. |
| Who drops a die | everyone but the loser | Last with dice loses (Danish style). The alternative: only the loser drops a die, and the last with dice wins (Perudo style). |
| Lowest opening bid | 1 | |

A bid must be more dice (any face), or the same number of dice with a higher face. When a bid is called and the count equals the bid, the bid holds.

## Development

No build step. Serve the folder and open it:

```bash
npm run serve
```

To test multiplayer on one computer, open the site in two tabs. Each tab is a separate player.

```bash
npm test
```

The tests cover the rules engine: counting with wild ones, trappe and til stede, bid order, round results under both dice-loss rules, seat reclaiming, and full random games.

- `js/engine.js` holds the rules and game state. It's pure functions, run by the host's browser and by the tests.
- `js/net.js` handles PeerJS hosting and joining, with heartbeats and reconnects.
- `js/main.js` contains the screens.
- `sw.js` caches the app shell. Bump `VERSION` when files change.

Every push to `main` runs the tests and deploys to GitHub Pages.
