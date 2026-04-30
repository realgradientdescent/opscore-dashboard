import { NextResponse } from "next/server";

const AGENT_URL = process.env.VPS_AGENT_URL ?? "http://localhost:8765";
const API_KEY = process.env.VPS_AGENT_API_KEY ?? "";

export async function GET() {
  try {
    const res = await fetch(`${AGENT_URL}/agents`, {
      headers: { "X-API-Key": API_KEY },
      next: { revalidate: 0 },
    });
    if (!res.ok) throw new Error(`Agent returned ${res.status}`);
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json([
      { name: "OpenClaw", container: "openclaw-1ovr", status: "running", uptime_seconds: 86400, current_task: "Analyzing repository", last_activity: "3s ago", tokens_session: 45320, subagents: [
        { name: "Main", status: "active", current_task: "Analyzing repo...", tokens_session: 14230, last_active: "3s ago" },
        { name: "Sub-1", status: "active", current_task: "File search", tokens_session: 8100, last_active: "12s ago" },
        { name: "Sub-2", status: "idle", current_task: "", tokens_session: 3400, last_active: "4m ago" },
      ]},
      { name: "Hermes", container: "hermes-agent-6aos", status: "running", uptime_seconds: 172800, current_task: "Processing queue", last_activity: "8s ago", tokens_session: 28900, model: "claude-opus-4-6" },
    ]);
  }
}
