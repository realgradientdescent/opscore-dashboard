import { NextResponse } from "next/server";

const AGENT_URL = process.env.VPS_AGENT_URL ?? "http://localhost:8765";
const API_KEY = process.env.VPS_AGENT_API_KEY ?? "";

function unavailable(status = 503) {
  return NextResponse.json(
    {
      source: "unavailable",
      note: "Alert telemetry backend unreachable",
      generated_at: new Date().toISOString(),
      summary: { active_count: 0, critical_count: 0, warning_count: 0, info_count: 0 },
      active: [],
      history: [],
      rules: [],
    },
    { status }
  );
}

export async function GET() {
  try {
    const res = await fetch(`${AGENT_URL}/alerts`, {
      headers: { "X-API-Key": API_KEY },
      next: { revalidate: 0 },
    });
    if (!res.ok) {
      return unavailable(res.status);
    }
    return NextResponse.json(await res.json());
  } catch {
    return unavailable();
  }
}
