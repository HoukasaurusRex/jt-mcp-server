# jt-mcp-server

[![CI](https://github.com/HoukasaurusRex/jt-mcp-server/actions/workflows/ci.yml/badge.svg)](https://github.com/HoukasaurusRex/jt-mcp-server/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@houkasaurusrex/jt-mcp-server)](https://www.npmjs.com/package/@houkasaurusrex/jt-mcp-server)

Personal [Model Context Protocol](https://modelcontextprotocol.io) server that gives AI agents dev workflow tools — GitHub project management, conventional commits, static file serving, nvm-aware command execution, visual regression testing, Jira/Confluence integration, and more.

## Quick Start

```bash
npx @houkasaurusrex/jt-mcp-server
```

## Add to Claude Code

In your project's `.claude/settings.json`:

```json
{
  "mcpServers": {
    "jt-mcp": {
      "command": "npx",
      "args": ["-y", "@houkasaurusrex/jt-mcp-server"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}",
        "NETLIFY_AUTH_TOKEN": "${NETLIFY_AUTH_TOKEN}",
        "ATLASSIAN_DOMAIN": "${ATLASSIAN_DOMAIN}",
        "ATLASSIAN_EMAIL": "${ATLASSIAN_EMAIL}",
        "ATLASSIAN_API_TOKEN": "${ATLASSIAN_API_TOKEN}"
      }
    }
  }
}
```

## Tools

### Dev Workflow

| Tool | Description |
|------|-------------|
| `dev_serve` | Serve a directory on a port. Kills existing process on that port, starts `serve -s`, waits for 200 response, returns URL. |
| `dev_serve_stop` | Stop a dev server by port. |
| `dev_run` | Run a shell command with optional nvm Node version, working directory, and env vars. Resolves Node binary directly from `~/.nvm/versions/node/`. |
| `dev_port` | Port management — `check` what's using a port, `kill` process on a port, `wait_ready` until a port accepts connections. |
| `dev_worktree` | Git worktree lifecycle — `create` (checkout + install deps), `build` (run build command), `remove` (clean up). Worktrees live at `.claude/worktrees/<branch>/`. |
| `dev_install` | Install project dependencies using the correct package manager (auto-detected from lockfile). Supports frozen/immutable lockfile mode for CI. |
| `dev_script` | Run a package.json script by name with the correct package manager. Validates the script exists and lists available scripts on error. |
| `dev_deps` | Add or remove npm packages using the correct package manager. Supports devDependencies. |
| `dev_visual_regression` | Orchestrate a full Playwright visual regression cycle: serve reference dir, capture baselines, serve test dir, run comparison, return results. |

### Search & Exploration

| Tool | Description |
|------|-------------|
| `dev_grep` | Search file contents for patterns (regex or literal) with context lines, glob filtering. Respects `.gitignore`. Uses ripgrep. |
| `dev_find` | Find files/directories by glob pattern. Respects `.gitignore`. Uses `fd` with `git ls-files` fallback. |
| `dev_read` | Read file contents with line numbers, optional line ranges, binary detection, and path traversal protection. |
| `dev_tree` | Display directory tree structure. Skips `node_modules`, `.git`, build artifacts, and other common noise. |

### GitHub

| Tool | Description |
|------|-------------|
| `github_project_next_issue` | Get the oldest "Todo" issue from a GitHub ProjectV2 board. |
| `github_project_set_status` | Update a project item's status (Todo / In Progress / Done). |
| `github_project_complete_issue` | Close a GitHub issue and set its project board status to Done in one call. |
| `github_create_pr` | Create a pull request via `gh` CLI. |

### Git

| Tool | Description |
|------|-------------|
| `git_conventional_commit` | Stage files and create a conventional commit. Validates message format, refuses to stage `.env` or `node_modules`. |

### Jira (via `acli` CLI)

Requires the [Atlassian CLI](https://developer.atlassian.com/cloud/acli/guides/install-acli/) — run `acli auth login` once to authenticate.

| Tool | Description |
|------|-------------|
| `jira_search` | Search issues with JQL, configurable fields and result limits. |
| `jira_get_issue` | Get full details of an issue by key. |
| `jira_create_issue` | Create issues (Task, Bug, Story, Epic) with description, assignee, labels, parent. |
| `jira_transition` | Transition issue status (e.g. "In Progress", "Done"). |
| `jira_add_comment` | Add a comment to an issue. |
| `jira_assign` | Assign (`user@email`, `@me`) or unassign an issue. |

### Confluence (REST API)

Requires `ATLASSIAN_DOMAIN`, `ATLASSIAN_EMAIL`, and `ATLASSIAN_API_TOKEN` env vars.

| Tool | Description |
|------|-------------|
| `confluence_search` | Search pages with CQL, returns IDs, titles, spaces, excerpts. |
| `confluence_get_page` | Read page content (storage XHTML, rendered HTML, or ADF). |
| `confluence_create_page` | Create a page in a space, optional parent for child pages. |
| `confluence_update_page` | Update page body/title with auto-incremented version. |

### Shell

| Tool | Description |
|------|-------------|
| `shell_lint` | Run ShellCheck on shell scripts. Returns structured JSON findings with file, line, level, and message. |

### Netlify

| Tool | Description |
|------|-------------|
| `netlify_deploy_status` | Check the latest deploy status for a Netlify site. |
| `netlify_build_log` | Get build/deploy logs (last N lines) for diagnosing failed deploys and CI issues. |
| `netlify_function_log` | Stream recent serverless function invocation logs for debugging. |
| `netlify_list_deploys` | List recent deploys with status, branch, context, and error info. |
| `netlify_list_functions` | List all deployed serverless functions for a site. |

### Memory (Knowledge Graph)

| Tool | Description |
|------|-------------|
| `memory_add_entities` | Create entities (preferences, tools, projects, conventions) with a name, type, and observations. |
| `memory_add_relations` | Create typed directed relations between entities (e.g. PREFERS, USES, AVOIDS). |
| `memory_add_observations` | Add facts or notes to an existing entity. |
| `memory_query` | Search and traverse the knowledge graph by name, type, or relation. |
| `memory_delete` | Delete entities (cascades), relations, or observations. |
| `memory_export` | Export the entire graph as JSON. |
| `memory_import` | Import a graph from JSON (merge or replace). |
| `memory_track_action` | Track a repeatable action (build, test, deploy, lint) for pattern detection. |
| `memory_suggest_tools` | Analyze tracked actions to find patterns that could become new MCP tools. |

## Using the Memory Database

The memory tools provide a persistent knowledge graph that agents can use to remember user preferences, project conventions, and facts across sessions. Data is stored in a SQLite database at `~/.jt-memory/memory.db` and auto-exported to `~/.jt-memory/memory.json` on every write.

### Enabling memory in a project

Add the following to your project's `CLAUDE.md` so the agent knows to use memory at the start of each session:

```markdown
## Memory

This project uses `@houkasaurusrex/jt-mcp-server` memory tools. At the start of every session:
1. Call `memory_query` with no filters to load all stored context
2. Use the returned entities, observations, and relations to inform your work
3. When you learn new user preferences or project conventions, store them with `memory_add_entities` and `memory_add_observations`
```

### How it works

- **Entities** have a name, type, and observations (facts). Types include `preference`, `convention`, `project`, `tool`, `workflow`, etc.
- **Relations** are directed edges between entities (e.g. `JT` --PREFERS--> `Yarn Berry`).
- **Observations** are string facts attached to an entity (e.g. "Always uses single-line conventional commits").
- The database persists at `~/.jt-memory/memory.db` across all projects and sessions.
- Every write auto-exports to `~/.jt-memory/memory.json` as a human-readable backup.
- Override paths with `JT_MEMORY_DB` and `JT_MEMORY_EXPORT_PATH` env vars.

### Action tracking

The memory system can track repeatable actions agents perform across projects and suggest when patterns should become dedicated MCP tools.

**Tracking an action:**

```json
{ "command": "yarn lint --fix", "description": "Auto-fix lint issues", "project": "my-app", "tags": ["lint", "fix"], "category": "lint" }
```

**Checking for tool suggestions:**

```json
{ "min_occurrences": 3, "min_projects": 2 }
```

Returns exact command matches and tag-based clusters that exceed the thresholds, with suggestions for which patterns are good candidates for new tools.

Add the following to your project's `CLAUDE.md` to enable action tracking:

```markdown
### Action Tracking

When performing substantive, repeatable actions (build, test, deploy, lint, format, git workflow),
call `memory_track_action` with command, description, project, tags, and category.
Do NOT track trivial commands (ls, cd, file reads, one-off searches).

Periodically call `memory_suggest_tools` to discover patterns worth converting to MCP tools.
```

### Example: storing a preference

```json
{ "entities": [{ "name": "commits", "type": "convention", "observations": ["Single-line conventional commits", "No Co-Authored-By trailers"] }] }
```

### Example: querying at session start

```json
{}                                // returns all entities
{ "type": "preference" }         // returns only preferences
{ "name": "yarn", "depth": 2 }   // traverse 2 levels from matching entities
```

## Environment Variables

| Variable | Required for |
|----------|-------------|
| `GITHUB_TOKEN` | GitHub tools (PAT with `repo` + `project` scopes) |
| `NETLIFY_AUTH_TOKEN` | Netlify tools |
| `ATLASSIAN_DOMAIN` | Confluence tools (e.g. `mycompany.atlassian.net`) |
| `ATLASSIAN_EMAIL` | Confluence tools (account email) |
| `ATLASSIAN_API_TOKEN` | Confluence tools ([create one](https://id.atlassian.com/manage-profile/security/api-tokens)) |

Jira tools use the `acli` CLI which handles its own auth — run `acli auth login` once.

## Development

```bash
yarn install
yarn build
yarn test
yarn test <pattern>   # e.g. yarn test dev-port
```

## License

MIT
