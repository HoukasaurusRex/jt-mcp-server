import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  ConfluenceSearchSchema,
  ConfluenceGetPageSchema,
  ConfluenceCreatePageSchema,
  ConfluenceUpdatePageSchema,
} from "../types.js";
import { textResult, errorResult } from "../lib/tool-result.js";
import { atlassianFetch } from "../lib/atlassian-client.js";

export function register(server: McpServer): void {
  // ── confluence_search ─────────────────────────────────────────────
  server.registerTool(
    "confluence_search",
    {
      description:
        "Search Confluence pages using CQL (Confluence Query Language). " +
        "Returns page IDs, titles, spaces, and excerpts.",
      inputSchema: ConfluenceSearchSchema,
    },
    async ({ cql, max_results }) => {
      try {
        const res = await atlassianFetch<{
          results: Array<{
            content?: {
              id: string;
              title: string;
              type: string;
              _links: { webui: string };
              space?: { key: string; name: string };
            };
            excerpt?: string;
          }>;
          totalSize: number;
        }>("/wiki/rest/api/search", {
          query: { cql, limit: max_results },
        });

        if (!res.ok) {
          return errorResult(
            `Confluence search failed (${res.status}): ${JSON.stringify(res.data)}`
          );
        }

        const pages = res.data.results
          .filter((r) => r.content)
          .map((r) => ({
            id: r.content!.id,
            title: r.content!.title,
            type: r.content!.type,
            space: r.content!.space?.key ?? null,
            spaceName: r.content!.space?.name ?? null,
            url: r.content!._links.webui,
            excerpt: r.excerpt ?? null,
          }));

        return textResult(
          JSON.stringify(
            { total: res.data.totalSize, count: pages.length, pages },
            null,
            2
          )
        );
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── confluence_get_page ───────────────────────────────────────────
  server.registerTool(
    "confluence_get_page",
    {
      description:
        "Read a Confluence page by ID. Returns the title, body content, version, and space info.",
      inputSchema: ConfluenceGetPageSchema,
    },
    async ({ page_id, format }) => {
      try {
        const expand = `body.${format},version,space`;
        const res = await atlassianFetch<{
          id: string;
          title: string;
          space: { key: string; name: string };
          version: { number: number; when: string; by: { displayName: string } };
          body: Record<string, { value: string }>;
          _links: { webui: string };
        }>(`/wiki/rest/api/content/${encodeURIComponent(page_id)}`, {
          query: { expand },
        });

        if (!res.ok) {
          return errorResult(
            `Failed to get page (${res.status}): ${JSON.stringify(res.data)}`
          );
        }

        const page = res.data;
        return textResult(
          JSON.stringify(
            {
              id: page.id,
              title: page.title,
              space: page.space.key,
              spaceName: page.space.name,
              version: page.version.number,
              lastModified: page.version.when,
              lastModifiedBy: page.version.by.displayName,
              url: page._links.webui,
              body: page.body[format]?.value ?? "",
            },
            null,
            2
          )
        );
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── confluence_create_page ────────────────────────────────────────
  server.registerTool(
    "confluence_create_page",
    {
      description:
        "Create a new Confluence page in a space. Body should be XHTML storage format.",
      inputSchema: ConfluenceCreatePageSchema,
    },
    async ({ space_key, title, body, parent_id }) => {
      try {
        const payload: Record<string, unknown> = {
          type: "page",
          title,
          space: { key: space_key },
          body: {
            storage: { value: body, representation: "storage" },
          },
        };

        if (parent_id) {
          payload.ancestors = [{ id: parent_id }];
        }

        const res = await atlassianFetch<{
          id: string;
          title: string;
          _links: { webui: string };
        }>("/wiki/rest/api/content", { method: "POST", body: payload });

        if (!res.ok) {
          return errorResult(
            `Failed to create page (${res.status}): ${JSON.stringify(res.data)}`
          );
        }

        return textResult(
          JSON.stringify(
            {
              id: res.data.id,
              title: res.data.title,
              url: res.data._links.webui,
            },
            null,
            2
          )
        );
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    }
  );

  // ── confluence_update_page ────────────────────────────────────────
  server.registerTool(
    "confluence_update_page",
    {
      description:
        "Update an existing Confluence page. Automatically increments the version number. " +
        "Body should be XHTML storage format.",
      inputSchema: ConfluenceUpdatePageSchema,
    },
    async ({ page_id, title, body, version_comment }) => {
      try {
        // Get current version to increment
        const current = await atlassianFetch<{
          title: string;
          version: { number: number };
        }>(`/wiki/rest/api/content/${encodeURIComponent(page_id)}`, {
          query: { expand: "version" },
        });

        if (!current.ok) {
          return errorResult(
            `Failed to get current page (${current.status}): ${JSON.stringify(current.data)}`
          );
        }

        const newVersion = current.data.version.number + 1;
        const pageTitle = title ?? current.data.title;

        const payload: Record<string, unknown> = {
          type: "page",
          title: pageTitle,
          body: {
            storage: { value: body, representation: "storage" },
          },
          version: {
            number: newVersion,
            ...(version_comment ? { message: version_comment } : {}),
          },
        };

        const res = await atlassianFetch<{
          id: string;
          title: string;
          version: { number: number };
          _links: { webui: string };
        }>(`/wiki/rest/api/content/${encodeURIComponent(page_id)}`, {
          method: "PUT",
          body: payload,
        });

        if (!res.ok) {
          return errorResult(
            `Failed to update page (${res.status}): ${JSON.stringify(res.data)}`
          );
        }

        return textResult(
          JSON.stringify(
            {
              id: res.data.id,
              title: res.data.title,
              version: res.data.version.number,
              url: res.data._links.webui,
            },
            null,
            2
          )
        );
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    }
  );
}
