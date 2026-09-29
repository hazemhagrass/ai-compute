import os from "node:os";
import path from "node:path";

/**
 * Root of the Hermes install this dashboard talks to. The default profile
 * lives directly under this dir (config.yaml, .env, state.db); named
 * profiles live under <root>/profiles/<name>/.
 *
 * Override with HERMES_HOME for a non-standard install; the plugin itself
 * should never need this since it runs on the same box as Hermes.
 */
export const HERMES_HOME = process.env.HERMES_HOME ?? path.join(os.homedir(), ".hermes");

export const PROFILES_DIR = path.join(HERMES_HOME, "profiles");

export interface ProfilePaths {
  id: string;
  /** "default" for the profile living directly under HERMES_HOME. */
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

/** A profile id of "default" always resolves to the root install. */
export function profilePaths(id: string): ProfilePaths {
  return id === "default" ? defaultProfilePaths() : namedProfilePaths(id);
}
