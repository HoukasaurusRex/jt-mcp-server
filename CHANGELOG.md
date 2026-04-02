## [1.8.2](https://github.com/HoukasaurusRex/jt-mcp-server/compare/v1.8.1...v1.8.2) (2026-04-02)


### Bug Fixes

* ensure homebrew bin paths are in PATH for MCP server subprocess ([a519f18](https://github.com/HoukasaurusRex/jt-mcp-server/commit/a519f1859ae4dc8183b8720c5eab205da9b372d4))

## [1.8.1](https://github.com/HoukasaurusRex/jt-mcp-server/compare/v1.8.0...v1.8.1) (2026-03-30)


### Bug Fixes

* cap plan_from_ticket output to prevent 180K+ char responses ([e51f8de](https://github.com/HoukasaurusRex/jt-mcp-server/commit/e51f8de5a46f4452674a539abfab46acce5de4a5))

# [1.8.0](https://github.com/HoukasaurusRex/jt-mcp-server/compare/v1.7.0...v1.8.0) (2026-03-23)


### Features

* add plan_from_ticket and plan_review MCP tools ([136b56f](https://github.com/HoukasaurusRex/jt-mcp-server/commit/136b56f521d9b90dbbc6a430d89e2b86a387e091))
* add Slack search, channels, and history tools ([1684ead](https://github.com/HoukasaurusRex/jt-mcp-server/commit/1684eadb816a7bcbc71b7a43d461edf5e262f1b3))

# [1.7.0](https://github.com/HoukasaurusRex/jt-mcp-server/compare/v1.6.0...v1.7.0) (2026-03-20)


### Bug Fixes

* fall back to gh auth token when GITHUB_TOKEN env var is missing ([bb02ef6](https://github.com/HoukasaurusRex/jt-mcp-server/commit/bb02ef691cd2e6ed80204e4deacd7b37a71b9d61))


### Features

* add MCP resources for knowledge graph and mermaid visualization export ([33b682e](https://github.com/HoukasaurusRex/jt-mcp-server/commit/33b682ea7896b07a5f673941f23bd18e62d84759))
* add memory_context, memory_learn, and memory_reflect tools ([28122d1](https://github.com/HoukasaurusRex/jt-mcp-server/commit/28122d136fd2d4b5d427ef0a08890909db6ecdec))
* add semantic search with Ollama embeddings and multi-modal memory_query ([cc0f2bb](https://github.com/HoukasaurusRex/jt-mcp-server/commit/cc0f2bb4e52f8ff5843b688b20a74f69f54fc151))
* add strategy tools for prompt expansion from templates ([efb3bba](https://github.com/HoukasaurusRex/jt-mcp-server/commit/efb3bbaef4c2ebab0fdbdf521b72f5347f7b2107))
* add temporal tracking, confidence scoring, and event log to knowledge graph ([b4c31a8](https://github.com/HoukasaurusRex/jt-mcp-server/commit/b4c31a8c7749037fd1a37feaeffee42426d7e05a))
* add tool telemetry that logs every tool call to knowledge graph event_log ([a7d34f9](https://github.com/HoukasaurusRex/jt-mcp-server/commit/a7d34f96a251e8ba0486ba47352020520dadc364))

# [1.6.0](https://github.com/HoukasaurusRex/jt-mcp-server/compare/v1.5.0...v1.6.0) (2026-03-11)


### Features

* add journal_log tool for standup-style daily work summaries ([8e68414](https://github.com/HoukasaurusRex/jt-mcp-server/commit/8e684145fc2e18a2b7c17e1bdad41a1e03634ad5))

# [1.5.0](https://github.com/HoukasaurusRex/jt-mcp-server/compare/v1.4.0...v1.5.0) (2026-03-11)


### Features

* migrate jira tools from acli CLI to Atlassian REST API ([a6ab964](https://github.com/HoukasaurusRex/jt-mcp-server/commit/a6ab964eee081d6f22692bea6d8b04f2ad03b3aa))

# [1.4.0](https://github.com/HoukasaurusRex/jt-mcp-server/compare/v1.3.1...v1.4.0) (2026-03-10)


### Features

* add memory_track_action and memory_suggest_tools for pattern-based tool discovery ([6f02c3a](https://github.com/HoukasaurusRex/jt-mcp-server/commit/6f02c3a398d2d74d4257498fdc641daccc099448))

## [1.3.1](https://github.com/HoukasaurusRex/jt-mcp-server/compare/v1.3.0...v1.3.1) (2026-03-09)


### Bug Fixes

* replace better-sqlite3 with sql.js to eliminate native addon crashes ([62be05c](https://github.com/HoukasaurusRex/jt-mcp-server/commit/62be05c2f295c0cd8ccfc163b86fdafe0fd810ff))

# [1.3.0](https://github.com/HoukasaurusRex/jt-mcp-server/compare/v1.2.0...v1.3.0) (2026-03-09)


### Features

* add search, jira, confluence, and netlify debugging tools ([3bdfe9b](https://github.com/HoukasaurusRex/jt-mcp-server/commit/3bdfe9b79658a067c65bfd82ff554da6c4612e28))

# [1.2.0](https://github.com/HoukasaurusRex/jt-mcp-server/compare/v1.1.0...v1.2.0) (2026-03-09)


### Features

* add dev_install, dev_script, and dev_deps tools with shared package manager detection ([8a971a3](https://github.com/HoukasaurusRex/jt-mcp-server/commit/8a971a36ef56346ebd95853f9a5a0f9a2519cc7e))

# [1.1.0](https://github.com/HoukasaurusRex/jt-mcp-server/compare/v1.0.0...v1.1.0) (2026-03-06)


### Features

* add shell_lint tool, shared helpers, configurable timeouts, relaxed commit format, worktree list, and env-based GitHub project IDs ([cd0250f](https://github.com/HoukasaurusRex/jt-mcp-server/commit/cd0250f19f1488015edff9bbb74946a00721a086))

# 1.0.0 (2026-03-05)


### Features

* set correct package name and version in MCP server metadata ([6cd567f](https://github.com/HoukasaurusRex/jt-mcp-server/commit/6cd567f0800541dfc1d1eb7b136cc50a106efceb))
