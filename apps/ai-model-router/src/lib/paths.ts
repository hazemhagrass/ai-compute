import path from "node:path";

/**
 * Everything lives in one directory: the SQLite file + the auto-generated
 * master key. Override with AMR_DATA_DIR when deploying (e.g. a mounted volume).
 */
export const DATA_DIR =
  process.env.AMR_DATA_DIR ?? path.join(process.cwd(), "data");

export const DB_PATH = process.env.AMR_DB_PATH ?? path.join(DATA_DIR, "router.db");
