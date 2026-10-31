import type {
  AdvertisementDetail,
  AlertItem,
  CampaignDetail,
  CampaignSummary,
  DashboardSummary,
  DiscoveryRun,
  DiscoveryRunDetail,
  Note,
  PaginatedAds,
  Relationship,
  ReviewStatus,
  SourceInfo,
  CopilotStatus,
  CopilotResponse,
  CustomerAccount,
  DashboardSummaryResponse,
  DeviceFingerprint,
  ModelTelemetry,
  NetworkGraphData,
  PaginatedTransactions,
  PatternSummary,
  StreamTelemetry,
  TransactionDetail,
  TransactionSummary,
  ConsumerAdviceResponse,
  ConsumerCheckRequest,
  ModelEvaluationData,
} from "../types/api";
import { ApiError } from "../types/api";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";
const BASE = API_BASE_URL;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, init);
  } catch {
    throw new ApiError(0, "FIN-SHIELD backend is unavailable. Start the API on port 8000.");
  }
  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as { detail?: string | Array<{ msg: string }> };
      if (typeof body.detail === "string") detail = body.detail;
    } catch {
      /* use default */
    }
    throw new ApiError(response.status, detail);
  }
  return (await response.json()) as T;
}

export const api = {
  health: () => request<{ status: string }>("/api/health"),
  dashboard: () => request<DashboardSummary>("/api/dashboard/summary"),
  ads: (params: Record<string, string | number | undefined>) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== "") query.set(key, String(value));
    });
    return request<PaginatedAds>(`/api/ads?${query.toString()}`);
  },
  ad: (id: string) => request<AdvertisementDetail>(`/api/ads/${id}`),
  relationships: (id: string) => request<Relationship[]>(`/api/ads/${id}/relationships`),
  analyze: (form: FormData) =>
    request<AdvertisementDetail>("/api/analyze", { method: "POST", body: form }),
  campaigns: () => request<CampaignSummary[]>("/api/campaigns"),
  campaign: (id: string) => request<CampaignDetail>(`/api/campaigns/${id}`),
  alerts: () => request<AlertItem[]>("/api/alerts"),
  markAlert: (id: string, is_read: boolean) =>
    request<AlertItem>(`/api/alerts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_read }),
    }),
  updateReview: (id: string, review_status: ReviewStatus) =>
    request<AdvertisementDetail>(`/api/ads/${id}/review`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ review_status }),
    }),
  addNote: (id: string, content: string) =>
    request<Note>(`/api/ads/${id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    }),

  // ── Discovery Agent ──────────────────────────────────────────────────
  discoverySources: () => request<SourceInfo[]>("/api/discovery/sources"),
  startDiscovery: (query: string, sources = "web", max_candidates = 10, min_risk_threshold = 0) =>
    request<DiscoveryRun>("/api/discovery/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, sources, max_candidates, min_risk_threshold }),
    }),
  discoveryRuns: () => request<DiscoveryRun[]>("/api/discovery/runs"),
  discoveryRun: (id: string) => request<DiscoveryRunDetail>(`/api/discovery/runs/${id}`),

  // ── AI Investigation Copilot ─────────────────────────────────────────
  copilotStatus: () => request<CopilotStatus>("/api/copilot/status"),
  copilotMessage: (
    message: string,
    advertisement_id?: string | null,
    compare_ad_id?: string | null,
    conversation_history?: Array<{ role: string; content: string }>
  ) =>
    request<CopilotResponse>("/api/copilot/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        advertisement_id,
        compare_ad_id,
        conversation_history,
      }),
    }),

  // ── Real-Time UPI Transaction & Anomaly API ──────────────────────────────
  dashboardUPI: () => request<DashboardSummaryResponse>("/api/dashboard/summary"),
  transactions: (params: Record<string, string | number | undefined> = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== "") query.set(key, String(value));
    });
    return request<PaginatedTransactions>(`/api/transactions?${query.toString()}`);
  },
  transaction: (id: string) => request<TransactionDetail>(`/api/transactions/${id}`),
  ingestTransaction: (data: Record<string, any>) =>
    request<TransactionDetail>("/api/transactions/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  scoreTransaction: (data: Record<string, any>) =>
    request<any>("/api/transactions/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  updateTransactionReview: (id: string, review_status: ReviewStatus) =>
    request<TransactionDetail>(`/api/transactions/${id}/review`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ review_status }),
    }),
  addTransactionNote: (id: string, content: string, author?: string) =>
    request<any>(`/api/transactions/${id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, author }),
    }),

  // ── UPI Patterns ────────────────────────────────────────────────────────
  patterns: () => request<PatternSummary[]>("/api/patterns"),
  patternTransactions: (patternId: string) =>
    request<TransactionSummary[]>(`/api/patterns/${patternId}/transactions`),

  // ── Simulator Controls ──────────────────────────────────────────────────
  streamStatus: () => request<StreamTelemetry>("/api/stream/status"),
  streamStart: (rate_per_second = 2.0) =>
    request<StreamTelemetry>("/api/stream/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rate_per_second }),
    }),
  streamPause: () => request<StreamTelemetry>("/api/stream/pause", { method: "POST" }),
  streamResume: () => request<StreamTelemetry>("/api/stream/resume", { method: "POST" }),
  streamStop: () => request<StreamTelemetry>("/api/stream/stop", { method: "POST" }),
  streamReset: () => request<StreamTelemetry>("/api/stream/reset", { method: "POST" }),

  // ── Entity & Network Graph ──────────────────────────────────────────────
  entityAccount: (id: string) => request<CustomerAccount>(`/api/entities/accounts/${id}`),
  entityDevice: (id: string) => request<DeviceFingerprint>(`/api/entities/devices/${id}`),
  networkGraph: () => request<NetworkGraphData>("/api/network/graph"),

  // ── Model Telemetry ─────────────────────────────────────────────────────
  modelStatus: () => request<ModelTelemetry>("/api/model/status"),
  modelTrain: () => request<any>("/api/model/train", { method: "POST" }),
  modelEvaluation: () => request<ModelEvaluationData>("/api/model/evaluation"),

  // ── Consumer Advice & Payer Warning ──────────────────────────────────────
  consumerAdvice: (transactionId: string, lang = "en") =>
    request<ConsumerAdviceResponse>(`/api/transactions/${encodeURIComponent(transactionId)}/consumer-advice?lang=${lang}`),
  consumerCheck: (payload: ConsumerCheckRequest, lang = "en") =>
    request<ConsumerAdviceResponse>(`/api/consumer/check?lang=${lang}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
};
