import AppShell from "@/components/AppShell";
import { getInitialData } from "@/lib/server-data";

// Reads SQLite on every request; there is nothing to cache safely here since
// the whole point is current provider/model/usage state.
export const dynamic = "force-dynamic";

export default function Home() {
  return <AppShell initial={getInitialData()} />;
}
