import { z } from "zod";

// === dev_port ===
export const DevPortSchema = z.object({
  port: z.number().int().min(1).max(65535).describe("Port number"),
  action: z
    .enum(["check", "kill", "wait_ready"])
    .describe(
      "check: return PID using port; kill: terminate process on port; wait_ready: poll until port accepts connections"
    ),
  timeout: z
    .number()
    .int()
    .positive()
    .default(10000)
    .describe("Timeout in ms for wait_ready (default 10000)"),
});
export type DevPortInput = z.infer<typeof DevPortSchema>;

// === dev_serve ===
export const DevServeSchema = z.object({
  directory: z.string().describe("Absolute path to directory to serve"),
  port: z.number().int().min(1).max(65535).default(3000).describe("Port to serve on (default 3000)"),
  startup_timeout: z
    .number()
    .int()
    .positive()
    .default(10000)
    .describe("Max ms to wait for the server to respond (default 10000)"),
});
export type DevServeInput = z.infer<typeof DevServeSchema>;

export const DevServeStopSchema = z.object({
  port: z.number().int().min(1).max(65535).describe("Port of the server to stop"),
});
export type DevServeStopInput = z.infer<typeof DevServeStopSchema>;

// === dev_run ===
export const DevRunSchema = z.object({
  command: z.string().describe("Shell command to execute"),
  node_version: z
    .string()
    .optional()
    .describe("Node version to use via nvm (e.g. '20', '22')"),
  cwd: z.string().optional().describe("Working directory for the command"),
  env: z
    .record(z.string(), z.string())
    .optional()
    .describe("Additional environment variables"),
  timeout: z
    .number()
    .int()
    .positive()
    .max(600000)
    .default(300000)
    .describe("Timeout in ms (default 300000 = 5 min, max 600000 = 10 min)"),
});
export type DevRunInput = z.infer<typeof DevRunSchema>;

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

// === dev_install ===
export const DevInstallSchema = z.object({
  cwd: z.string().describe("Absolute path to the project directory"),
  frozen: z
    .boolean()
    .default(false)
    .describe("Use frozen/immutable lockfile (CI mode)"),
  node_version: z
    .string()
    .optional()
    .describe("Node version to use via nvm (e.g. '20', '22')"),
  timeout: z
    .number()
    .int()
    .positive()
    .max(600000)
    .default(300000)
    .describe("Timeout in ms (default 300000 = 5 min)"),
});
export type DevInstallInput = z.infer<typeof DevInstallSchema>;

// === dev_script ===
export const DevScriptSchema = z.object({
  script: z.string().describe("Package.json script name to run (e.g. 'build', 'test', 'lint')"),
  args: z.string().optional().describe("Additional arguments to pass to the script"),
  cwd: z.string().optional().describe("Project directory (default: process cwd)"),
  node_version: z
    .string()
    .optional()
    .describe("Node version to use via nvm (e.g. '20', '22')"),
  timeout: z
    .number()
    .int()
    .positive()
    .max(600000)
    .default(300000)
    .describe("Timeout in ms (default 300000 = 5 min)"),
});
export type DevScriptInput = z.infer<typeof DevScriptSchema>;

// === dev_deps ===
export const DevDepsSchema = z.object({
  action: z.enum(["add", "remove"]).describe("Whether to add or remove packages"),
  packages: z
    .array(z.string())
    .min(1)
    .describe("Package names with optional version specifiers (e.g. 'zod', 'vitest@^1.0.0')"),
  dev: z
    .boolean()
    .default(false)
    .describe("Add as devDependency (ignored for remove)"),
  cwd: z.string().optional().describe("Project directory (default: process cwd)"),
  node_version: z
    .string()
    .optional()
    .describe("Node version to use via nvm (e.g. '20', '22')"),
  timeout: z
    .number()
    .int()
    .positive()
    .max(600000)
    .default(300000)
    .describe("Timeout in ms (default 300000 = 5 min)"),
});
export type DevDepsInput = z.infer<typeof DevDepsSchema>;

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

// === shell tools ===
export const ShellLintSchema = z.object({
  files: z.array(z.string()).min(1).describe("Paths to shell files to lint"),
  shell: z
    .enum(["bash", "sh", "zsh", "dash"])
    .default("bash")
    .describe("Shell dialect (default: bash)"),
  severity: z
    .enum(["error", "warning", "info", "style"])
    .default("style")
    .describe("Minimum severity to report (default: style)"),
});
export type ShellLintInput = z.infer<typeof ShellLintSchema>;

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
  name: z
    .string()
    .optional()
    .describe("Search entities by name (substring match, case-insensitive)"),
  type: z.string().optional().describe("Filter entities by exact type"),
  relation: z
    .string()
    .optional()
    .describe("Filter by relation type when traversing"),
  depth: z
    .number()
    .int()
    .min(1)
    .max(5)
    .default(1)
    .describe("Traversal depth for related entities (default 1)"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Max entities to return (default 20)"),
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

export const MemoryExportSchema = z.object({});
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
