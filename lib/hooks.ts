"use client";

import useSWR from "swr";
import type {
  HealthData,
  ContainerData,
  AgentData,
  TokenProvider,
  CostData,
} from "./api";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useHealth() {
  return useSWR<HealthData>("/api/vps", fetcher, { refreshInterval: 5000 });
}

export function useContainers() {
  return useSWR<ContainerData[]>("/api/containers", fetcher, {
    refreshInterval: 5000,
  });
}

export function useAgents() {
  return useSWR<AgentData[]>("/api/agents", fetcher, {
    refreshInterval: 5000,
  });
}

export function useTokens(provider: string) {
  return useSWR<TokenProvider>(`/api/tokens?provider=${provider}`, fetcher, {
    refreshInterval: 30000,
  });
}

export function useCosts() {
  return useSWR<CostData>("/api/costs", fetcher, {
    refreshInterval: 300000,
  });
}
