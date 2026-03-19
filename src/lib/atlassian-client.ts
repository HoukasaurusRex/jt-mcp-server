/** Atlassian REST API client (Basic auth: email + API token).
 *  Used by both Jira and Confluence tools. */

export interface AtlassianConfig {
  domain: string;
  email: string;
  token: string;
  authHeader: string;
}

let _config: AtlassianConfig | null = null;

export function getAtlassianConfig(): AtlassianConfig {
  if (_config) return _config;

  const domain = process.env.ATLASSIAN_DOMAIN;
  const email = process.env.ATLASSIAN_EMAIL;
  const token = process.env.ATLASSIAN_API_TOKEN;

  if (!domain) throw new Error("ATLASSIAN_DOMAIN environment variable is required (e.g. mycompany.atlassian.net)");
  if (!email) throw new Error("ATLASSIAN_EMAIL environment variable is required");
  if (!token) throw new Error("ATLASSIAN_API_TOKEN environment variable is required");

  _config = {
    domain,
    email,
    token,
    authHeader: `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`,
  };
  return _config;
}

export interface AtlassianResponse<T = unknown> {
  ok: boolean;
  status: number;
  data: T;
}

const REQUEST_TIMEOUT_MS = 30_000;

export async function atlassianFetch<T = unknown>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    query?: Record<string, string | number | undefined>;
  } = {}
): Promise<AtlassianResponse<T>> {
  const config = getAtlassianConfig();

  const url = new URL(path, `https://${config.domain}`);
  if (options.query) {
    for (const [key, val] of Object.entries(options.query)) {
      if (val !== undefined) url.searchParams.set(key, String(val));
    }
  }

  const res = await fetch(url.toString(), {
    method: options.method ?? "GET",
    headers: {
      Authorization: config.authHeader,
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
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

/** Build an ADF paragraph node from plain text — shared by Jira and Confluence. */
export const toAdfParagraph = (text: string) => ({
  type: "doc",
  version: 1,
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

/** Resolve an assignee string to an Atlassian accountId. */
export async function resolveAssignee(
  assignee: string
): Promise<{ accountId: string | null; error?: string }> {
  if (assignee === "unassign") {
    return { accountId: null };
  }
  if (assignee === "@me") {
    const me = await atlassianFetch<{ accountId: string }>("/rest/api/3/myself");
    if (!me.ok) {
      return { accountId: null, error: `Failed to resolve @me (${me.status}): ${JSON.stringify(me.data)}` };
    }
    return { accountId: me.data.accountId };
  }
  // Search by email
  const users = await atlassianFetch<Array<{ accountId: string }>>(
    "/rest/api/3/user/search",
    { query: { query: assignee } }
  );
  if (!users.ok || !Array.isArray(users.data) || users.data.length === 0) {
    return { accountId: null, error: `Could not find user "${assignee}"` };
  }
  return { accountId: users.data[0].accountId };
}
