/** Atlassian REST API client (Basic auth: email + API token).
 *  Used by both Jira and Confluence tools. */

export interface AtlassianConfig {
  domain: string;
  email: string;
  token: string;
}

export function getAtlassianConfig(): AtlassianConfig {
  const domain = process.env.ATLASSIAN_DOMAIN;
  const email = process.env.ATLASSIAN_EMAIL;
  const token = process.env.ATLASSIAN_API_TOKEN;

  if (!domain) throw new Error("ATLASSIAN_DOMAIN environment variable is required (e.g. mycompany.atlassian.net)");
  if (!email) throw new Error("ATLASSIAN_EMAIL environment variable is required");
  if (!token) throw new Error("ATLASSIAN_API_TOKEN environment variable is required");

  return { domain, email, token };
}

export interface AtlassianResponse<T = unknown> {
  ok: boolean;
  status: number;
  data: T;
}

export async function atlassianFetch<T = unknown>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    query?: Record<string, string | number | undefined>;
  } = {}
): Promise<AtlassianResponse<T>> {
  const config = getAtlassianConfig();
  const auth = Buffer.from(`${config.email}:${config.token}`).toString("base64");

  const url = new URL(path, `https://${config.domain}`);
  if (options.query) {
    for (const [key, val] of Object.entries(options.query)) {
      if (val !== undefined) url.searchParams.set(key, String(val));
    }
  }

  const res = await fetch(url.toString(), {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  // Some responses (204) have no body
  let data: T;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : ({} as T);
  } catch {
    data = text as unknown as T;
  }

  return { ok: res.ok, status: res.status, data };
}
