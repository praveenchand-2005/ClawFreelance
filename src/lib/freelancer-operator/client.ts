/**
 * Freelancer.com API client for the Freelance Operator.
 *
 * Authentication is deliberately kept server-side. Set FREELANCER_OAUTH_TOKEN
 * in the deployment environment; never expose it to browser/client code.
 *
 * The public project feed can be queried without an account token, while
 * account actions (my bids, messaging, placing bids, etc.) require an
 * authenticated Freelancer OAuth token.
 */

const API_BASE = "https://www.freelancer.com/api";

export type FreelancerProject = {
  id: number;
  title: string;
  description?: string;
  type?: string;
  budget?: {
    minimum?: number;
    maximum?: number;
    currency?: { code?: string; id?: number };
  };
  submitdate?: number;
  enddate?: number;
  bid_stats?: {
    bid_count?: number;
    bid_avg?: number;
  };
  jobs?: Array<{ id: number; name?: string }>;
};

export type ProjectSearchOptions = {
  query?: string;
  jobs?: number[];
  limit?: number;
  offset?: number;
  sortField?: string;
  reverseSort?: boolean;
};

export type PlaceBidInput = {
  projectId: number;
  amount: number;
  period: number;
  description: string;
};

export class FreelancerApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly payload?: unknown,
  ) {
    super(message);
    this.name = "FreelancerApiError";
  }
}

function buildQuery(params: Record<string, string | number | boolean | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  return search.toString();
}

async function request<T>(path: string, init: RequestInit = {}, authenticated = false): Promise<T> {
  const token = process.env.FREELANCER_OAUTH_TOKEN;
  if (authenticated && !token) {
    throw new FreelancerApiError("FREELANCER_OAUTH_TOKEN is not configured");
  }

  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (authenticated && token) headers.set("Freelancer-OAuth-V1", token);
  if (init.body) headers.set("Content-Type", "application/json");

  const response = await fetch(`${API_BASE}${path}`, { ...init, headers, cache: "no-store" });
  const text = await response.text();
  let payload: unknown;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload && "message" in payload
        ? String((payload as { message?: unknown }).message)
        : `Freelancer API request failed (${response.status})`;
    throw new FreelancerApiError(message, response.status, payload);
  }

  return payload as T;
}

export async function searchProjects(options: ProjectSearchOptions = {}) {
  const query = buildQuery({
    query: options.query,
    limit: options.limit ?? 20,
    offset: options.offset,
    sort_field: options.sortField,
    reverse_sort: options.reverseSort,
    ...(options.jobs?.length ? { "jobs[]": options.jobs[0] } : {}),
  });

  return request<{ result?: { projects?: FreelancerProject[]; total_count?: number } }>(
    `/projects/0.1/projects/active/?${query}`,
  );
}

export async function getProject(projectId: number) {
  return request<{ result?: FreelancerProject }>(`/projects/0.1/projects/${projectId}/`);
}

export async function getCurrentUser() {
  return request(`/users/0.1/self/`, {}, true);
}

export async function getMyBids() {
  return request(`/projects/0.1/bids/`, {}, true);
}

export async function placeBid(input: PlaceBidInput) {
  return request(
    `/projects/0.1/bids/`,
    {
      method: "POST",
      body: JSON.stringify({
        project_id: input.projectId,
        amount: input.amount,
        period: input.period,
        description: input.description,
      }),
    },
    true,
  );
}
