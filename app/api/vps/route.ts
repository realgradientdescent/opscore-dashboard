import { NextResponse } from "next/server";

const AGENT_URL = process.env.VPS_AGENT_URL ?? "http://localhost:8765";
const API_KEY = process.env.VPS_AGENT_API_KEY ?? "";

export async function GET() {
  try {
    const res = await fetch(`${AGENT_URL}/health`, {
      headers: { "X-API-Key": API_KEY },
      next: { revalidate: 0 },
    });
    if (!res.ok) throw new Error(`Agent returned ${res.status}`);
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json(mockHealth());
  }
}

function mockHealth() {
  return {
    cpu_percent: 25 + Math.random() * 40,
    cpu_per_core: [12.1, 45.3, 28.0, 41.2].map((v) => v + Math.random() * 5 - 2.5),
    memory: { used_gb: 6.2 + Math.random() * 0.5, total_gb: 16, percent: 38.7 + Math.random() * 3 },
    disk: [{ mount: "/", used_gb: 42.1, total_gb: 160, percent: 26.3 }],
    network: { bytes_in: Math.floor(Math.random() * 2000000), bytes_out: Math.floor(Math.random() * 1000000) },
    load_avg: { "1m": 0.84, "5m": 0.91, "15m": 0.78 },
    uptime_seconds: 1209600,
    hostname: "srv1573728",
    os: "Ubuntu 24.04 LTS",
    kernel: "6.8.0-51-generic",
    timestamp: new Date().toISOString(),
    top_processes: [
      { pid: 1234, name: "python3", cpu_percent: 24.5, memory_percent: 8.2, status: "running", username: "root" },
      { pid: 5678, name: "node", cpu_percent: 12.1, memory_percent: 4.1, status: "running", username: "app" },
      { pid: 9012, name: "nginx", cpu_percent: 3.2, memory_percent: 1.8, status: "sleeping", username: "www-data" },
    ],
  };
}
