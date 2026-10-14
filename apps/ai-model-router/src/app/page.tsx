import { redirect } from "next/navigation";

import AppShell from "@/components/AppShell";
import { isAuthenticated } from "@/lib/auth";
import { getInitialData } from "@/lib/server-data";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!(await isAuthenticated())) redirect("/login");

  return <AppShell initial={getInitialData()} />;
}
