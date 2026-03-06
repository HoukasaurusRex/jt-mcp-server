#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { register as registerDevPort } from "./tools/dev-port.js";
import { register as registerDevServe } from "./tools/dev-serve.js";
import { register as registerDevRun } from "./tools/dev-run.js";
import { register as registerDevWorktree } from "./tools/dev-worktree.js";
import { register as registerDevVisualRegression } from "./tools/dev-visual-regression.js";
import { register as registerGitHub } from "./tools/github.js";
import { register as registerGit } from "./tools/git.js";
import { register as registerNetlify } from "./tools/netlify.js";
import { register as registerShell } from "./tools/shell.js";
import { register as registerMemory } from "./tools/memory.js";

const server = new McpServer({
  name: "@houkasaurusrex/jt-mcp-server",
  version: "0.0.0",
});

registerDevPort(server);
registerDevServe(server);
registerDevRun(server);
registerDevWorktree(server);
registerDevVisualRegression(server);
registerGitHub(server);
registerGit(server);
registerNetlify(server);
registerShell(server);
registerMemory(server);

const transport = new StdioServerTransport();
await server.connect(transport);
