#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { register as registerDevWorktree } from "./tools/dev-worktree.js";
import { register as registerDevVisualRegression } from "./tools/dev-visual-regression.js";
import { register as registerGitHub } from "./tools/github.js";
import { register as registerGit } from "./tools/git.js";
import { register as registerMemory } from "./tools/memory.js";
import { register as registerJournal } from "./tools/journal.js";
import { register as registerStrategy } from "./tools/strategy.js";
import { register as registerNetlify } from "./tools/netlify.js";
import { register as registerJira } from "./tools/jira.js";
import { register as registerConfluence } from "./tools/confluence.js";
import { register as registerSearch } from "./tools/search.js";

const server = new McpServer({
  name: "@houkasaurusrex/jt-mcp-server",
  version: "0.0.0",
});

// Core tools — always registered
const coreGroups: [string, (s: typeof server) => void][] = [
  ["dev-worktree", registerDevWorktree],
  ["dev-visual-regression", registerDevVisualRegression],
  ["github", registerGitHub],
  ["git", registerGit],
  ["memory", registerMemory],
  ["journal", registerJournal],
  ["strategy", registerStrategy],
];

// Optional tools — registered when their env var is present
const conditionalGroups: [string, (s: typeof server) => void, string][] = [
  ["netlify", registerNetlify, "NETLIFY_AUTH_TOKEN"],
  ["jira", registerJira, "ATLASSIAN_DOMAIN"],
  ["confluence", registerConfluence, "ATLASSIAN_DOMAIN"],
  ["search", registerSearch, "JT_MCP_ENABLE_SEARCH"],
];

for (const [name, register] of coreGroups) {
  try {
    register(server);
  } catch (err) {
    console.error(`[jt-mcp] Failed to register ${name} tools:`, err);
  }
}

for (const [name, register, envVar] of conditionalGroups) {
  if (!process.env[envVar]) continue;
  try {
    register(server);
  } catch (err) {
    console.error(`[jt-mcp] Failed to register ${name} tools:`, err);
  }
}

const transport = new StdioServerTransport();
await server.connect(transport);
