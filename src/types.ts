import { z } from "zod";

// === dev_worktree ===
export const DevWorktreeSchema = z.object({
  branch: z.string().describe("Git branch name"),
  action: z
    .enum(["create", "build", "remove", "list"])
    .describe(
      "create: create worktree and install deps; build: run build command in worktree; remove: clean up worktree; list: show all worktrees"
    ),
  node_version: z
    .string()
    .optional()
    .describe("Node version to use via nvm"),
  build_command: z
    .string()
    .optional()
    .describe("Build command (default: 'yarn build')"),
});
export type DevWorktreeInput = z.infer<typeof DevWorktreeSchema>;

// === dev_visual_regression ===
export const DevVisualRegressionSchema = z.object({
  reference_dir: z
    .string()
    .describe("Absolute path to the reference (baseline) build directory"),
  test_dir: z
    .string()
    .describe("Absolute path to the test (feature) build directory"),
  port: z
    .number()
    .int()
    .min(1)
    .max(65535)
    .default(3000)
    .describe("Port to serve on (default 3000)"),
  update_baselines: z
    .boolean()
    .default(false)
    .describe("If true, capture new baselines from reference_dir instead of comparing"),
  test_command: z
    .string()
    .default("yarn pw:test")
    .describe("Playwright test command (default: 'yarn pw:test')"),
  update_command: z
    .string()
    .default("yarn pw:update")
    .describe("Playwright update baselines command (default: 'yarn pw:update')"),
  startup_timeout: z
    .number()
    .int()
    .positive()
    .default(15000)
    .describe("Max ms to wait for serve to respond (default 15000)"),
});
export type DevVisualRegressionInput = z.infer<typeof DevVisualRegressionSchema>;

// === github tools ===
export const GitHubProjectNextIssueSchema = z.object({
  project_id: z
    .string()
    .default(process.env.GITHUB_PROJECT_ID ?? "PVT_kwHOAWmP0M4BQ4Fi")
    .describe("GitHub ProjectV2 node ID (env: GITHUB_PROJECT_ID)"),
  status_field_id: z
    .string()
    .default(process.env.GITHUB_STATUS_FIELD_ID ?? "PVTSSF_lAHOAWmP0M4BQ4Fizg-3q2k")
    .describe("Status field ID (env: GITHUB_STATUS_FIELD_ID)"),
  todo_option_id: z
    .string()
    .default(process.env.GITHUB_TODO_OPTION_ID ?? "f75ad846")
    .describe("Option ID for Todo status (env: GITHUB_TODO_OPTION_ID)"),
});
export type GitHubProjectNextIssueInput = z.infer<typeof GitHubProjectNextIssueSchema>;

export const GitHubProjectSetStatusSchema = z.object({
  project_id: z
    .string()
    .default(process.env.GITHUB_PROJECT_ID ?? "PVT_kwHOAWmP0M4BQ4Fi")
    .describe("GitHub ProjectV2 node ID (env: GITHUB_PROJECT_ID)"),
  item_id: z.string().describe("Project item node ID"),
  status_field_id: z
    .string()
    .default(process.env.GITHUB_STATUS_FIELD_ID ?? "PVTSSF_lAHOAWmP0M4BQ4Fizg-3q2k")
    .describe("Status field ID (env: GITHUB_STATUS_FIELD_ID)"),
  status_option_id: z
    .string()
    .describe("Option ID for the desired status (Todo/In Progress/Done)"),
});
export type GitHubProjectSetStatusInput = z.infer<typeof GitHubProjectSetStatusSchema>;

