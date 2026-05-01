import { NextResponse } from "next/server";

const AGENT_URL = process.env.VPS_AGENT_URL ?? "http://localhost:8765";
const API_KEY = process.env.VPS_AGENT_API_KEY ?? "";

function unavailable(provider: string, status = 503) {
  return NextResponse.json(
    {
      provider,
      label: provider,
      available: false,
      source: "unavailable",
      note: "Token telemetry backend unreachable",
      rate_limit: { rpm: 0, tpm: 0, rpm_used: 0, tpm_used: 0, known: false },
      today: { input_tokens: 0, output_tokens: 0, requests: 0 },
      month: { input_tokens: 0, output_tokens: 0, requests: 0 },
      models: [],
      recent_requests: [],
      hourly: [],
    },
    { status }
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const provider = searchParams.get("provider") ?? "openai-codex";

  try {
    const res = await fetch(`${AGENT_URL}/tokens/${provider}`, {
      headers: { "X-API-Key": API_KEY },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return unavailable(provider, res.status);
    }

    return NextResponse.json(await res.json());
  } catch {
    return unavailable(provider);
  }
}
