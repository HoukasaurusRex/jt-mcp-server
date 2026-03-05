import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("execa", () => ({
  execa: vi.fn(),
}));

import { execa } from "execa";
const mockExeca = vi.mocked(execa);

describe("git", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should export a register function", async () => {
    const { register } = await import("../tools/git.js");
    expect(typeof register).toBe("function");
  });

  it("should register the git_conventional_commit tool", async () => {
    const { register } = await import("../tools/git.js");
    const mockServer = { registerTool: vi.fn() };
    register(mockServer as any);
    expect(mockServer.registerTool).toHaveBeenCalledWith(
      "git_conventional_commit",
      expect.any(Object),
      expect.any(Function)
    );
  });

  it("should reject invalid conventional commit messages", async () => {
    const { register } = await import("../tools/git.js");
    const mockServer = { registerTool: vi.fn() };
    register(mockServer as any);

    const handler = mockServer.registerTool.mock.calls[0][2];
    const result = await handler({ message: "bad message format" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Invalid conventional commit");
  });

  it("should reject forbidden files", async () => {
    const { register } = await import("../tools/git.js");
    const mockServer = { registerTool: vi.fn() };
    register(mockServer as any);

    const handler = mockServer.registerTool.mock.calls[0][2];
    const result = await handler({
      message: "feat: add feature",
      files: [".env"],
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("forbidden");
  });

  it("should accept valid conventional commit with staged files", async () => {
    const { register } = await import("../tools/git.js");
    const mockServer = { registerTool: vi.fn() };
    register(mockServer as any);

    const handler = mockServer.registerTool.mock.calls[0][2];
    mockExeca
      .mockResolvedValueOnce({} as any) // git add
      .mockResolvedValueOnce({ stdout: "src/index.ts\n" } as any) // git diff --cached
      .mockResolvedValueOnce({} as any); // git commit

    const result = await handler({
      message: "feat: add new tool",
      files: ["src/index.ts"],
    });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("Committed");
  });
});
