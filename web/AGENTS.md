# AGENTS.md

## Scope

These instructions apply to the entire frontend repository. If a nested `AGENTS.md` is added later, the nearest file takes precedence for files under that directory.

This file follows the common AGENTS.md convention: give coding agents the project context, commands, style rules, tests, security constraints, and PR checklist that are not always obvious from `README.md`.

## Project overview

This repository is the Next.js frontend for CongCard, a private-room real-time multiplayer UNO-like card game.

- Runtime/framework: Node.js 24+, Next.js App Router, React, TypeScript.
- Realtime client: `@colyseus/sdk`.
- State: Zustand store fed by authoritative backend snapshots.
- UI: responsive game board, localized strings, motion/sound feedback.
- Backend source of truth: the client must never decide final game legality.

## Repository map

- `src/app/` — Next.js routes, layout, global CSS, static app icon.
- `src/components/` — UI components for lobby, board, hand, seats, overlays, controls.
- `src/lib/` — API helpers, Colyseus snapshot events, client-side UI rule hints, sound, store, server-synced clock.
- `src/i18n/` — next-intl request setup.
- `messages/en.json` and `messages/id.json` — user-facing translations; keep both in sync.
- `shared/src/index.ts` — shared protocol types and zod schemas used by this frontend package.
- `test/` — Vitest/jsdom tests for UI helpers and components.

## Setup and commands

```bash
npm install
npm run dev
```

Useful checks:

```bash
npm run typecheck
npm test
npm run build
```

Targeted tests:

```bash
npx vitest run test/events.test.ts
npx vitest run test/rules.test.ts
npx vitest run test/card-view.test.tsx
npx vitest run -t "catch"
```

The default local app URL is `http://localhost:3000`. Use `.env.example` as the reference for public environment variables:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:2567
NEXT_PUBLIC_GAME_SERVER_URL=ws://localhost:2567
```

## Frontend invariants

- The backend is authoritative. Client rule helpers may disable buttons or show hints, but final validation belongs to the server.
- Never introduce UI that reveals hidden state: other players' cards, deck order, or private backend data must not be inferred or displayed.
- Consume game data from backend snapshots. Actions should flow through the Colyseus room send path in `RoomClient` and match schemas in `shared/src/index.ts`.
- Timers and One/Catch windows must use the server-synced clock (`snapshot.serverNow` via `useNow`) instead of raw local `Date.now()` comparisons.
- Keep action buttons synchronized with backend state; do not optimistically finalize gameplay actions that the server can reject.
- When changing protocol types, message payloads, error codes, snapshots, or shared schemas, update the backend companion repo as well. In this workspace it is usually at `../BE`; its matching shared package is `../BE/shared/src/index.ts`.
- Keep English and Indonesian translation files in sync for every new or changed user-facing string.
- Preserve mobile usability. Test narrow widths mentally or in browser when changing board layout, fixed controls, modals, or card sizing.

## TypeScript, React, and style

- TypeScript is strict. Avoid `any`; prefer shared types from `@congcard/shared` and local narrow types.
- Use `@/` imports for project source paths when practical.
- Add `"use client"` only to components/modules that need hooks, browser APIs, animation state, sound, or Colyseus client behavior.
- Keep presentational components focused. Put cross-component logic in `src/lib/` when it can be tested independently.
- Prefer existing CSS variables and utility classes from `src/app/globals.css` before inventing new visual tokens.
- Keep animations and sounds respectful of browser restrictions: sound unlock must remain user-gesture driven.
- Do not edit generated or dependency folders such as `.next/`, `node_modules/`, or `tsconfig.tsbuildinfo`.

## Testing expectations

- Add or update tests for client rule helpers, event diffs, log translation, card rendering, and any component logic that can regress.
- Before handing off a frontend change, run at least:

```bash
npm run typecheck
npm test
```

Run `npm run build` too when the change touches Next.js routing, config, package metadata, or deployment behavior.

## Security and operations

- Do not commit secrets. Only `NEXT_PUBLIC_*` values belong in client-exposed environment variables, and `.env.example` should document them.
- Do not add free-text chat or unescaped user-generated content without an explicit moderation/sanitization plan.
- Do not bypass server validation or persist private game state in local storage.
- Treat reconnect tokens and room IDs carefully; avoid logging or exposing more than the UI needs.

## PR checklist

- Summarize the UX/protocol change and affected files.
- List validation commands and their results.
- Mention any required backend companion change.
- Confirm translation files are updated for both `en` and `id`.
- Check that the branch is up to date with `origin/main` and is mergeable before opening or updating a PR.
