import os from "node:os";
import path from "node:path";

export const HERMES_HOME = process.env.HERMES_HOME ?? path.join(os.homedir(), ".hermes");

export const PROFILES_DIR = path.join(HERMES_HOME, "profiles");

export interface ProfilePaths {
  id: string;
  root: string;
  configPath: string;
  envPath: string;
  stateDbPath: string;
}

export function defaultProfilePaths(): ProfilePaths {
  return {
    id: "default",
    root: HERMES_HOME,
    configPath: path.join(HERMES_HOME, "config.yaml"),
    envPath: path.join(HERMES_HOME, ".env"),
    stateDbPath: path.join(HERMES_HOME, "state.db"),
  };
}

export function namedProfilePaths(name: string): ProfilePaths {
  const root = path.join(PROFILES_DIR, name);
  return {
    id: name,
    root,
    configPath: path.join(root, "config.yaml"),
    envPath: path.join(root, ".env"),
    stateDbPath: path.join(root, "state.db"),
  };
}

// A profile id is either the reserved "default" (HERMES_HOME itself) or a directory name
// under profiles/. Validate it before it becomes a path segment so an id like ".." cannot
// escape PROFILES_DIR and reach config.yaml or .env.
const PROFILE_ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

export function isValidProfileId(id: string): boolean {
  return id === "default" || PROFILE_ID_RE.test(id);
}

export function assertValidProfileId(id: string): void {
  if (!isValidProfileId(id)) {
    throw new Error(`invalid profile id: ${JSON.stringify(id)}`);
  }
}

export function profilePaths(id: string): ProfilePaths {
  assertValidProfileId(id);
  return id === "default" ? defaultProfilePaths() : namedProfilePaths(id);
}
