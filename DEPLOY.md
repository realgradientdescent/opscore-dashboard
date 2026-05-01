# OpsCore Deployment Guide

## VPS: srv1573728.hstgr.cloud (72.62.96.98) — Ubuntu 24.04

---

## Note on Traefik

Your Traefik container (`traefik-traefik-1`) uses **host network mode** and cannot join
additional Docker networks. The OpsCore agent is therefore exposed directly on port 8765,
bound to the public IP. Access is restricted by the `X-API-Key` header.

---

## Step 1 — Deploy VPS Agent on the server

SSH in:
```bash
ssh root@72.62.96.98
```

Clone or copy the vps-agent folder to your server:
```bash
mkdir -p /opt/opscore
# copy vps-agent/ contents to /opt/opscore/vps-agent/
```

The VPS agent must be able to read both:
- Hermes state at `/docker/hermes-agent-6aos/data`
- OpenClaw state at `/docker/openclaw-1ovr/data/.openclaw`

If your host paths differ, set `OPENCLAW_HOST_STATE_DIR` before `docker compose up` or edit the compose file.

Create the env file:
```bash
cd /opt/opscore/vps-agent
cp .env.example .env
nano .env
# Fill in your secrets — generate API key with: openssl rand -hex 32
```

Build and start the agent (it will auto-join the Traefik network):
```bash
docker compose up -d --build
```

After startup, the container should have OpenClaw state mounted at `/opt/openclaw-state` and the agent will read `OPENCLAW_STATE_DIR=/opt/openclaw-state`.

Verify it's running:
```bash
curl http://localhost:8765/health   # direct (no auth needed for health check)
# or via Traefik:
curl https://srv1573728.hstgr.cloud/opscore-agent/health -H "X-API-Key: YOUR_KEY"
```

---

## Step 2 — Deploy the Dashboard (Vercel — recommended)

1. Push `opscore-dashboard/` to a GitHub repo
2. Import the repo in Vercel
3. Set environment variables in Vercel dashboard:

```
VPS_AGENT_URL=http://72.62.96.98:8765
VPS_AGENT_API_KEY=<same key from step 1>
NEXTAUTH_URL=https://your-vercel-app.vercel.app
NEXTAUTH_SECRET=<openssl rand -base64 32>
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

---

## Step 3 — Verify the route is live

```bash
curl https://srv1573728.hstgr.cloud/opscore-agent/health \
  -H "X-API-Key: YOUR_OPSCORE_API_KEY"
```

Expected response: JSON with cpu_percent, memory, disk, etc.

---

## Container names on your VPS

| Dashboard name | Actual container |
|---|---|
| OpenClaw | `openclaw-1ovr` |
| Hermes | `hermes-agent-6aos` |
| Portfolio | `pradeep-portfolio` |
| Reverse proxy | `traefik` |
| OpsCore Agent | `opscore-agent` (new) |
