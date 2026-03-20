/** Slack Web API client (Bearer token auth).
 *  Resolves token from SLACK_USER_TOKEN env var or Slack CLI credentials. */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export interface SlackConfig {
  token: string;
  authHeader: string;
}

let _config: SlackConfig | null = null;

const CREDENTIALS_PATH = join(homedir(), ".slack", "credentials.json");

/** Sync check: env var OR credentials file exists (used by registration gate). */
export function isSlackAvailable(): boolean {
  return !!process.env.SLACK_USER_TOKEN || existsSync(CREDENTIALS_PATH);
}

export function getSlackConfig(): SlackConfig {
  if (_config) return _config;

  let token = process.env.SLACK_USER_TOKEN;

  if (!token) {
    // Fallback: read Slack CLI credentials
    if (!existsSync(CREDENTIALS_PATH)) {
      throw new Error(
        "No Slack token found. Set SLACK_USER_TOKEN env var or install the Slack CLI and run `slack auth login`."
      );
    }

    let creds: Record<string, { token: string; team_domain?: string }>;
    try {
      creds = JSON.parse(readFileSync(CREDENTIALS_PATH, "utf-8"));
    } catch {
      throw new Error(`Failed to parse ${CREDENTIALS_PATH}. Run \`slack auth login\` to re-authenticate.`);
    }

    const teamIds = Object.keys(creds);
    if (teamIds.length === 0) {
      throw new Error("No teams found in Slack CLI credentials. Run `slack auth login`.");
    }

    if (teamIds.length === 1) {
      token = creds[teamIds[0]].token;
    } else {
      // Multiple teams — check SLACK_TEAM_ID
      const teamId = process.env.SLACK_TEAM_ID;
      if (teamId && creds[teamId]) {
        token = creds[teamId].token;
      } else {
        const teams = teamIds.map((id) => `  ${id} (${creds[id].team_domain ?? "unknown"})`).join("\n");
        throw new Error(
          `Multiple Slack teams found. Set SLACK_TEAM_ID to one of:\n${teams}`
        );
      }
    }
  }

  _config = {
    token,
    authHeader: `Bearer ${token}`,
  };
  return _config;
}

export interface SlackResponse<T = unknown> {
  ok: boolean;
  error?: string;
  data: T;
}

const REQUEST_TIMEOUT_MS = 30_000;
const SLACK_API_BASE = "https://slack.com/api";

export async function slackFetch<T = unknown>(
  method: string,
  params: Record<string, string | number | boolean | undefined> = {}
): Promise<SlackResponse<T>> {
  const config = getSlackConfig();

  const url = new URL(`${SLACK_API_BASE}/${method}`);
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined) url.searchParams.set(key, String(val));
  }

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: config.authHeader,
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  // Handle rate limiting before JSON parse
  if (res.status === 429) {
    const retryAfter = res.headers.get("Retry-After") ?? "unknown";
    return {
      ok: false,
      error: `Rate limited by Slack. Retry after ${retryAfter} seconds.`,
      data: {} as T,
    };
  }

  const data = (await res.json()) as T & { ok: boolean; error?: string };

  // Map auth errors to actionable messages
  if (!data.ok && (data.error === "token_expired" || data.error === "invalid_auth")) {
    return {
      ok: false,
      error: "Slack token expired or invalid. Run `slack auth login` to refresh, or set SLACK_USER_TOKEN.",
      data,
    };
  }

  return {
    ok: data.ok,
    error: data.error,
    data,
  };
}
