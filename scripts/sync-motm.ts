// Fetches FIFA's "Superior Player of the Match" article via the CXM content API
// and upserts results into the `match_motm` Supabase table.
//
// Run: npm run sync:motm
//   or: node --conditions=react-server --env-file=.env.local --import tsx scripts/sync-motm.ts

import { syncMotm } from "../src/lib/motmSync";

syncMotm()
  .then((summary) => console.log(JSON.stringify(summary, null, 2)))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
