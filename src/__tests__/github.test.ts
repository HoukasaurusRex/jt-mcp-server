import { describe, it, expect, vi } from "vitest";

describe("github", () => {
  it("should export a register function", async () => {
    const { register } = await import("../tools/github.js");
    expect(typeof register).toBe("function");
  });

  it("should register four GitHub tools", async () => {
    const { register } = await import("../tools/github.js");
    const mockServer = { registerTool: vi.fn() };
    register(mockServer as any);
    expect(mockServer.registerTool).toHaveBeenCalledTimes(4);
    expect(mockServer.registerTool.mock.calls[0][0]).toBe("github_project_next_issue");
    expect(mockServer.registerTool.mock.calls[1][0]).toBe("github_project_set_status");
    expect(mockServer.registerTool.mock.calls[2][0]).toBe("github_project_complete_issue");
    expect(mockServer.registerTool.mock.calls[3][0]).toBe("github_create_pr");
  });
});
