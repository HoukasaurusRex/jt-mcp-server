import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execa } from "execa";
import {
  NetlifyDeployStatusSchema,
  NetlifyBuildLogSchema,
  NetlifyFunctionLogSchema,
  NetlifyListDeploysSchema,
  NetlifyListFunctionsSchema,
} from "../types.js";
import { textResult, errorResult } from "../lib/tool-result.js";

/** Call `netlify api <operation>` and return parsed JSON. */
async function netlifyApi<T = unknown>(
  operation: string,
  data: Record<string, unknown>
): Promise<T> {
  const { stdout } = await execa("netlify", [
    "api",
    operation,
    "--data",
    JSON.stringify(data),
  ]);
  return JSON.parse(stdout) as T;
}

/** Get the latest deploy ID for a site. */
async function getLatestDeployId(siteName: string): Promise<string> {
  const deploys = await netlifyApi<Array<{ id: string }>>("listSiteDeploys", {
    site_id: siteName,
    per_page: 1,
  });
  if (!Array.isArray(deploys) || deploys.length === 0) {
    throw new Error(`No deploys found for site: ${siteName}`);
  }
  return deploys[0].id;
}

export function register(server: McpServer): void {
  // ── netlify_deploy_status ─────────────────────────────────────────
  server.registerTool(
    "netlify_deploy_status",
    {
      description: "Check the latest deploy status for a Netlify site",
      inputSchema: NetlifyDeployStatusSchema,
    },
    async ({ site_name }) => {
      try {
        const deploys = await netlifyApi<
          Array<{
            id: string;
            state: string;
            branch: string;
            deploy_ssl_url?: string;
            deploy_url?: string;
            created_at: string;
            error_message?: string;
            title?: string;
          }>
        >("listSiteDeploys", { site_id: site_name, per_page: 1 });

        if (!Array.isArray(deploys) || deploys.length === 0) {
          return textResult(`No deploys found for site: ${site_name}`);
        }

        const deploy = deploys[0];
        const summary = {
          id: deploy.id,
          state: deploy.state,
          branch: deploy.branch,
          deploy_url: deploy.deploy_ssl_url || deploy.deploy_url,
          created_at: deploy.created_at,
          error_message: deploy.error_message || null,
          title: deploy.title || null,
        };

        return textResult(JSON.stringify(summary, null, 2));
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── netlify_build_log ─────────────────────────────────────────────
  server.registerTool(
    "netlify_build_log",
    {
      description:
        "Get build/deploy logs for a Netlify site. " +
        "Returns the last N lines of the build log. " +
        "Useful for diagnosing failed deploys and CI issues.",
      inputSchema: NetlifyBuildLogSchema,
    },
    async ({ site_name, deploy_id, tail }) => {
      try {
        const id = deploy_id ?? (await getLatestDeployId(site_name));

        const deploy = await netlifyApi<{
          id: string;
          state: string;
          branch: string;
          error_message?: string;
          summary?: { status: string; messages: Array<{ type: string; title: string; description: string }> };
        }>("getDeploy", { deploy_id: id });

        // Get build log via the site builds endpoint
        const builds = await netlifyApi<
          Array<{
            id: string;
            deploy_id: string;
            done: boolean;
            error: string;
            log: Array<{ message: string }>;
          }>
        >("listSiteBuilds", { site_id: site_name, per_page: 5 });

        const build = builds.find((b) => b.deploy_id === id) ?? builds[0];

        let logLines: string[] = [];

        if (build?.id) {
          // Fetch full build log
          const buildLog = await netlifyApi<
            Array<{ message: string }>
          >("listSiteBuildLog", { build_id: build.id });

          if (Array.isArray(buildLog)) {
            logLines = buildLog.map((entry) => entry.message);
          }
        }

        // Build output with deploy context + log
        const header = [
          `Deploy: ${id}`,
          `State: ${deploy.state}`,
          `Branch: ${deploy.branch}`,
        ];

        if (deploy.error_message) {
          header.push(`Error: ${deploy.error_message}`);
        }

        if (deploy.summary?.messages?.length) {
          for (const msg of deploy.summary.messages) {
            header.push(`[${msg.type}] ${msg.title}: ${msg.description}`);
          }
        }

        // Take last N lines
        const trimmed = logLines.slice(-tail);
        const output = [
          ...header,
          "",
          `── Build log (last ${trimmed.length} of ${logLines.length} lines) ──`,
          ...trimmed,
        ];

        return textResult(output.join("\n"));
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── netlify_function_log ──────────────────────────────────────────
  server.registerTool(
    "netlify_function_log",
    {
      description:
        "Stream recent function invocation logs for a Netlify site. " +
        "Uses `netlify functions:log` to capture the latest output. " +
        "Useful for debugging serverless function errors.",
      inputSchema: NetlifyFunctionLogSchema,
    },
    async ({ site_name, function_name }) => {
      try {
        const args = ["functions:log", "--site", site_name];
        if (function_name) args.push("--name", function_name);

        // functions:log streams indefinitely, so we use a timeout to capture recent output
        const result = await execa("netlify", args, {
          reject: false,
          timeout: 10000,
        });

        // Timeout exit is expected — we just want whatever was captured
        const output = [result.stdout, result.stderr].filter(Boolean).join("\n");

        if (!output.trim()) {
          return textResult(
            function_name
              ? `No recent logs for function "${function_name}" on site ${site_name}. The function may not have been invoked recently.`
              : `No recent function logs for site ${site_name}.`
          );
        }

        return textResult(output);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("ENOENT")) {
          return errorResult(
            "netlify CLI not found. Install it: npm install -g netlify-cli"
          );
        }
        return errorResult(msg);
      }
    }
  );

  // ── netlify_list_deploys ──────────────────────────────────────────
  server.registerTool(
    "netlify_list_deploys",
    {
      description:
        "List recent deploys for a Netlify site with status, branch, and error info. " +
        "Useful for finding a specific deploy ID to inspect further.",
      inputSchema: NetlifyListDeploysSchema,
    },
    async ({ site_name, limit }) => {
      try {
        const deploys = await netlifyApi<
          Array<{
            id: string;
            state: string;
            branch: string;
            created_at: string;
            deploy_ssl_url?: string;
            deploy_url?: string;
            error_message?: string;
            title?: string;
            context?: string;
            review_id?: number;
          }>
        >("listSiteDeploys", { site_id: site_name, per_page: limit });

        if (!Array.isArray(deploys) || deploys.length === 0) {
          return textResult(`No deploys found for site: ${site_name}`);
        }

        const summary = deploys.map((d) => ({
          id: d.id,
          state: d.state,
          branch: d.branch,
          context: d.context ?? null,
          created_at: d.created_at,
          url: d.deploy_ssl_url || d.deploy_url || null,
          error: d.error_message || null,
          title: d.title || null,
        }));

        return textResult(JSON.stringify(summary, null, 2));
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── netlify_list_functions ────────────────────────────────────────
  server.registerTool(
    "netlify_list_functions",
    {
      description:
        "List all deployed serverless functions for a Netlify site. " +
        "Returns function names, IDs, and runtime info.",
      inputSchema: NetlifyListFunctionsSchema,
    },
    async ({ site_name }) => {
      try {
        // Get the latest deploy to find its functions
        const deployId = await getLatestDeployId(site_name);

        const functions = await netlifyApi<
          Array<{
            id: string;
            name: string;
            sha: string;
            runtime?: string;
          }>
        >("listDeployFunctions", { deploy_id: deployId });

        if (!Array.isArray(functions) || functions.length === 0) {
          return textResult(`No functions found for site: ${site_name}`);
        }

        const summary = functions.map((f) => ({
          name: f.name,
          id: f.id,
          runtime: f.runtime ?? null,
        }));

        return textResult(JSON.stringify(summary, null, 2));
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    }
  );
}
