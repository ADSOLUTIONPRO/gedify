import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { listGedLogs, listGedWorkflows } from "@/lib/ged/ged-store";
import { listLogs as listMailLogs } from "@/lib/mail-connector/log-store";
import { safePaperlessCollection } from "@/lib/paperless-resources";
import { listProjectFolders } from "@/lib/projects/project-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [paperlessLogs, tasks, gedLogs, mailLogs, projects, workflows] = await Promise.all([
      safePaperlessCollection("/api/logs/"),
      safePaperlessCollection("/api/tasks/"),
      listGedLogs(100),
      listMailLogs({ limit: 100 }),
      listProjectFolders(),
      listGedWorkflows(),
    ]);

    return NextResponse.json({
      paperlessLogs: paperlessLogs.ok ? paperlessLogs.data.results : [],
      paperlessLogError: paperlessLogs.ok ? null : paperlessLogs.error,
      tasks: tasks.ok ? tasks.data.results : [],
      taskError: tasks.ok ? null : tasks.error,
      gedLogs,
      mailLogs,
      projects,
      workflows,
    });
  } catch (error) {
    return jsonError("Impossible de composer l'activité GED AzServer", error);
  }
}
