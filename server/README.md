# CongCard Backend v1.0.0

Authoritative Colyseus backend for CongCard.

## Runtime

- Node.js 24.17.0 LTS
- Colyseus 0.17.43
- Express 5.2.1

## Local Development

```bash
npm install
npm run dev
```

The default backend URL is `http://localhost:2567`.

## HTTP Endpoints

- `GET /healthz`
- `POST /rooms`
- `GET /rooms/:code`

## Environment

Use `.env.example` as the reference. The committed `.env` contains local runnable values.

```bash
NODE_ENV=development
PORT=2567
CORS_ORIGINS=http://localhost:3000
MAX_ROOMS=100
TURN_TIMEOUT_DEFAULT=30
RECONNECT_GRACE_SEC=60
LOG_LEVEL=info
```

### Flip mode randomization

The server supports randomizing the mapping between light/dark flip faces and the action-value pairs used by the `flip` game mode. This is useful for production deployments where decks should vary between runs.

- Config option: `RANDOMIZE_FLIP_PAIRS` (env) — accepts `0` or `1`. Default is `0`.
- Runtime config: exposed via `config.randomizeFlipPairs` in the application.
- Behavior: randomization is automatically enabled when `NODE_ENV=production`, or when `RANDOMIZE_FLIP_PAIRS=1`.

To force randomization locally for testing:

```bash
RANDOMIZE_FLIP_PAIRS=1 npm run dev
```

On Windows CMD:

```bash
set "RANDOMIZE_FLIP_PAIRS=1" && npm run dev
```


For Railway, replace `CORS_ORIGINS` with the Vercel frontend URL.

## Checks

```bash
npm run typecheck
npm test
npm run build
```

`npm run build` creates the production bundle in `dist/`. Start the compiled service with:

```bash
npm start
```

The same checks run in GitHub Actions for every pull request and push to `main`.

## Production

Deploy this directory as the Railway service root. The service validates all environment values at startup and shuts down gracefully on `SIGINT` or `SIGTERM`. `/healthz` reports version, uptime, and active room count.

Rooms are intentionally in-memory in v1.0.0 and are not retained across service restarts.
