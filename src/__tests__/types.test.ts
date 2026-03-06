import { describe, it, expect } from "vitest";
import {
  DevPortSchema,
  DevServeSchema,
  DevServeStopSchema,
  DevRunSchema,
  DevWorktreeSchema,
  DevVisualRegressionSchema,
  GitHubProjectCompleteIssueSchema,
  GitConventionalCommitSchema,
  NetlifyDeployStatusSchema,
  ShellLintSchema,
} from "../types.js";

describe("Zod schemas", () => {
  it("DevPortSchema validates correct input", () => {
    const result = DevPortSchema.safeParse({ port: 3000, action: "check" });
    expect(result.success).toBe(true);
  });

  it("DevPortSchema rejects invalid port", () => {
    const result = DevPortSchema.safeParse({ port: -1, action: "check" });
    expect(result.success).toBe(false);
  });

  it("DevPortSchema rejects invalid action", () => {
    const result = DevPortSchema.safeParse({ port: 3000, action: "restart" });
    expect(result.success).toBe(false);
  });

  it("DevServeSchema validates with defaults", () => {
    const result = DevServeSchema.safeParse({ directory: "/tmp/build" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.port).toBe(3000);
      expect(result.data.startup_timeout).toBe(10000);
    }
  });

  it("DevServeStopSchema validates", () => {
    const result = DevServeStopSchema.safeParse({ port: 8080 });
    expect(result.success).toBe(true);
  });

  it("DevRunSchema validates minimal input with defaults", () => {
    const result = DevRunSchema.safeParse({ command: "echo hello" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.timeout).toBe(300000);
    }
  });

  it("DevRunSchema validates full input with custom timeout", () => {
    const result = DevRunSchema.safeParse({
      command: "yarn build",
      node_version: "20",
      cwd: "/tmp",
      env: { NODE_ENV: "production" },
      timeout: 60000,
    });
    expect(result.success).toBe(true);
  });

  it("DevRunSchema rejects timeout exceeding max", () => {
    const result = DevRunSchema.safeParse({
      command: "echo hi",
      timeout: 999999,
    });
    expect(result.success).toBe(false);
  });

  it("DevWorktreeSchema validates create action", () => {
    const result = DevWorktreeSchema.safeParse({
      branch: "feature/test",
      action: "create",
    });
    expect(result.success).toBe(true);
  });

  it("DevWorktreeSchema validates list action", () => {
    const result = DevWorktreeSchema.safeParse({
      branch: "any",
      action: "list",
    });
    expect(result.success).toBe(true);
  });

  it("DevVisualRegressionSchema validates with defaults", () => {
    const result = DevVisualRegressionSchema.safeParse({
      reference_dir: "/tmp/ref",
      test_dir: "/tmp/test",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.port).toBe(3000);
      expect(result.data.update_baselines).toBe(false);
      expect(result.data.startup_timeout).toBe(15000);
    }
  });

  it("GitHubProjectCompleteIssueSchema validates with defaults", () => {
    const result = GitHubProjectCompleteIssueSchema.safeParse({
      issue_number: 42,
      item_id: "PVTI_abc123",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.done_option_id).toContain("98236657");
    }
  });

  it("GitConventionalCommitSchema validates with strict default", () => {
    const result = GitConventionalCommitSchema.safeParse({
      message: "feat: add new tool",
      files: ["src/index.ts"],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.strict).toBe(true);
    }
  });

  it("NetlifyDeployStatusSchema validates", () => {
    const result = NetlifyDeployStatusSchema.safeParse({
      site_name: "my-site",
    });
    expect(result.success).toBe(true);
  });

  it("ShellLintSchema validates with defaults", () => {
    const result = ShellLintSchema.safeParse({
      files: ["/tmp/script.sh"],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.shell).toBe("bash");
      expect(result.data.severity).toBe("style");
    }
  });

  it("ShellLintSchema rejects empty files array", () => {
    const result = ShellLintSchema.safeParse({ files: [] });
    expect(result.success).toBe(false);
  });
});
