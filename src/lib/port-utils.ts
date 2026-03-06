import { execa } from "execa";

export async function getPidOnPort(port: number): Promise<string | null> {
  try {
    const { stdout } = await execa("lsof", ["-ti", `:${port}`]);
    const pid = stdout.trim().split("\n")[0];
    return pid || null;
  } catch {
    return null;
  }
}

export async function killPort(port: number): Promise<void> {
  try {
    const { stdout } = await execa("lsof", ["-ti", `:${port}`]);
    for (const pid of stdout.trim().split("\n").filter(Boolean)) {
      await execa("kill", ["-9", pid]);
    }
  } catch {
    // nothing on port
  }
}

export async function waitForPort(port: number, timeout: number, acceptStatuses = [200, 404]): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(`http://localhost:${port}`);
      if (acceptStatuses.includes(res.status) || res.ok) return;
    } catch {
      // not ready
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Port ${port} not ready after ${timeout}ms`);
}
