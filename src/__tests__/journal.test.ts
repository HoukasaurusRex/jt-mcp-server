import { describe, it, expect, vi, beforeEach } from "vitest";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

vi.mock("execa", () => ({
  execa: vi.fn(),
}));

import { execa } from "execa";
const mockExeca = vi.mocked(execa);

describe("journal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should export a register function", async () => {
    const { register } = await import("../tools/journal.js");
    expect(typeof register).toBe("function");
  });

  it("should register the journal_log tool", async () => {
    const { register } = await import("../tools/journal.js");
    const mockServer = { registerTool: vi.fn() };
    register(mockServer as any);
    expect(mockServer.registerTool).toHaveBeenCalledWith(
      "journal_log",
      expect.any(Object),
      expect.any(Function)
    );
  });

  it("should return no commits message when no work found", async () => {
    const { register } = await import("../tools/journal.js");
    const mockServer = { registerTool: vi.fn() };
    register(mockServer as any);

    const handler = mockServer.registerTool.mock.calls[0][2];

    // Mock git config user.email (called inside repoLog)
    mockExeca.mockResolvedValueOnce({ stdout: "test@example.com" } as any);
    // Mock git log with no output
    mockExeca.mockResolvedValueOnce({ stdout: "" } as any);

    const result = await handler({
      since: "today",
      until: "now",
      repos: ["/tmp/test-repo"],
      journal_dir: "/tmp",
      dry_run: true,
    });
    expect(result.content[0].text).toContain("No commits found");
  });

  it("should build a standup line from commits (dry run)", async () => {
    const { register } = await import("../tools/journal.js");
    const mockServer = { registerTool: vi.fn() };
    register(mockServer as any);

    const handler = mockServer.registerTool.mock.calls[0][2];

    // Mock git config user.email
    mockExeca.mockResolvedValueOnce({ stdout: "test@example.com" } as any);
    // Mock git log
    mockExeca.mockResolvedValueOnce({
      stdout: "feat: add journal tool\nfix: resolve crash on empty log",
    } as any);

    const result = await handler({
      since: "8 hours ago",
      until: "now",
      repos: ["/tmp/my-project"],
      journal_dir: "/tmp",
      dry_run: true,
    });
    expect(result.content[0].text).toContain("dry run");
    expect(result.content[0].text).toContain("my-project");
    expect(result.content[0].text).toContain("add journal tool");
  });

  it("should append line to draft file", async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), "journal-test-"));
    const draftPath = join(tmpDir, "2026-03-11.draft.md");
    await writeFile(
      draftPath,
      "---\ntitle: test\n---\n\n## Projects\n",
      "utf-8"
    );

    const { register } = await import("../tools/journal.js");
    const mockServer = { registerTool: vi.fn() };
    register(mockServer as any);

    const handler = mockServer.registerTool.mock.calls[0][2];

    mockExeca.mockResolvedValueOnce({ stdout: "test@example.com" } as any);
    mockExeca.mockResolvedValueOnce({
      stdout: "feat: ship the feature",
    } as any);

    const result = await handler({
      since: "8 hours ago",
      until: "now",
      repos: ["/tmp/cool-repo"],
      journal_dir: tmpDir,
      date: "2026-03-11",
      dry_run: false,
    });

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("Appended");

    const content = await readFile(draftPath, "utf-8");
    expect(content).toContain("cool-repo: ship the feature");

    await rm(tmpDir, { recursive: true });
  });

  it("should error when no journal file exists", async () => {
    const { register } = await import("../tools/journal.js");
    const mockServer = { registerTool: vi.fn() };
    register(mockServer as any);

    const handler = mockServer.registerTool.mock.calls[0][2];

    mockExeca.mockResolvedValueOnce({ stdout: "test@example.com" } as any);
    mockExeca.mockResolvedValueOnce({
      stdout: "feat: something",
    } as any);

    const result = await handler({
      since: "today",
      until: "now",
      repos: ["/tmp/some-repo"],
      journal_dir: "/tmp/nonexistent-journal-dir",
      date: "2099-01-01",
      dry_run: false,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("No journal file found");
  });
});
