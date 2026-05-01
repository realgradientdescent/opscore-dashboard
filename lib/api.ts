const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "/api";

async function fetchApi<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export interface HealthData {
  cpu_percent: number;
  cpu_per_core: number[];
  memory: { used_gb: number; total_gb: number; percent: number };
  disk: { mount: string; used_gb: number; total_gb: number; percent: number }[];
  network: { bytes_in: number; bytes_out: number };
  load_avg: { "1m": number; "5m": number; "15m": number };
  uptime_seconds: number;
  hostname: string;
  os: string;
  kernel: string;
  timestamp: string;
  top_processes?: {
    pid: number;
    name: string;
    cpu_percent: number;
    memory_percent: number;
    status: string;
    username: string;
  }[];
}

export interface ContainerData {
  id: string;
  name: string;
  image: string;
  status: string;
  cpu_percent: number;
  memory_mb: number;
  memory_limit_mb: number;
  network_in_mb: number;
  network_out_mb: number;
  ports: string[];
  uptime_seconds: number;
  restart_count: number;
}

export interface AgentData {
  name: string;
  status: string;
  uptime_seconds: number;
  last_activity?: string | null;
  subagents?: {
    name: string;
    status: string;
    current_task?: string | null;
    tokens_session?: number;
    last_active?: string | null;
  }[];
  tokens_session?: number;
  current_task?: string | null;
  model?: string | null;
  container?: string;
  error?: string | null;
}

export interface TokenProvider {
  provider: string;
  rate_limit: { rpm: number; tpm: number; rpm_used: number; tpm_used: number };
  today: { input_tokens: number; output_tokens: number; requests: number };
  month: { input_tokens: number; output_tokens: number; requests: number };
  models: { model: string; input_tokens: number; output_tokens: number; requests: number }[];
  recent_requests: {
    timestamp: string;
    model: string;
    input_tokens: number;
    output_tokens: number;
    latency_ms: number;
    status: string;
  }[];
}

export interface CostData {
  today_total: number;
  month_total: number;
  projected_month: number;
  daily: { date: string; anthropic: number; openai: number; openrouter: number }[];
  models: { provider: string; model: string; input_tokens: number; output_tokens: number; requests: number; cost: number }[];
}

export const api = {
  health: () => fetchApi<HealthData>("/vps"),
  containers: () => fetchApi<ContainerData[]>("/containers"),
  agents: () => fetchApi<AgentData[]>("/agents"),
  tokens: (provider: string) => fetchApi<TokenProvider>(`/tokens?provider=${provider}`),
  costs: () => fetchApi<CostData>("/costs"),
};
