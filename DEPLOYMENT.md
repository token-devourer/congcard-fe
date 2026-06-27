# Deployment Guide

## Railway Backend

Create a Railway service with root directory `server/`.

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

Use Railway's generated domain first. After the backend is live, copy the `https://...up.railway.app` domain and use it for the frontend variables below. WebSocket traffic uses the same host with `wss://`.

Health check path:

```text
/healthz
```

## Vercel Frontend

Create a Vercel project with root directory `web/`.

Recommended environment variables:

```bash
NEXT_PUBLIC_API_BASE_URL=https://your-railway-domain.up.railway.app
NEXT_PUBLIC_GAME_SERVER_URL=wss://your-railway-domain.up.railway.app
```

After Vercel is live, add the Vercel production domain to `CORS_ORIGINS` in Railway.

## Local Values

The committed `.env` files contain local runnable values. Replace production values only in the hosting dashboards.
