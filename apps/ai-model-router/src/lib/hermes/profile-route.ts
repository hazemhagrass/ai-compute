import fs from "node:fs";

import { NextResponse } from "next/server";

import { isValidProfileId, profilePaths } from "./paths";

export function profileRouteGuard(id: string): NextResponse | null {
  if (!isValidProfileId(id)) {
    return NextResponse.json({ error: `invalid profile id: ${JSON.stringify(id)}` }, { status: 400 });
  }
  if (id !== "default") {
    try {
      if (!fs.lstatSync(profilePaths(id).root).isDirectory()) {
        return NextResponse.json({ error: `profile "${id}" does not exist` }, { status: 404 });
      }
    } catch {
      return NextResponse.json({ error: `profile "${id}" does not exist` }, { status: 404 });
    }
  }
  return null;
}
