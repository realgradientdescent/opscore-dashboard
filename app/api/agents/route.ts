import { NextResponse } from "next/server";

const AGENT_URL = process.env.VPS_AGENT_URL ?? "http://localhost:8765";
const API_KEY = process.env.VPS_AGENT_API_KEY ?? "";

const UNAVAILABLE_AGENTS = [
  {
    name: "OpenClaw",
    container: "openclaw-1ovr",
    status: "unavailable",
    uptime_seconds: 0,
    current_task: null,
    last_activity: null,
    error: "Agent backend unreachable",
    subagents: [],
  },
  {
    name: "Hermes",
    container: "hermes-agent-6aos",
    status: "unavailable",
    uptime_seconds: 0,
    current_task: null,
    last_activity: null,
    error: "Agent backend unreachable",
    subagents: [],
  },
];

export async function GET() {
  try {
    const res = await fetch(`${AGENT_URL}/agents`, {
      headers: { "X-API-Key": API_KEY },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      throw new Error(`Agent returned ${res.status}`);
    }

    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json(UNAVAILABLE_AGENTS, { status: 503 });
  }
}
