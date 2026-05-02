# OpsCore Dashboard — Project Details

## One-line summary

OpsCore is my live operations dashboard for monitoring VPS health, Docker containers, and AI agent activity across the stack that powers my workflows.

## Problem

I was juggling multiple moving parts:

- a VPS running infrastructure and support services,
- Hermes and OpenClaw agent workloads,
- provider token/cost usage,
- and a growing need to know what was actually happening without SSH-ing into everything manually.

I wanted a single interface that turned scattered operational state into something readable, fast, and useful.

## Solution

I built a Next.js dashboard that sits in front of a small VPS telemetry service.
The dashboard polls dashboard-friendly API routes for:

- VPS health
- container state
- agent state
- token/rate-limit telemetry
- cost breakdowns
- alerts

This makes the system useful both as an internal operator console and as a portfolio proof point for practical AI + infra work.

## Stack

- **Frontend:** Next.js 16, React 19, Tailwind CSS 4
- **Data fetching:** SWR
- **Charts:** Recharts
- **Backend telemetry service:** Python `vps-agent`
- **Deployment:** Vercel frontend + Ubuntu VPS backend

## Key implementation ideas

### 1. Separate UI from telemetry collection
The Vercel app is responsible for presentation and lightweight API routing.
The VPS agent is responsible for collecting machine/container/agent state close to the source.

### 2. Make agent work observable
The dashboard includes dedicated views for Hermes and OpenClaw so I can inspect:

- status
- uptime
- current task context
- model in use
- session token totals
- recent activity/log-derived hints

### 3. Show infra and agent state together
I wanted agent telemetry in the same place as container health because operationally those belong together.
If Hermes is "active" but the container is unhealthy, that mismatch matters.

### 4. Track costs as an operating signal
Model usage is part of operations, not just billing.
The dashboard surfaces current-month totals and a model/provider breakdown so spend is easier to reason about.

## Evidence from the live deployment

These images are committed in-repo and can be reused in portfolio material.

### Overview
![Overview](../evidence/screenshots/vercel/overview-live.png)

### Agents
![Agents](../evidence/screenshots/vercel/agents-live.png)

### Containers
![Containers](../evidence/screenshots/vercel/containers-live.png)

### Costs
![Costs](../evidence/screenshots/vercel/costs-live.png)

## What the evidence proves

- The project was deployed on **Vercel**
- The UI was running as a real multi-page dashboard
- The dashboard was connected to a real supporting environment
- The containers page showed actual infra relevant to my stack, including `pradeep-portfolio`, `hermes-agent`, `openclaw`, and `traefik`
- The agents page surfaced real task/model/token context from live agent workflows
- The costs page showed real accumulated usage instead of static marketing copy

## Notable engineering decisions

- Built the dashboard around operational questions instead of generic admin-template widgets
- Kept the telemetry collector separate from the Vercel frontend so host data stays server-side
- Used polling-based hooks for a simpler operator experience
- Structured the app so each telemetry domain has its own route and page

## Good portfolio framing

If I reuse this on my portfolio site, the strongest framing is:

- *Built a live operations dashboard for AI agents and VPS infrastructure*
- *Connected Vercel UI to a VPS-side telemetry service*
- *Surfaced container health, agent activity, and model-cost data in one interface*
- *Used it to monitor the same infrastructure powering my other projects*

## Relevant paths

- `README.md`
- `DEPLOY.md`
- `app/(dashboard)/`
- `app/api/`
- `vps-agent/`
- `evidence/screenshots/vercel/`
