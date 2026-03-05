import { describe, it, expect, vi } from "vitest";

describe("netlify", () => {
  it("should export a register function", async () => {
    const { register } = await import("../tools/netlify.js");
    expect(typeof register).toBe("function");
  });

  it("should register the netlify_deploy_status tool", async () => {
    const { register } = await import("../tools/netlify.js");
    const mockServer = { registerTool: vi.fn() };
    register(mockServer as any);
    expect(mockServer.registerTool).toHaveBeenCalledWith(
      "netlify_deploy_status",
      expect.any(Object),
      expect.any(Function)
    );
  });
});
