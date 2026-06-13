// One-off / manual runner for the stats sync (same work the cron does).
//   npm run sync:stats
import { syncStats } from "../src/lib/statsSync";

syncStats(2026)
  .then((summary) => console.log(JSON.stringify(summary, null, 2)))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
