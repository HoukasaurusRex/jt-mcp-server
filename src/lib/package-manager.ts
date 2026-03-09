import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type PackageManager = "yarn" | "npm" | "pnpm";

export function detectPackageManager(cwd: string): PackageManager {
  if (existsSync(join(cwd, "yarn.lock"))) return "yarn";
  if (existsSync(join(cwd, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(cwd, "package-lock.json"))) return "npm";

  try {
    const pkg = JSON.parse(readFileSync(join(cwd, "package.json"), "utf-8"));
    if (typeof pkg.packageManager === "string") {
      const name = pkg.packageManager.split("@")[0];
      if (name === "yarn" || name === "pnpm" || name === "npm") return name;
    }
  } catch {
    // no package.json or parse error
  }

  return "npm";
}