export const GitHubProjectCompleteIssueSchema = z.object({
  issue_number: z.number().int().positive().describe("GitHub issue number to close"),
  repo: z
    .string()
    .optional()
    .describe("Repository in owner/name format (default: current repo)"),
  item_id: z.string().describe("Project item node ID to set to Done"),
  project_id: z
    .string()
    .default(process.env.GITHUB_PROJECT_ID ?? "PVT_kwHOAWmP0M4BQ4Fi")
    .describe("GitHub ProjectV2 node ID (env: GITHUB_PROJECT_ID)"),
  status_field_id: z
    .string()
    .default(process.env.GITHUB_STATUS_FIELD_ID ?? "PVTSSF_lAHOAWmP0M4BQ4Fizg-3q2k")
    .describe("Status field ID (env: GITHUB_STATUS_FIELD_ID)"),
  done_option_id: z
    .string()
    .default(process.env.GITHUB_DONE_OPTION_ID ?? "98236657")
    .describe("Option ID for Done status (env: GITHUB_DONE_OPTION_ID)"),
});
export type GitHubProjectCompleteIssueInput = z.infer<typeof GitHubProjectCompleteIssueSchema>;

export const GitHubCreatePRSchema = z.object({
  title: z.string().describe("PR title"),
  body: z.string().optional().describe("PR body/description"),
  base: z.string().default("main").describe("Base branch (default: main)"),
  head: z.string().optional().describe("Head branch (default: current branch)"),
  draft: z.boolean().default(false).describe("Create as draft PR"),
});
export type GitHubCreatePRInput = z.infer<typeof GitHubCreatePRSchema>;

// === git tools ===
export const GitConventionalCommitSchema = z.object({
  message: z
    .string()
    .describe(
      "Conventional commit message (e.g. 'feat: add new tool'). Must match <type>: <description>"
    ),
  files: z
    .array(z.string())
    .optional()
    .describe(
      "Files to stage before committing. If omitted, commits currently staged files."
    ),
  strict: z
    .boolean()
    .default(true)
    .describe(
      "If true, enforce standard conventional commit types (feat, fix, docs, etc). If false, allow any <word>: <description> format."
    ),
});
export type GitConventionalCommitInput = z.infer<typeof GitConventionalCommitSchema>;

// === netlify tools ===
export const NetlifyDeployStatusSchema = z.object({
  site_name: z.string().describe("Netlify site name or ID"),
});
export type NetlifyDeployStatusInput = z.infer<typeof NetlifyDeployStatusSchema>;

export const NetlifyBuildLogSchema = z.object({
  site_name: z.string().describe("Netlify site name or ID"),
  deploy_id: z
    .string()
    .optional()
    .describe("Specific deploy ID to get logs for (default: latest deploy)"),
  tail: z
    .number()
    .int()
    .min(1)
    .max(500)
    .default(100)
    .describe("Number of log lines from the end to return (default 100)"),
});
export type NetlifyBuildLogInput = z.infer<typeof NetlifyBuildLogSchema>;

export const NetlifyFunctionLogSchema = z.object({
  site_name: z.string().describe("Netlify site name or ID"),
  function_name: z
    .string()
    .optional()
    .describe("Specific function name to filter logs (default: all functions)"),
});
export type NetlifyFunctionLogInput = z.infer<typeof NetlifyFunctionLogSchema>;

