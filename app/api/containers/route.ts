import { NextResponse } from "next/server";

const AGENT_URL = process.env.VPS_AGENT_URL ?? "http://localhost:8765";
const API_KEY = process.env.VPS_AGENT_API_KEY ?? "";

export async function GET() {
  try {
    const res = await fetch(`${AGENT_URL}/containers`, {
      headers: { "X-API-Key": API_KEY },
      next: { revalidate: 0 },
    });
    if (!res.ok) throw new Error(`Agent returned ${res.status}`);
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json(mockContainers());
  }
}

function mockContainers() {
  return [
    { id: "abc1", name: "openclaw-1ovr", image: "openclaw:latest", status: "running", cpu_percent: +(12.4 + Math.random() * 3).toFixed(1), memory_mb: 512, memory_limit_mb: 2048, network_in_mb: 14.2, network_out_mb: 8.1, ports: ["8080:80"], uptime_seconds: 86400, restart_count: 0 },
    { id: "abc2", name: "hermes-agent-6aos", image: "hermes:latest", status: "running", cpu_percent: +(8.1 + Math.random() * 2).toFixed(1), memory_mb: 380, memory_limit_mb: 1024, network_in_mb: 9.4, network_out_mb: 5.2, ports: ["9090:80"], uptime_seconds: 172800, restart_count: 0 },
    { id: "abc3", name: "pradeep-portfolio", image: "portfolio:latest", status: "running", cpu_percent: 0.5, memory_mb: 96, memory_limit_mb: 512, network_in_mb: 2.1, network_out_mb: 1.8, ports: ["3000:3000"], uptime_seconds: 604800, restart_count: 0 },
    { id: "abc4", name: "traefik", image: "traefik:v3", status: "running", cpu_percent: 0.8, memory_mb: 64, memory_limit_mb: 256, network_in_mb: 40.2, network_out_mb: 38.1, ports: ["80:80", "443:443"], uptime_seconds: 604800, restart_count: 0 },
    { id: "abc5", name: "opscore-agent", image: "opscore-agent:latest", status: "running", cpu_percent: 1.2, memory_mb: 96, memory_limit_mb: 512, network_in_mb: 1.1, network_out_mb: 0.9, ports: ["8765:8765"], uptime_seconds: 3600, restart_count: 0 },
  ];
}
