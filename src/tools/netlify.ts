import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { execa } from "execa";
import { NetlifyDeployStatusSchema } from "../types.js";

export function register(server: McpServer): void {
  server.registerTool(
    "netlify_deploy_status",
    {
      description: "Check the latest deploy status for a Netlify site",
      inputSchema: NetlifyDeployStatusSchema,
    },
    async ({ site_name }) => {
      try {
        const { stdout } = await execa("netlify", [
          "api",
          "listSiteDeploys",
          "--data",
          JSON.stringify({ site_id: site_name, per_page: 1 }),
        ]);

        const deploys = JSON.parse(stdout);
        if (!Array.isArray(deploys) || deploys.length === 0) {
          return {
            content: [
              { type: "text", text: `No deploys found for site: ${site_name}` },
            ],
          };
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

        return {
          content: [
            { type: "text", text: JSON.stringify(summary, null, 2) },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: message }],
          isError: true,
        };
      }
    }
  );
}
