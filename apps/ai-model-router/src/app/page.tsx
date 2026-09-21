import { redirect } from "next/navigation";

import AppShell from "@/components/AppShell";
import { isAuthenticated } from "@/lib/auth";
import { getInitialData } from "@/lib/server-data";

// Reads SQLite on every request; there is nothing to cache safely here since
// the whole point is current provider, model, and usage state.
export const dynamic = "force-dynamic";

export default async function Home() {
  // Verified here as well as in middleware: middleware only sees that a cookie
  // exists, and a forged one must not reach the data.
  if (!(await isAuthenticated())) redirect("/login");

  return <AppShell initial={getInitialData()} />;
}
