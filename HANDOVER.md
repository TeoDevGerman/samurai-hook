# HANDOVER

Shared source of truth for project status. Read this before starting any
work, and update it in the same commit as the work.

Last updated: 2026-11-14 (scaffold merged, wave 1 running)

## Current state

- **Scaffold runs end to end with stub scenes.** Ocean, cutscene, fight,
  result and shop are placeholder screens you step through with Space; gold,
  upgrades and saving already work underneath.
- How to run: `npm install`, then `npm run dev` and open
  http://localhost:5173. Checks: `npm run typecheck`, `npm test`.
- Jump to a scene while developing:
  `http://localhost:5173/?scene=fight&fish=shark&tier=0`
  (`scene` = ocean, cutscene, fight, result, shop).
- Done: `src/types.ts` (shared contracts), `src/manifest.ts` (all art,
  sound, text and tuning), `src/core/*`, `src/game/state.ts` with tests,
  `src/main.ts`.
- Stubs still to be replaced: `src/input/*` (keyboard only),
  `src/scenes/*`.

## In progress

| Task | Owner | Branch |
|---|---|---|
| Keyboard + gamepad input, prompt glyphs | subagent (Opus 5.5) | `feat/input` |
| Fight simulation and fish behaviour | subagent (Opus 5.5) | `feat/fight-sim` |
| Ocean scene | subagent (Sonnet 5.5) | `feat/ocean` |
| CC0 art and sound, CREDITS.md | subagent (Sonnet 5.5) | `feat/assets` |
| Cutscene, result, shop screens, HUD helpers | subagent (Sonnet 5.5) | `feat/screens` |

## Pending (in priority order)

1. Fight scene (`src/scenes/fight.ts`) drawing the fight simulation.
   Branch `feat/fight-scene`. Needs `feat/fight-sim` merged first.
2. Browser verification (docs/DESIGN.md, section 9).
3. Tuning pass on fish stats, slip windows and prices (all in
   `src/manifest.ts`).
4. README.md: how to run, controls, how to add a fish or swap an asset.
5. A human checks the game on a real controller.

## Decisions

Team answers (2026-11-14):

- Fight controls: 4-button duel (move, quick slash, heavy slash, defend).
- Art: CC0 pixel art; code-drawn placeholders where no licence is confirmed.
- Roster: 8 to 10 fish; the plan has 9.
- Shop: 3 endless tracks only (damage, max depth, gold bonus).
- Audio: CC0 sound files, credited.
- Humour: anime fight announcer.
- PRs: the orchestrator merges its own PRs after its checks.
- Gamepad: tested with a simulated gamepad, then confirmed by a human.

Orchestrator's calls (small and reversible):

- Vite + TypeScript + Canvas 2D, no engine, because the fight logic stays
  pure and testable and there is no framework for the team to learn.
- Progress is saved in localStorage.
- Below 170 m the roster repeats in tougher, richer tiers.
- "Equipment" is the name of each damage level, not separate items.
- Losing a fight costs only the fish.
- The design doc lives at docs/DESIGN.md.
- The plan was approved on 2026-11-14, with the spoken announcer (browser
  speech synthesis, switch in `manifest.ts` under `voice`).
- `src/game/state.ts` was written by the orchestrator in the scaffold
  instead of by a subagent, so that every other module could run against
  real gold, upgrades and fish data from the start.
- While several agents work in parallel, only the orchestrator edits
  HANDOVER.md, `src/types.ts` and `src/main.ts`, to avoid merge conflicts.
  Agents report in their PR description and the orchestrator updates this
  file when it merges. (The fight agent may extend fight-related parts of
  `types.ts` and `manifest.ts`; the assets agent edits the sprite, sound
  and music entries of `manifest.ts`.)

## Known issues and open questions

- The first commit (plan and scaffold) went straight to `main` because an
  empty repo gives pull requests no base. Everything after it goes through
  PRs.
- Risk: a CC0 animated samurai sprite may not exist; a placeholder will be
  used and flagged if so.
- Not yet testable: real controller hardware.
