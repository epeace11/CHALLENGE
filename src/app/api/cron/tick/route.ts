import { NextResponse, type NextRequest } from "next/server";
import { runScheduledJobs } from "@/lib/jobs";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Vercel Cron target. Vercel sends `Authorization: Bearer $CRON_SECRET`
 * automatically when CRON_SECRET is set in the project's environment.
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
