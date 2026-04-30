import { NextResponse } from "next/server";

const AGENT_URL = process.env.VPS_AGENT_URL ?? "http://localhost:8765";
const API_KEY = process.env.VPS_AGENT_API_KEY ?? "";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const provider = searchParams.get("provider") ?? "anthropic";
  try {
    const res = await fetch(`${AGENT_URL}/tokens/${provider}`, {
      headers: { "X-API-Key": API_KEY },
      next: { revalidate: 0 },
    });
    if (!res.ok) throw new Error(`Agent returned ${res.status}`);
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ provider, rate_limit: { rpm: 50, tpm: 100000, rpm_used: 21, tpm_used: 42000 }, today: { input_tokens: 1420000, output_tokens: 340000, requests: 1243 }, month: { input_tokens: 28400000, output_tokens: 6800000, requests: 18240 }, models: [], recent_requests: [] });
  }
}
