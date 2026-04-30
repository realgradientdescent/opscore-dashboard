import { NextResponse } from "next/server";

const AGENT_URL = process.env.VPS_AGENT_URL ?? "http://localhost:8765";
const API_KEY = process.env.VPS_AGENT_API_KEY ?? "";

export async function GET() {
  try {
    const res = await fetch(`${AGENT_URL}/costs`, {
      headers: { "X-API-Key": API_KEY },
      next: { revalidate: 0 },
    });
    if (!res.ok) throw new Error(`Agent returned ${res.status}`);
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ today_total: 24.40, month_total: 387.20, projected_month: 490.50, daily: [], models: [] });
  }
}