export const NetlifyListDeploysSchema = z.object({
  site_name: z.string().describe("Netlify site name or ID"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(20)
    .default(5)
    .describe("Number of recent deploys to list (default 5)"),
});
export type NetlifyListDeploysInput = z.infer<typeof NetlifyListDeploysSchema>;

export const NetlifyListFunctionsSchema = z.object({
  site_name: z.string().describe("Netlify site name or ID"),
});
export type NetlifyListFunctionsInput = z.infer<typeof NetlifyListFunctionsSchema>;

// === search tools ===
export const DevGrepSchema = z.object({
  pattern: z.string().describe("Search pattern (regex supported)"),
  cwd: z.string().describe("Absolute path to the project directory to search within"),
  glob: z
    .string()
    .optional()
    .describe("Glob filter for files (e.g. '*.ts', '*.{js,jsx}')"),
  fixed_strings: z
    .boolean()
    .default(false)
    .describe("Treat pattern as a literal string, not a regex"),
  case_insensitive: z.boolean().default(false).describe("Case-insensitive search"),
  context_lines: z
    .number()
    .int()
    .min(0)
    .max(10)
    .default(2)
    .describe("Lines of context around each match (default 2)"),
  max_results: z
    .number()
    .int()
    .min(1)
    .max(500)
    .default(100)
    .describe("Maximum number of matching lines to return (default 100)"),
  files_only: z
    .boolean()
    .default(false)
    .describe("Return only file paths, not matching lines"),
});
export type DevGrepInput = z.infer<typeof DevGrepSchema>;

export const DevFindSchema = z.object({
  pattern: z.string().describe("Glob pattern to match files (e.g. '**/*.ts', 'src/**/*.test.*')"),
  cwd: z.string().describe("Absolute path to the project directory to search within"),
  type: z
    .enum(["file", "directory", "all"])
    .default("file")
    .describe("Match files, directories, or both (default: file)"),
  max_results: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .default(200)
    .describe("Maximum number of results to return (default 200)"),
});
export type DevFindInput = z.infer<typeof DevFindSchema>;

export const DevReadSchema = z.object({
  path: z.string().describe("Absolute path to the file to read"),
  cwd: z.string().describe("Absolute path to the project directory (file must be inside this)"),
  start_line: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe("First line to read (1-based, inclusive)"),
  end_line: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe("Last line to read (1-based, inclusive)"),
  max_lines: z
    .number()
    .int()
    .min(1)
    .max(5000)
    .default(500)
    .describe("Maximum lines to return (default 500)"),
});
export type DevReadInput = z.infer<typeof DevReadSchema>;

export const DevTreeSchema = z.object({
  cwd: z.string().describe("Absolute path to the directory to display"),
  depth: z
    .number()
    .int()
    .min(1)
    .max(10)
    .default(3)
    .describe("Maximum depth to traverse (default 3)"),
  include_hidden: z
    .boolean()
    .default(false)
    .describe("Include hidden files/directories (dotfiles)"),
  directories_only: z
    .boolean()
    .default(false)
    .describe("Show only directories, not files"),
});
export type DevTreeInput = z.infer<typeof DevTreeSchema>;

// === jira tools (via Atlassian REST API — requires ATLASSIAN_* env vars) ===
export const JiraSearchSchema = z.object({
  jql: z
    .string()
    .describe(
      "JQL query string (e.g. 'project = PROJ AND status = \"To Do\"', 'assignee = currentUser() ORDER BY created DESC')"
    ),
  max_results: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Maximum issues to return (default 20)"),
  fields: z
    .string()
    .default("key,summary,status,assignee,priority,issuetype")
    .describe("Comma-separated field names to include (e.g. 'key,summary,status,assignee')"),
});
export type JiraSearchInput = z.infer<typeof JiraSearchSchema>;

export const JiraGetIssueSchema = z.object({
  issue_key: z.string().describe("Issue key (e.g. 'PROJ-123')"),
  fields: z
    .string()
    .optional()
    .describe("Comma-separated fields to return (e.g. 'summary,status,comment')"),
});
export type JiraGetIssueInput = z.infer<typeof JiraGetIssueSchema>;

export const JiraCreateIssueSchema = z.object({
  project_key: z.string().describe("Project key (e.g. 'PROJ')"),
  summary: z.string().describe("Issue title/summary"),
  issue_type: z
    .string()
    .default("Task")
    .describe("Issue type (e.g. 'Bug', 'Task', 'Story', 'Epic')"),
  description: z
    .string()
    .optional()
    .describe("Issue description (plain text)"),
  assignee: z
    .string()
    .optional()
    .describe("Assignee email or '@me' for self-assign"),
  labels: z.array(z.string()).optional().describe("Labels to apply"),
  parent_key: z
    .string()
    .optional()
    .describe("Parent issue key for subtasks or stories under an epic"),
});
export type JiraCreateIssueInput = z.infer<typeof JiraCreateIssueSchema>;

export const JiraTransitionSchema = z.object({
  issue_key: z.string().describe("Issue key (e.g. 'PROJ-123')"),
  status: z
    .string()
    .describe("Target status name (e.g. 'In Progress', 'Done', 'To Do')"),
});
export type JiraTransitionInput = z.infer<typeof JiraTransitionSchema>;

export const JiraAddCommentSchema = z.object({
  issue_key: z.string().describe("Issue key (e.g. 'PROJ-123')"),
  body: z.string().describe("Comment text (plain text)"),
});
export type JiraAddCommentInput = z.infer<typeof JiraAddCommentSchema>;

export const JiraAssignSchema = z.object({
  issue_key: z.string().describe("Issue key (e.g. 'PROJ-123')"),
  assignee: z
    .string()
    .describe("Assignee email, '@me' for self-assign, or 'unassign' to clear"),
});
export type JiraAssignInput = z.infer<typeof JiraAssignSchema>;

// === confluence tools ===
export const ConfluenceSearchSchema = z.object({
  cql: z
    .string()
    .describe(
      "CQL query string (e.g. 'type = page AND space = DEV AND text ~ \"deployment\"', 'title = \"API Guide\"')"
    ),
  max_results: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe("Maximum pages to return (default 10)"),
});
export type ConfluenceSearchInput = z.infer<typeof ConfluenceSearchSchema>;

export const ConfluenceGetPageSchema = z.object({
  page_id: z.string().describe("Confluence page ID"),
  format: z
    .enum(["storage", "view", "atlas_doc_format"])
    .default("storage")
    .describe("Body format: 'storage' (XHTML), 'view' (rendered HTML), 'atlas_doc_format' (ADF JSON)"),
});
export type ConfluenceGetPageInput = z.infer<typeof ConfluenceGetPageSchema>;

export const ConfluenceCreatePageSchema = z.object({
  space_key: z.string().describe("Space key (e.g. 'DEV', 'ENG')"),
  title: z.string().describe("Page title"),
  body: z.string().describe("Page body in XHTML storage format"),
  parent_id: z
    .string()
    .optional()
    .describe("Parent page ID (creates as child page)"),
});
export type ConfluenceCreatePageInput = z.infer<typeof ConfluenceCreatePageSchema>;

export const ConfluenceUpdatePageSchema = z.object({
  page_id: z.string().describe("Confluence page ID to update"),
  title: z.string().optional().describe("New title (default: keep existing)"),
  body: z.string().describe("New page body in XHTML storage format"),
  version_comment: z
    .string()
    .optional()
    .describe("Version comment describing the change"),
});
export type ConfluenceUpdatePageInput = z.infer<typeof ConfluenceUpdatePageSchema>;

// === slack tools (requires SLACK_USER_TOKEN or Slack CLI auth) ===

export const SlackSearchSchema = z.object({
  query: z
    .string()
    .describe(
      "Slack search query. Supports modifiers: 'in:#channel', 'from:@user', 'before:2024-01-01', 'after:2024-01-01', 'has:link', 'has:reaction'"
    ),
  count: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Number of messages to return per page (default 20, max 100)"),
  page: z
    .number()
    .int()
    .min(1)
    .default(1)
    .describe("Page number for pagination (default 1)"),
  sort: z
    .enum(["score", "timestamp"])
    .default("score")
    .describe("Sort order: 'score' (relevance) or 'timestamp' (newest first)"),
  sort_dir: z
    .enum(["asc", "desc"])
    .default("desc")
    .describe("Sort direction (default desc)"),
});
export type SlackSearchInput = z.infer<typeof SlackSearchSchema>;

export const SlackChannelsSchema = z.object({
  filter: z
    .string()
    .optional()
    .describe("Filter channels by name substring (case-insensitive, client-side)"),
  types: z
    .string()
    .default("public_channel")
    .describe("Comma-separated channel types: public_channel, private_channel, mpim, im (default: public_channel)"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(200)
    .default(100)
    .describe("Max channels to return (default 100). Note: returns first page only in large workspaces."),
  exclude_archived: z
    .boolean()
    .default(true)
    .describe("Exclude archived channels (default true)"),
});
export type SlackChannelsInput = z.infer<typeof SlackChannelsSchema>;

export const SlackHistorySchema = z.object({
  channel: z
    .string()
    .describe("Channel ID (e.g. 'C01ABCDEF'). Use slack_channels to find IDs by name."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(25)
    .describe("Number of messages to return (default 25, max 100)"),
  oldest: z
    .string()
    .optional()
    .describe("Start of time range as Unix timestamp (e.g. '1234567890.123456')"),
  latest: z
    .string()
    .optional()
    .describe("End of time range as Unix timestamp"),
});
export type SlackHistoryInput = z.infer<typeof SlackHistorySchema>;

// === memory tools ===

const MemoryEntitySchema = z.object({
  name: z.string().describe("Unique entity name"),
  type: z
    .string()
    .describe(
      "Entity type (e.g. person, tool, language, framework, preference, convention, project, workflow)"
    ),
  observations: z
    .array(z.string())
    .optional()
    .describe("Initial observations/facts about the entity"),
});

export const MemoryAddEntitiesSchema = z.object({
  entities: z.array(MemoryEntitySchema).min(1).describe("Entities to create"),
});
export type MemoryAddEntitiesInput = z.infer<typeof MemoryAddEntitiesSchema>;

export const MemoryAddRelationsSchema = z.object({
  relations: z
    .array(
      z.object({
        src: z.string().describe("Source entity name"),
        rel: z
          .string()
          .describe(
            "Relation type (e.g. PREFERS, USES, AVOIDS, DEPENDS_ON, CATEGORY_OF, RELATED_TO, WORKS_ON, CREATED_BY)"
          ),
        dst: z.string().describe("Destination entity name"),
      })
    )
    .min(1)
    .describe("Relations to create"),
});
export type MemoryAddRelationsInput = z.infer<typeof MemoryAddRelationsSchema>;

export const MemoryAddObservationsSchema = z.object({
  entity: z.string().describe("Entity name to add observations to"),
  observations: z
    .array(z.string())
    .min(1)
    .describe("Facts/observations to add to the entity"),
});
export type MemoryAddObservationsInput = z.infer<typeof MemoryAddObservationsSchema>;

export const MemoryQuerySchema = z.object({
  query: z
    .string()
    .optional()
    .describe("Free-text query for semantic search (requires embeddings)"),
  name: z
    .string()
    .optional()
    .describe("Search entities by name (substring match, case-insensitive)"),
  type: z.string().optional().describe("Filter entities by exact type"),
  mode: z
    .enum(["keyword", "semantic", "hybrid", "graph", "temporal"])
    .default("hybrid")
    .describe(
      "Search mode: keyword (substring), semantic (vector similarity), hybrid (both), graph (BFS traversal), temporal (recently accessed)"
    ),
  relation: z
    .string()
    .optional()
    .describe("Filter by relation type when traversing (graph mode)"),
  depth: z
    .number()
    .int()
    .min(1)
    .max(5)
    .default(1)
    .describe("Traversal depth for related entities (graph mode, default 1)"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Max entities to return (default 20)"),
  since: z
    .string()
    .optional()
    .describe("ISO date string — return entities accessed since this date (temporal mode)"),
});
export type MemoryQueryInput = z.infer<typeof MemoryQuerySchema>;

export const MemoryDeleteSchema = z.object({
  entities: z
    .array(z.string())
    .optional()
    .describe("Entity names to delete (cascades to their observations and relations)"),
  relations: z
    .array(
      z.object({
        src: z.string(),
        rel: z.string(),
        dst: z.string(),
      })
    )
    .optional()
    .describe("Specific relations to delete"),
  observations: z
    .array(
      z.object({
        entity: z.string(),
        content: z.string(),
      })
    )
    .optional()
    .describe("Specific observations to delete"),
});
export type MemoryDeleteInput = z.infer<typeof MemoryDeleteSchema>;

export const MemoryExportSchema = z.object({
  format: z
    .enum(["json", "mermaid"])
    .default("json")
    .describe("Export format: json (full graph data) or mermaid (graph diagram syntax)"),
});
export type MemoryExportInput = z.infer<typeof MemoryExportSchema>;

export const MemoryImportSchema = z.object({
  data: z
    .object({
      entities: z.array(
        z.object({
          name: z.string(),
          type: z.string(),
          observations: z.array(z.string()),
        })
      ),
      relations: z.array(
        z.object({
          src: z.string(),
          rel: z.string(),
          dst: z.string(),
        })
      ),
    })
    .describe("Graph data in the standard export format"),
  merge: z
    .boolean()
    .default(true)
    .describe("If true, merge with existing data. If false, replace all data."),
});
export type MemoryImportInput = z.infer<typeof MemoryImportSchema>;

export const MemoryTrackActionSchema = z.object({
  command: z
    .string()
    .describe(
      "The command or action performed (e.g. 'yarn lint --fix', 'gh pr create --draft')"
    ),
  description: z
    .string()
    .optional()
    .describe("Human-readable description of what this action does"),
  project: z
    .string()
    .optional()
    .describe("Project name or path where this action was performed"),
  tags: z
    .array(z.string())
    .optional()
    .describe(
      "Tags for grouping similar actions (e.g. ['lint', 'fix', 'typescript'])"
    ),
  category: z
    .string()
    .optional()
    .describe(
      "Action category: build, test, deploy, lint, git, setup, debug, format, or custom"
    ),
  outcome: z
    .enum(["success", "failure", "partial"])
    .optional()
    .describe("Action outcome: success, failure, or partial"),
  duration_ms: z
    .number()
    .int()
    .optional()
    .describe("How long the action took in milliseconds"),
});
export type MemoryTrackActionInput = z.infer<typeof MemoryTrackActionSchema>;

export const MemorySuggestToolsSchema = z.object({
  min_occurrences: z
    .number()
    .int()
    .min(2)
    .default(3)
    .describe(
      "Minimum times an action must appear to be suggested (default 3)"
    ),
  min_projects: z
    .number()
    .int()
    .min(1)
    .default(1)
    .describe(
      "Minimum distinct projects an action must appear in (default 1)"
    ),
  category: z
    .string()
    .optional()
    .describe("Filter suggestions to a specific category"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(20)
    .default(10)
    .describe("Maximum number of suggestions to return (default 10)"),
});
export type MemorySuggestToolsInput = z.infer<typeof MemorySuggestToolsSchema>;

// === memory_context ===
export const MemoryContextSchema = z.object({
  project: z
    .string()
    .optional()
    .describe("Project name (auto-detected from cwd basename if omitted)"),
  include_preferences: z
    .boolean()
    .default(true)
    .describe("Include user preference and convention entities"),
  include_recent: z
    .boolean()
    .default(true)
    .describe("Include recently accessed entities"),
  recent_days: z
    .number()
    .int()
    .min(1)
    .default(7)
    .describe("How many days back to look for recent entities (default 7)"),
  max_entities: z
    .number()
    .int()
    .min(1)
    .max(200)
    .default(50)
    .describe("Maximum total entities to return (default 50)"),
});
export type MemoryContextInput = z.infer<typeof MemoryContextSchema>;

// === memory_learn ===
export const MemoryLearnSchema = z.object({
  text: z
    .string()
    .describe(
      "Free-text knowledge to store. Examples: " +
      "'JT prefers Drizzle over Prisma for zero cold start', " +
      "'party-tracker uses Neon PostgreSQL with Drizzle ORM'"
    ),
  entity: z
    .string()
    .optional()
    .describe("Target entity name — if omitted, auto-detected from text or existing entities"),
  type: z
    .string()
    .optional()
    .describe("Entity type — if omitted, defaults to 'knowledge'"),
  source: z
    .string()
    .optional()
    .describe("Where this knowledge came from (e.g. 'conversation', 'code-review')"),
});
export type MemoryLearnInput = z.infer<typeof MemoryLearnSchema>;

// === memory_reflect ===
export const MemoryReflectSchema = z.object({
  mode: z
    .enum(["stats", "stale", "contradictions", "clusters", "tools"])
    .default("stats")
    .describe(
      "Reflection mode: stats (graph health), stale (old entities), " +
      "contradictions (conflicting observations), clusters (related entity groups), " +
      "tools (tool usage analytics from event_log)"
    ),
  dry_run: z
    .boolean()
    .default(true)
    .describe("If true, show analysis without modifying the graph"),
});
export type MemoryReflectInput = z.infer<typeof MemoryReflectSchema>;

// === strategy tools ===
export const StrategyExpandSchema = z.object({
  command: z
    .string()
    .describe("Short command to expand (e.g. 'review pr feature/my-branch')"),
  strategies_dir: z
    .string()
    .default(`${process.env.HOME}/.jt-strategies`)
    .describe("Directory containing strategy .md files"),
});
export type StrategyExpandInput = z.infer<typeof StrategyExpandSchema>;

export const StrategyListSchema = z.object({
  strategies_dir: z
    .string()
    .default(`${process.env.HOME}/.jt-strategies`)
    .describe("Directory containing strategy .md files"),
});
export type StrategyListInput = z.infer<typeof StrategyListSchema>;

// === planning tools ===
export const PlanFromTicketSchema = z.object({
  ticket: z
    .string()
    .describe(
      "Ticket identifier: Jira key (PROJ-123), GitHub issue number (42 or #42), " +
      "or GitHub issue URL (https://github.com/owner/repo/issues/42)"
    ),
  repo: z
    .string()
    .optional()
    .describe("owner/repo for GitHub issues (default: inferred from gh or ticket URL)"),
  cwd: z
    .string()
    .optional()
    .describe("Project root for file tree context"),
  strategies_dir: z
    .string()
    .default(`${process.env.HOME}/.jt-strategies`)
    .describe("Directory containing strategy .md files"),
});
export type PlanFromTicketInput = z.infer<typeof PlanFromTicketSchema>;

export const PlanReviewSchema = z.object({
  plan: z
    .string()
    .optional()
    .describe(
      "The plan text to review. If omitted, the returned prompt instructs " +
      "the AI to review the plan already in conversation context."
    ),
  strategies_dir: z
    .string()
    .default(`${process.env.HOME}/.jt-strategies`)
    .describe("Directory containing strategy .md files"),
});
export type PlanReviewInput = z.infer<typeof PlanReviewSchema>;

// === journal tools ===
export const JournalLogSchema = z.object({
  since: z
    .string()
    .optional()
    .describe(
      "Start of time period for git log (e.g. '8 hours ago', '2026-03-11', 'yesterday'). Default: today midnight"
    ),
  until: z
    .string()
    .optional()
    .describe("End of time period for git log (e.g. 'now', '2026-03-11 18:00'). Default: now"),
  repos: z
    .array(z.string())
    .optional()
    .describe(
      "Absolute paths to git repos to scan. Default: common workspace repos under ~/code/"
    ),
  journal_dir: z
    .string()
    .default(`${process.env.HOME}/code/jt.houk.space/content/journal`)
    .describe("Absolute path to the journal directory"),
  date: z
    .string()
    .optional()
    .describe("Date for the journal entry in YYYY-MM-DD format (default: today)"),
  dry_run: z
    .boolean()
    .default(false)
    .describe("If true, return the line without appending to the file"),
});
export type JournalLogInput = z.infer<typeof JournalLogSchema>;
