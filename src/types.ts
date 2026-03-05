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
});
export type DevRunInput = z.infer<typeof DevRunSchema>;

// === dev_worktree ===
export const DevWorktreeSchema = z.object({
  branch: z.string().describe("Git branch name"),
  action: z
    .enum(["create", "build", "remove"])
    .describe(
      "create: create worktree and install deps; build: run build command in worktree; remove: clean up worktree"
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
});
export type DevVisualRegressionInput = z.infer<typeof DevVisualRegressionSchema>;

// === github tools ===
export const GitHubProjectNextIssueSchema = z.object({
  project_id: z
    .string()
    .default("PVT_kwHOAWmP0M4BQ4Fi")
    .describe("GitHub ProjectV2 node ID"),
  status_field_id: z
    .string()
    .default("PVTSSF_lAHOAWmP0M4BQ4Fizg-3q2k")
    .describe("Status field ID"),
  todo_option_id: z
    .string()
    .default("f75ad846")
    .describe("Option ID for Todo status"),
});
export type GitHubProjectNextIssueInput = z.infer<typeof GitHubProjectNextIssueSchema>;

export const GitHubProjectSetStatusSchema = z.object({
  project_id: z
    .string()
    .default("PVT_kwHOAWmP0M4BQ4Fi")
    .describe("GitHub ProjectV2 node ID"),
  item_id: z.string().describe("Project item node ID"),
  status_field_id: z
    .string()
    .default("PVTSSF_lAHOAWmP0M4BQ4Fizg-3q2k")
    .describe("Status field ID"),
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
    .default("PVT_kwHOAWmP0M4BQ4Fi")
    .describe("GitHub ProjectV2 node ID"),
  status_field_id: z
    .string()
    .default("PVTSSF_lAHOAWmP0M4BQ4Fizg-3q2k")
    .describe("Status field ID"),
  done_option_id: z
    .string()
    .default("98236657")
    .describe("Option ID for Done status"),
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
});
export type GitConventionalCommitInput = z.infer<typeof GitConventionalCommitSchema>;

// === netlify tools ===
export const NetlifyDeployStatusSchema = z.object({
  site_name: z.string().describe("Netlify site name or ID"),
});
export type NetlifyDeployStatusInput = z.infer<typeof NetlifyDeployStatusSchema>;
