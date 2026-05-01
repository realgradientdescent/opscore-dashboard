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
  last_activity_at?: string | null;
  last_inbound?: string | null;
  subagents?: {
    name: string;
    status: string;
    current_task?: string | null;
    tokens_session?: number;
    last_active?: string | null;
  }[];
  tokens_session?: number | null;
  current_task?: string | null;
  model?: string | null;
  provider?: string | null;
  container?: string;
  error?: string | null;
  session_id?: string | null;
  session_source?: string | null;
  api_calls_session?: number | null;
}

export interface TokenProvider {
  provider: string;
  label?: string;
  available?: boolean;
  source?: string;
  note?: string;
  rate_limit: { rpm: number; tpm: number; rpm_used: number; tpm_used: number; known?: boolean };
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
    source?: string;
    title?: string | null;
    session_id?: string;
    request_count?: number;
  }[];
  hourly?: {
    hour: string;
    input: number;
    output: number;
    requests?: number;
  }[];
}

export interface CostData {
  available?: boolean;
  source?: string;
  note?: string;
  today_total: number;
  month_total: number;
  projected_month: number;
  currency: string;
  budget_monthly?: number | null;
  daily: { date: string; anthropic: number; openai: number; openrouter: number; custom?: number }[];
  models: { provider: string; model: string; input_tokens: number; output_tokens: number; requests: number; cost: number }[];
  month_totals_by_provider?: Record<string, number>;
  cost_status_breakdown?: Record<string, number>;
}

export interface AlertItem {
  id: string;
  severity: string;
  message: string;
  detail: string;
  time: string;
  source?: string;
}

export interface AlertRule {
  id: string;
  condition: string;
  severity: string;
  channel: string;
  enabled: boolean;
  triggered: boolean;
  detail?: string;
}

export interface AlertData {
  source?: string;
  note?: string;
  generated_at?: string;
  summary: {
    active_count: number;
    critical_count: number;
    warning_count: number;
    info_count: number;
  };
  active: AlertItem[];
  history: (AlertItem & { resolved?: boolean })[];
  rules: AlertRule[];
}

export const api = {
  health: () => fetchApi<HealthData>("/vps"),
  containers: () => fetchApi<ContainerData[]>("/containers"),
  agents: () => fetchApi<AgentData[]>("/agents"),
  tokens: (provider: string) => fetchApi<TokenProvider>(`/tokens?provider=${provider}`),
  costs: () => fetchApi<CostData>("/costs"),
  alerts: () => fetchApi<AlertData>("/alerts"),
};
