# Railway Deployment

Create a Railway service from this repository.

Recommended environment variables:

```bash
NODE_ENV=production
PORT=2567
CORS_ORIGINS=https://your-vercel-domain.vercel.app
MAX_ROOMS=100
TURN_TIMEOUT_DEFAULT=30
RECONNECT_GRACE_SEC=60
LOG_LEVEL=info
```

Health check path:

```text
/healthz
```

After Railway is live, use the generated backend domain in the frontend repository:

```bash
NEXT_PUBLIC_API_BASE_URL=https://your-railway-domain.up.railway.app
NEXT_PUBLIC_GAME_SERVER_URL=wss://your-railway-domain.up.railway.app
```
