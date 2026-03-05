import { describe, it, expect, vi } from "vitest";

describe("dev-serve", () => {
  it("should export a register function", async () => {
    const { register } = await import("../tools/dev-serve.js");
    expect(typeof register).toBe("function");
  });

  it("should register dev_serve and dev_serve_stop tools", async () => {
    const { register } = await import("../tools/dev-serve.js");
    const mockServer = { registerTool: vi.fn() };
    register(mockServer as any);
    expect(mockServer.registerTool).toHaveBeenCalledTimes(2);
    expect(mockServer.registerTool.mock.calls[0][0]).toBe("dev_serve");
    expect(mockServer.registerTool.mock.calls[1][0]).toBe("dev_serve_stop");
  });
});
