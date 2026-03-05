# jt-mcp-server

[![CI](https://github.com/HoukasaurusRex/jt-mcp-server/actions/workflows/ci.yml/badge.svg)](https://github.com/HoukasaurusRex/jt-mcp-server/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@houkasaurusrex/jt-mcp-server)](https://www.npmjs.com/package/@houkasaurusrex/jt-mcp-server)

Personal [Model Context Protocol](https://modelcontextprotocol.io) server that gives AI agents dev workflow tools — GitHub project management, conventional commits, static file serving, nvm-aware command execution, visual regression testing, and more.

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
        "NETLIFY_AUTH_TOKEN": "${NETLIFY_AUTH_TOKEN}"
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
| `dev_visual_regression` | Orchestrate a full Playwright visual regression cycle: serve reference dir, capture baselines, serve test dir, run comparison, return results. |

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

### Netlify

| Tool | Description |
|------|-------------|
| `netlify_deploy_status` | Check the latest deploy status for a Netlify site. |

## Environment Variables

| Variable | Required for |
|----------|-------------|
| `GITHUB_TOKEN` | GitHub tools (PAT with `repo` + `project` scopes) |
| `NETLIFY_AUTH_TOKEN` | Netlify tools |

## Development

```bash
yarn install
yarn build
yarn test
yarn test <pattern>   # e.g. yarn test dev-port
```

## License

MIT
