import { describe, it, expect, vi } from "vitest";

describe("dev-worktree", () => {
  it("should export a register function", async () => {
    const { register } = await import("../tools/dev-worktree.js");
    expect(typeof register).toBe("function");
  });

  it("should register the dev_worktree tool", async () => {
    const { register } = await import("../tools/dev-worktree.js");
    const mockServer = { registerTool: vi.fn() };
    register(mockServer as any);
    expect(mockServer.registerTool).toHaveBeenCalledWith(
      "dev_worktree",
      expect.any(Object),
      expect.any(Function)
    );
  });
});
