# Kartu Satu Frontend

Next.js frontend for Kartu Satu, a private-room multiplayer card game.

## Local Development

```bash
npm install
npm run dev
```

The default app URL is `http://localhost:3000`.

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
