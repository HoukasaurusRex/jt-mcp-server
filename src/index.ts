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
import { register as registerSlack } from "./tools/slack.js";
import { isSlackAvailable } from "./lib/slack-client.js";
import { register as registerMemoryResources } from "./resources/memory.js";

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
  ["memory-resources", registerMemoryResources],
  ["journal", registerJournal],
  ["strategy", registerStrategy],
];

// Optional tools — registered when their gate condition is met
type ToolGate = string | (() => boolean);
const conditionalGroups: [string, (s: typeof server) => void, ToolGate][] = [
  ["netlify", registerNetlify, "NETLIFY_AUTH_TOKEN"],
  ["jira", registerJira, "ATLASSIAN_DOMAIN"],
  ["confluence", registerConfluence, "ATLASSIAN_DOMAIN"],
  ["search", registerSearch, "JT_MCP_ENABLE_SEARCH"],
  ["slack", registerSlack, isSlackAvailable],
];

for (const [name, register] of coreGroups) {
  try {
    register(server);
  } catch (err) {
    console.error(`[jt-mcp] Failed to register ${name} tools:`, err);
  }
}

for (const [name, register, gate] of conditionalGroups) {
  const enabled = typeof gate === "string" ? !!process.env[gate] : gate();
  if (!enabled) continue;
  try {
    register(server);
  } catch (err) {
    console.error(`[jt-mcp] Failed to register ${name} tools:`, err);
  }
}

const transport = new StdioServerTransport();
await server.connect(transport);
