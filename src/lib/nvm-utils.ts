import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export function resolveNodeBinPath(version: string): string | null {
  const nvmDir = join(homedir(), ".nvm", "versions", "node");

  const exactPath = join(nvmDir, version.startsWith("v") ? version : `v${version}`, "bin");
  if (existsSync(exactPath)) return exactPath;

  try {
    const dirs = readdirSync(nvmDir);
    const prefix = version.startsWith("v") ? version : `v${version}`;
    const match = dirs
      .filter((d) => d.startsWith(prefix))
      .sort()
      .pop();
    if (match) {
      const binPath = join(nvmDir, match, "bin");
      if (existsSync(binPath)) return binPath;
    }
  } catch {
    // nvm dir doesn't exist or not readable
  }

  return null;
}
