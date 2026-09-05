import type { Config } from "@netlify/functions";
import { enrich, isAuthorized, json, KEYS, parisDate, parseArray, readLogicalDocument, requireConfig } from "./_shared/nexora.js";

export default async (req: Request) => {
  if (req.method !== "GET") return json({ ok: false, error: "method_not_allowed" }, 405);
  const config = requireConfig();
  if (config.missing.length || !config.uid || !config.apiKey) return json({ ok: false, error: "configuration_missing", missing: config.missing }, 503);
  if (!isAuthorized(req, config.apiKey)) return json({ ok: false, error: "unauthorized" }, 401);

  const scope = new URL(req.url).searchParams.get("scope") || "today";
  if (!["today", "tasks", "catalogs", "health"].includes(scope)) return json({ ok: false, error: "invalid_scope" }, 400);
  try {
    const names = ["tasks", "archive", "projects", "statuses", "taskTypes", "teamMembers"] as const;
    const docs = await Promise.all(names.map(name => readLogicalDocument(config.uid!, KEYS[name])));
    const [tasks, archive, projects, statuses, taskTypes, teamMembers] = docs.map(parseArray);
    const all = enrich([...tasks, ...archive], projects, statuses, taskTypes);
    const today = parisDate();
    const dateOf = (task: any) => task.end || task.start || null;
    const active = all.filter((task: any) => !task.archivedAt && !task.completedAt);
    const payload: any = {
      ok: true,
      mode: "firebase-admin-readonly",
      writesEnabled: false,
      scope,
      date: today,
      health: {
        activeTaskCount: tasks.length,
        archivedTaskCount: archive.length,
        projectCount: projects.length,
        revisions: Object.fromEntries(docs.map(doc => [doc.key, { revision: doc.revision, updatedAt: doc.updatedAt, storageMode: doc.storageMode, chunkCount: doc.chunkCount }]))
      }
    };
    if (scope === "today") {
      payload.today = active.filter((task: any) => dateOf(task) === today);
      payload.overdue = active.filter((task: any) => dateOf(task) && dateOf(task) < today);
      payload.upcoming = active.filter((task: any) => dateOf(task) && dateOf(task) > today).sort((a: any, b: any) => dateOf(a).localeCompare(dateOf(b))).slice(0, 50);
    } else if (scope === "tasks") payload.tasks = all;
    else if (scope === "catalogs") payload.catalogs = { projects, statuses, taskTypes, teamMembers };
    return json(payload);
  } catch (error) {
    return json({ ok: false, mode: "firebase-admin-readonly", error: error instanceof Error ? error.message : String(error) }, 502);
  }
};

export const config: Config = { path: "/api/nexora/read", method: ["GET"] };
