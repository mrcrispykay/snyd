# Bodega

Danish bar games for the whole table, played with everyone on their own phone.

**Play:** https://mrcrispykay.github.io/snyd/

| Game | Players | What it is |
|---|---|---|
| Snyd | 2–10 | Liar's dice: bid on how many dice of a face are on the whole table, or call "Snyd!" |
| Meyer | 2–12 | Two dice under a cup. Announce your roll, or lie, and pass it on. The next player believes you or lifts the cup. |
| 10.000 | 1–10 | Push-your-luck with five dice (Grådig/Farkle). Bank your points before a roll scores nothing. |
| Yatzy | 1–10 | Scandinavian Yatzy. Everyone plays their own sheet at once, or take turns. |
| Skib, kaptajn og mandskab | 2–12 | Three rolls to find 6, 5 and 4 in order. The other two dice are the cargo. Smallest cargo drinks. |
| Gris | 1–10 | Roll one die (or two) as long as you dare. A 1 loses the turn. First to 100. |
| Hesteløb | 2–12 | The four aces race up a track as cards are turned. Bet sips on a horse. |
| Kongens kop | 2–12 | Draw a card and follow its rule. The fourth king drinks the cup. Card rules are editable. |
| Bussen | 2–10 | Four guesses build your hand, the pyramid hands out sips, the player with most cards left rides the bus. |
| Snyd med kort | 3–8 | Cheat: play cards face down claiming the next rank. Anyone can call snyd. Empty your hand to win. |
| Sjavs | 4 | The Faroese trick-taking game in two teams. Bid trump length, take 61 of 120 points, count down from 24. |
| Mest sandsynligt | 3–12 | Secret vote: who’s most likely to…? Most votes drinks. Add your own prompts. |
| Jeg har aldrig | 2–12 | Never have I ever: answer in secret, then the answers are revealed. Add your own prompts. |

## How it works

1. One person taps **Start a table**. Their phone hosts and shows a 4-letter code and a QR code.
2. Everyone else scans the QR code, or opens the site and types the code.
3. The host picks a game from the menu, sets the house rules and taps **Start**. After a game, the host can play again or go back to the menu. Nobody has to rejoin.

The host's phone runs the games. The phones connect directly to each other over WebRTC, using the free PeerJS service to find each other. If a direct connection isn't possible, PeerJS relays the traffic. No server or PC is needed, so it works on mobile data at a bar.

**Keep the host's phone on the game screen.** If the host locks the phone or switches apps for long, the others lose the table until the host comes back. Players who drop out or reload rejoin their seat automatically, and rejoining with the same name and code also works. Anyone who arrives mid-game watches and gets dealt into the next one.

## Notes on rules

Sjavs follows the Faroese rules on pagat.com. Partners sit opposite each other in the order people joined the table. Sources disagree on a few scoring details, so check the in-game rules against how you play.

## House rules (toggles in the lobby)

**Snyd:** dice per player (4); ones wild (on); trappe, where 1-2-3… counts as dice + 1 (on); til stede (off); who drops a die: everyone but the loser, so the last with dice loses (default), or only the loser, so the last with dice wins; lowest opening bid (1).

**Meyer:** lives (6); *det eller derover*, where the same roll is allowed (on); a lift on a Meyer costs double (on); pass blind (on); 3-2 is skål, where everyone drinks and the round restarts (on); the game ends with the first player out losing (default) or the last one standing winning.

Meyer ranking, highest first: Meyer (1-2), Lille-Meyer (1-3), pairs 6-6 down to 1-1, then 65, 64 … 32.

**10.000:** play to (10.000); points to get on the board in one turn (400); straights 2.000 (on); full house 2.500 (on); hot dice (on).

Scores: 1 = 100, 5 = 50, three of a kind = face × 100 (three 1s = 1.000), four of a kind 1.500, five of a kind 2.000. When someone reaches the target, everyone else gets one last turn.

## Development

No build step. Serve the folder and open it:

```bash
npm run serve
```

To test multiplayer on one computer, open the site in two tabs. Each tab is a separate player.

```bash
npm test
```

- `js/table.js`: the table (seats, lobby, game choice, rules). It runs the selected game.
- `js/games/*.js`: one pure rules engine per game, with `start`, `apply`, `view` and `removePlayer`. These run in the host's browser and in the tests.
- `js/ui/*.js`: one screen per game, with `render`, `handle`, `howTo` and `rulesSummary`.
- `js/net.js`: PeerJS hosting and joining, with heartbeats and reconnects.
- `js/main.js`: the home screen, lobby, game menu and wiring.
- `sw.js`: caches the app shell. Bump `VERSION` when files change.

To add a game, write `js/games/<game>.js` and `js/ui/<game>.js`, then register them in `GAMES` in `table.js`, in `UIS` in `main.js`, and in the file list in `sw.js`.

Every push to `main` runs the tests and deploys to GitHub Pages.
