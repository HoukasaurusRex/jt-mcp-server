import { describe, it, expect } from "vitest";
import {
  DevWorktreeSchema,
  DevVisualRegressionSchema,
  GitHubProjectCompleteIssueSchema,
  GitConventionalCommitSchema,
  NetlifyDeployStatusSchema,
} from "../types.js";

describe("Zod schemas", () => {
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
});
