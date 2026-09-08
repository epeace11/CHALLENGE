import { NextResponse, type NextRequest } from "next/server";
import { runScheduledJobs } from "@/lib/jobs";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Cron target. The Cloudflare `scheduled` handler in worker.ts calls this
 * with `Authorization: Bearer $CRON_SECRET`; it can also be hit manually.
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization") ?? "";
  if (!env.cronSecret || auth !== `Bearer ${env.cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const report = await runScheduledJobs();
    return NextResponse.json({ ok: true, ...report });
  } catch (err) {
    console.error("cron tick failed", err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
