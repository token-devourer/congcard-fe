# CongCard Frontend v1.0.0

Next.js frontend for CongCard, a private-room multiplayer card game.

## Runtime

- Node.js 24.17.0 LTS
- Next.js 16.2.9
- React 19.2.7

## Local Development

```bash
npm install
npm run dev
```

The default app URL is `http://localhost:3000`.

CongCard uses low-volume procedural Web Audio music. Music and gameplay sounds have independent persisted controls. Browser audio begins only after the first user interaction.

## Environment

Use `.env.example` as the reference. The committed `.env` contains local runnable values.

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:2567
NEXT_PUBLIC_GAME_SERVER_URL=ws://localhost:2567
```

For Vercel, set these values to the Railway backend URL:

```bash
NEXT_PUBLIC_API_BASE_URL=https://your-railway-domain.up.railway.app
NEXT_PUBLIC_GAME_SERVER_URL=wss://your-railway-domain.up.railway.app
```

## Checks

```bash
npm run typecheck
npm test
npm run build
```

The same checks run in GitHub Actions for every pull request and push to `main`.

## Production

Deploy this directory as the Vercel project root. Configure the backend HTTP and WebSocket URLs from `.env.example`. Rooms are intentionally private and require a six-character room code.

Current limitations: rooms are stored in memory, and the 0-7, Explode 25, and Flip modes remain unavailable placeholders.
