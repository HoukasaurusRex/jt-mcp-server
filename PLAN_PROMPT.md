# Implementation Plan Prompt: Dev Workflow Tools

## Context

I'm working across several personal TypeScript projects (VuePress blog, NestJS monorepo, CDKTF infra) and I keep hitting the same friction points when using Claude Code as my primary development interface. I want to add tools to my MCP server that eliminate the repetitive, multi-step shell workflows that slow down every session.

This MCP server already has tools for GitHub project board management, conventional commits, and Netlify deploy checks. I need to extend it with **dev environment orchestration tools** that handle the plumbing so agents can focus on writing code.

## Friction Points Observed

### 1. Static Site Serving

Every visual regression test cycle requires:
- Kill any existing process on a port
- Serve a specific directory on that port
- Verify the server is responding
- Later, kill it and serve a different directory

This is 4+ separate shell commands that frequently fail due to quoting, backgrounding, and process management issues in agent contexts. Agents also lack visibility into whether a server is actually ready.

**Proposed tool: `dev_serve`**
- Input: `{ directory: string, port?: number (default 3000) }`
- Behavior: kill existing process on port, serve directory with `serve -s`, wait for 200 response, return URL
- Cleanup: `dev_serve_stop` to kill the server

### 2. Node Version Management

Different projects and branches require different Node versions. Switching requires `source ~/.nvm/nvm.sh && nvm use <version>` prepended to every command, and agents frequently forget or run commands under the wrong version.

**Proposed tool: `dev_run`**
- Input: `{ command: string, node_version?: string, cwd?: string, env?: Record<string, string> }`
- Behavior: wraps command execution with correct nvm version, working directory, and env vars
- Example: `dev_run({ command: "yarn build", node_version: "20", cwd: "/path/to/worktree", env: { NODE_OPTIONS: "--openssl-legacy-provider" } })`

### 3. Visual Regression Test Workflow

The full Playwright visual regression cycle is:
1. Build the reference branch (may need different Node version)
2. Serve the reference build
3. Run `pw:update` to capture baselines
4. Kill server
5. Build the feature branch
6. Serve the feature build
7. Run `pw:test` to verify failures
8. Fix code, rebuild, re-serve, re-test (repeat)

This is extremely tedious and error-prone. Each step depends on the previous one.

**Proposed tool: `dev_visual_regression`**
- Input: `{ reference_dir: string, test_dir: string, port?: number, update_baselines?: boolean }`
- Behavior: orchestrates the full serve-and-test cycle
- Returns: test results summary (pass/fail counts, diff pixel ratios)

### 4. Git Worktree Management

Creating and managing worktrees for multi-branch comparison is a common pattern:
- Create worktree for reference branch
- Install dependencies (with correct Node version)
- Build
- Clean up when done

**Proposed tool: `dev_worktree`**
- Input: `{ branch: string, action: "create" | "build" | "remove", node_version?: string, build_command?: string }`
- Behavior: manages worktree lifecycle at `.claude/worktrees/<branch>/`

### 5. Port/Process Management

Agents struggle with process management in non-interactive shells. Need a reliable way to:
- Check what's running on a port
- Kill processes by port
- Verify a port is free

**Proposed tool: `dev_port`**
- Input: `{ port: number, action: "check" | "kill" | "wait_ready" }`

## Priorities

1. **`dev_serve` + `dev_serve_stop`** — highest friction, used constantly during visual regression work
2. **`dev_run`** — solves Node version issues across all projects
3. **`dev_port`** — small utility, enables the others
4. **`dev_visual_regression`** — compound tool, can be built on top of the primitives
5. **`dev_worktree`** — nice to have, less frequent need

## Constraints

- Follow existing conventions in CLAUDE.md and AGENTS.md
- Use `execa` for process management
- Zod schemas in `types.ts`
- Error handling via `isError: true` return, never throw
- Tests in `src/__tests__/`
- Each tool file exports `register(server: McpServer): void`

## Questions to Resolve

1. Should `dev_serve` track server PIDs internally (in-memory map) or write them to a temp file for cross-session persistence?
2. Should `dev_run` use `execa` with a shell wrapper for nvm, or detect the node binary path directly from `~/.nvm/versions/node/`?
3. Should `dev_visual_regression` be a single compound tool or stay as separate primitives that agents orchestrate themselves?

## Deliverable

Create GitHub issues in project #15 for each tool, ordered by priority. Each issue should have:
- Clear acceptance criteria
- Input/output schema sketch
- Test scenarios
- Dependencies on other tools (if any)

Then begin implementation starting with the highest priority tool.
