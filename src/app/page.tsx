import WorldCupDashboard from "@/components/WorldCupDashboard";
import { getSquads } from "@/lib/squadsData";

export default async function Home() {
  // Fetched server-side (cached). Supabase when configured, static otherwise.
  const squads = await getSquads();
  return <WorldCupDashboard squads={squads} />;
}
