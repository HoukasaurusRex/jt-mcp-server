import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("execa", () => ({
  execa: vi.fn(),
}));

import { execa } from "execa";
const mockExeca = vi.mocked(execa);

describe("dev-port", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should export a register function", async () => {
    const { register } = await import("../tools/dev-port.js");
    expect(typeof register).toBe("function");
  });

  it("should register the dev_port tool", async () => {
    const { register } = await import("../tools/dev-port.js");
    const mockServer = { registerTool: vi.fn() };
    register(mockServer as any);
    expect(mockServer.registerTool).toHaveBeenCalledWith(
      "dev_port",
      expect.any(Object),
      expect.any(Function)
    );
  });

  it("check action should return free when no process on port", async () => {
    const { register } = await import("../tools/dev-port.js");
    const mockServer = { registerTool: vi.fn() };
    register(mockServer as any);

    const handler = mockServer.registerTool.mock.calls[0][2];
    mockExeca.mockRejectedValueOnce(new Error("no process"));

    const result = await handler({ port: 9999, action: "check", timeout: 10000 });
    expect(result.content[0].text).toContain("free");
  });

  it("check action should return PID when process exists", async () => {
    const { register } = await import("../tools/dev-port.js");
    const mockServer = { registerTool: vi.fn() };
    register(mockServer as any);

    const handler = mockServer.registerTool.mock.calls[0][2];
    mockExeca.mockResolvedValueOnce({ stdout: "12345\n" } as any);

    const result = await handler({ port: 3000, action: "check", timeout: 10000 });
    expect(result.content[0].text).toContain("12345");
  });

  it("kill action should kill the process on port", async () => {
    const { register } = await import("../tools/dev-port.js");
    const mockServer = { registerTool: vi.fn() };
    register(mockServer as any);

    const handler = mockServer.registerTool.mock.calls[0][2];
    mockExeca
      .mockResolvedValueOnce({ stdout: "12345\n" } as any) // lsof
      .mockResolvedValueOnce({} as any); // kill

    const result = await handler({ port: 3000, action: "kill", timeout: 10000 });
    expect(result.content[0].text).toContain("Killed");
    expect(result.content[0].text).toContain("12345");
  });
});
