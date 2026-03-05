import { describe, it, expect, vi } from "vitest";

describe("dev-visual-regression", () => {
  it("should export a register function", async () => {
    const { register } = await import("../tools/dev-visual-regression.js");
    expect(typeof register).toBe("function");
  });

  it("should register the dev_visual_regression tool", async () => {
    const { register } = await import("../tools/dev-visual-regression.js");
    const mockServer = { registerTool: vi.fn() };
    register(mockServer as any);
    expect(mockServer.registerTool).toHaveBeenCalledWith(
      "dev_visual_regression",
      expect.any(Object),
      expect.any(Function)
    );
  });
});
