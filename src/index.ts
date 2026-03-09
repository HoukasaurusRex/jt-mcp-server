#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { register as registerDevPort } from "./tools/dev-port.js";
import { register as registerDevServe } from "./tools/dev-serve.js";
import { register as registerDevRun } from "./tools/dev-run.js";
import { register as registerDevInstall } from "./tools/dev-install.js";
import { register as registerDevScript } from "./tools/dev-script.js";
import { register as registerDevDeps } from "./tools/dev-deps.js";
import { register as registerDevWorktree } from "./tools/dev-worktree.js";
import { register as registerDevVisualRegression } from "./tools/dev-visual-regression.js";
import { register as registerGitHub } from "./tools/github.js";
import { register as registerGit } from "./tools/git.js";
import { register as registerNetlify } from "./tools/netlify.js";
import { register as registerShell } from "./tools/shell.js";
import { register as registerSearch } from "./tools/search.js";
import { register as registerJira } from "./tools/jira.js";
import { register as registerConfluence } from "./tools/confluence.js";
import { register as registerMemory } from "./tools/memory.js";

const server = new McpServer({
  name: "@houkasaurusrex/jt-mcp-server",
  version: "0.0.0",
});

const toolGroups: [string, (s: typeof server) => void][] = [
  ["dev-port", registerDevPort],
  ["dev-serve", registerDevServe],
  ["dev-run", registerDevRun],
  ["dev-install", registerDevInstall],
  ["dev-script", registerDevScript],
  ["dev-deps", registerDevDeps],
  ["dev-worktree", registerDevWorktree],
  ["dev-visual-regression", registerDevVisualRegression],
  ["github", registerGitHub],
  ["git", registerGit],
  ["netlify", registerNetlify],
  ["shell", registerShell],
  ["search", registerSearch],
  ["jira", registerJira],
  ["confluence", registerConfluence],
  ["memory", registerMemory],
];

for (const [name, register] of toolGroups) {
  try {
    register(server);
  } catch (err) {
    console.error(`[jt-mcp] Failed to register ${name} tools:`, err);
  }
}

const transport = new StdioServerTransport();
await server.connect(transport);
