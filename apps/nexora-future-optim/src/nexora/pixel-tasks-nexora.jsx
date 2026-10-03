/* eslint-disable */
// @ts-nocheck
// Fichier GÉNÉRÉ par scripts/extraire-nexora.py — NE PAS MODIFIER À LA MAIN (retour du 03/10/2026).
// Module « Pixel Tasks » (Tâches du jour) de Nexora (dernier commit du dossier source : 9c48970), repris tel quel.
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, CheckCircle2, ChevronLeft, ChevronRight, ChevronsDown, ChevronsUp, Eye, EyeOff, Filter, Plus, Search, X, Grid3x3 } from "lucide-react";
import { Modal } from "./pixel-tasks-adaptateur";

// — ligne 1517
// === NEXORA:DATE-UTILS:START ===
/* Les trois briques de date de tout Nexora. Elles vivent derrière des
   sentinelles pour une raison précise : les blocs testés qui les appellent
   (NEXORA:STAFFING, par exemple) doivent être éprouvés avec les VRAIES, et non
   avec des copies écrites dans un fichier de test — qui finiraient par ne plus
   dire la même chose que l'application. */
const iso = (d) => {
  const dt = typeof d === "string" ? new Date(d + "T00:00:00") : d;
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const addDays = (dateStr, n) => {
  const dt = new Date(dateStr + "T00:00:00");
  dt.setDate(dt.getDate() + n);
  return iso(dt);
};
const DAY_MS = 86400000;
const dayIndex = (dateStr) => Math.round((new Date(dateStr + "T00:00:00") - new Date("2020-01-01T00:00:00")) / DAY_MS);
// === NEXORA:DATE-UTILS:END ===
// — ligne 2674
const uid = () => Math.random().toString(36).slice(2, 10);
// — ligne 2967
const isProtectedStatus = (status) => {
  const name = String(status?.name || "");
  return /termin/i.test(name) || /en\s*cours/i.test(name);
};
// — ligne 2972
const getStatusesForProject = (statuses, projects, projectId, currentStatusId = null) => {
  const project = (projects || []).find((p) => p.id === projectId);
  const disabled = new Set(project?.disabledStatusIds || []);

  const allowed = (statuses || []).filter((status) => {
    // Statut spécifique : uniquement dans son projet.
    if (status.projectId) return status.projectId === projectId;

    // Les statuts protégés globaux restent toujours disponibles.
    if (isProtectedStatus(status)) return true;

    // Statut global désactivé pour ce projet.
    return !disabled.has(status.id);
  });

  // Si une tâche existante utilise encore un statut désormais masqué,
  // on le conserve dans son sélecteur pour éviter une perte silencieuse.
  if (currentStatusId && !allowed.some((status) => status.id === currentStatusId)) {
    const current = (statuses || []).find((status) => status.id === currentStatusId);
    if (current) return [...allowed, current];
  }

  return allowed;
};
// — ligne 2997
const getDefaultStatusForProject = (statuses, projects, projectId) => {
  const allowed = getStatusesForProject(statuses, projects, projectId);
  return (
    allowed.find((s) => /planifier|nouveau|backlog|attente/i.test(s.name || "")) ||
    allowed.find((s) => /en\s*cours/i.test(s.name || "")) ||
    allowed[0] ||
    null
  );
};
// — ligne 3015
const isLockedTaskType = (type) => !!type?.locked;
// — ligne 3017
const getTaskTypesForProject = (taskTypes, projects, projectId, currentTaskTypeId = null) => {
  const project = (projects || []).find((p) => p.id === projectId);
  const disabled = new Set(project?.disabledTaskTypeIds || []);

  const allowed = (taskTypes || []).filter((type) => {
    // Type spécifique : uniquement dans son projet.
    if (type.projectId) return type.projectId === projectId;

    // Les types verrouillés globaux restent toujours disponibles.
    if (isLockedTaskType(type)) return true;

    // Type global désactivé pour ce projet.
    return !disabled.has(type.id);
  });

  // Si une tâche existante utilise encore un type désormais masqué, on le
  // conserve dans son sélecteur pour éviter une perte silencieuse.
  if (currentTaskTypeId && !allowed.some((type) => type.id === currentTaskTypeId)) {
    const current = (taskTypes || []).find((type) => type.id === currentTaskTypeId);
    if (current) return [...allowed, current];
  }

  return allowed;
};

const getDefaultTaskTypeForProject = (taskTypes, projects, projectId) => {
  const allowed = getTaskTypesForProject(taskTypes, projects, projectId);
  return (
    allowed.find((t) => isLockedTaskType(t) && /^t[âa]ches?$/i.test(t.name || "")) ||
    allowed.find((t) => isLockedTaskType(t)) ||
    allowed[0] ||
    null
  );
};

// Recherche un type de tâche par son nom (insensible à la casse, aux accents
// et au singulier/pluriel) — utilisé par les raccourcis clavier "créer une
// tâche de type X" qui doivent retrouver le type même s'il a été renommé
// légèrement ou si son id diffère des seeds par défaut ("tt2", "tt3"...).
// === NEXORA:TEXT-MATCH:START ===
const normalizeForMatch = (s) =>
  String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
// === NEXORA:TEXT-MATCH:END ===
const findTaskTypeByName = (taskTypes, name) => {
  const target = normalizeForMatch(name);
  const list = taskTypes || [];
  return (
    list.find((t) => normalizeForMatch(t.name) === target) ||
    list.find((t) => normalizeForMatch(t.name) === target + "s") ||
    list.find((t) => normalizeForMatch(t.name).startsWith(target)) ||
    null
  );
};

// Un type de tâche peut restreindre les tâches qui le portent à un UNIQUE
// statut automatique (ex. le type "Information", dont le seul statut possible
// est "Information") via `type.restrictedStatusId` — cette restriction prime
// sur les statuts habituellement autorisés par le projet.
// — ligne 3075
const restrictedStatusForType = (taskTypes, statuses, taskTypeId) => {
  const type = (taskTypes || []).find((t) => t.id === taskTypeId);
  if (!type?.restrictedStatusId) return null;
  return (statuses || []).find((s) => s.id === type.restrictedStatusId) || null;
};

// Équivalents de getStatusesForProject/getDefaultStatusForProject, mais qui
// tiennent compte en plus d'une éventuelle restriction posée par le type de
// la tâche (voir restrictedStatusForType ci-dessus).
const getStatusesForTask = (statuses, projects, taskTypes, projectId, taskTypeId, currentStatusId = null) => {
  const restricted = restrictedStatusForType(taskTypes, statuses, taskTypeId);
  if (restricted) return [restricted];
  return getStatusesForProject(statuses, projects, projectId, currentStatusId);
};
const getDefaultStatusForTask = (statuses, projects, taskTypes, projectId, taskTypeId) => {
  const restricted = restrictedStatusForType(taskTypes, statuses, taskTypeId);
  if (restricted) return restricted;
  return getDefaultStatusForProject(statuses, projects, projectId);
};
// — ligne 3342
function isTaskFocus(task) {
  return !!task && task.focus === true;
}
// — ligne 3570
function isTaskDoneGlobal(task, ctx) {
  const st = ctx.statuses.find((s) => s.id === task.statusId);
  return !!(st && /termin/i.test(st.name || ""));
}
// — ligne 444
function ViewToolbarPortal({ slot, children }) {
  if (!slot) return null;
  return createPortal(<>{children}</>, slot);
}
// — ligne 4593
function habitPixelWirePath(rowY, pixelX, pixelBottom, radius) {
  const r = Math.max(0, Math.min(Number(radius) || 0, pixelX, rowY - pixelBottom));
  return `M 0 ${rowY} H ${pixelX - r} Q ${pixelX} ${rowY} ${pixelX} ${rowY - r} V ${pixelBottom}`;
}
// — ligne 13220
const HPX_HEAD_H = 36; // en-tête de catégorie (hauteur de la rangée de pixels)
const HPX_ROW_H = 24; // une ligne d'habitude
const HPX_PX = 28; // un pixel du jour affiché
const HPX_GAP = 10;
const HPX_PAD = 4; // marge intérieure de la rangée de pixels
const HPX_LEFT = 40; // retrait de la rangée de pixels après les lignes
// — ligne 13228
function hpxDayLabel(date, todayIso) {
  if (date === todayIso) return "Aujourd'hui";
  if (date === addDays(todayIso, -1)) return "Hier";
  if (date === addDays(todayIso, 1)) return "Demain";
  const d = new Date(date + "T00:00:00");
  const s = d.toLocaleDateString("fr-FR", { weekday: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
// — ligne 13236
function hpxLongDate(date) {
  return new Date(date + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}
// — ligne 13241
function hpxSubDate(date, todayIso) {
  const rel = [addDays(todayIso, -1), todayIso, addDays(todayIso, 1)].includes(date);
  return new Date(date + "T00:00:00").toLocaleDateString("fr-FR", rel ? { weekday: "long", day: "numeric", month: "long" } : { day: "numeric", month: "long", year: "numeric" });
}
// — ligne 13245
function hpxWeekStart(date) {
  const d = new Date(date + "T00:00:00");
  return addDays(date, -((d.getDay() + 6) % 7));
}
// — ligne 13324
const HPX_VIEWS = [["day", "Jour"], ["week", "Semaine"], ["month", "Mois"]];
// — ligne 13325
function hpxAddMonths(date, n) {
  const d = new Date(date + "T00:00:00");
  return iso(new Date(d.getFullYear(), d.getMonth() + n, 1));
}
// — ligne 4822
// === NEXORA:PIXEL-TASKS:START ===
/* Pixel des tâches (#524) : la vue Jour du Pixel des habitudes appliquée aux
   tâches filtrées d'un widget. Logique pure (testée), rendu dans
   WidgetPixelTasks. */
const PIXEL_TASKS_GROUP_BY = [["project", "Projet"], ["folder", "Dossier"], ["status", "Statut"], ["assignee", "Responsable"], ["taskType", "Type"]];
// Packages de cases dans une rangée : les mêmes clés, plus Jalon / Tâche.
const PIXEL_TASKS_PACKAGE_BY = [["none", "Aucun"], ["kind", "Jalon / tâche avec durée"], ...PIXEL_TASKS_GROUP_BY];
// Sous-groupes « Rameaux » (#546) : les mêmes clés, sous chaque groupe principal.
const PIXEL_TASKS_SUB_BY = [["none", "Aucun"], ...PIXEL_TASKS_GROUP_BY, ["kind", "Jalon / durée"]];
const PIXEL_TASKS_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/* Une tâche s'affiche à UNE seule date : sa date de jalon si c'est un jalon,
   sa date de fin sinon (repli sur l'autre borne quand la première manque).
   Jamais répétée sur chaque jour de sa durée. */
function pixelTaskDate(task) {
  if (!task) return null;
  const first = task.milestone ? task.start : task.end;
  const second = task.milestone ? task.end : task.start;
  if (PIXEL_TASKS_DATE_RE.test(first || "")) return first;
  if (PIXEL_TASKS_DATE_RE.test(second || "")) return second;
  return null;
}

// Même définition que isTaskDoneGlobal : statut dont le nom contient « termin ».
function pixelTaskIsDone(task, statuses) {
  const st = (statuses || []).find((s) => s.id === task.statusId);
  return !!(st && /termin/i.test(st.name || ""));
}

/* Tâches d'un jour. Aujourd'hui reprend en plus les tâches non terminées dont
   la date est passée, marquées en retard (lateDays = jours de retard) : elles
   restent sous les yeux tant qu'elles ne sont pas faites. Une fois terminée,
   une tâche ne s'affiche plus qu'à sa propre date (la date de complétion
   n'intervient pas : clore d'anciennes réunions ne les ramène pas au jour). */
function pixelTasksForDay(tasks, date, todayIso, statuses, options) {
  const ghosts = !!(options && options.ghosts);
  const futureDays = Math.max(0, Math.round(Number(options && options.futureDays) || 0));
  const items = [];
  for (const task of tasks || []) {
    const d = pixelTaskDate(task);
    if (!d) continue;
    const done = pixelTaskIsDone(task, statuses);
    /* Fantômes (option) : tâches EN COURS à cette date — début avant, fin
       après — qui ne s'affichent pas d'ordinaire (une tâche n'apparaît qu'à
       sa date de jalon ou de fin). Montrées à part, hors score. */
    if (ghosts && d > date && PIXEL_TASKS_DATE_RE.test(task.start || "") && task.start < date && PIXEL_TASKS_DATE_RE.test(task.end || "") && task.end > date) {
      items.push({ task, date: d, done, lateDays: 0, carried: false, ghost: true });
      continue;
    }
    /* Futur (option, fenêtre de futureDays jours) : tâches ENTIÈREMENT à
       venir — début, fin, date de jalon après la date affichée. Hors score. */
    if (futureDays && d > date && !(PIXEL_TASKS_DATE_RE.test(task.start || "") && task.start <= date)) {
      const ahead = dayIndex(d) - dayIndex(date);
      if (ahead <= futureDays) items.push({ task, date: d, done, lateDays: 0, carried: false, future: true, daysAhead: ahead });
      continue;
    }
    if (d === date) {
      const lateDays = !done && d < todayIso ? dayIndex(todayIso) - dayIndex(d) : 0;
      items.push({ task, date: d, done, lateDays, carried: false });
    } else if (d < date && date === todayIso && !done) {
      items.push({ task, date: d, done, lateDays: dayIndex(todayIso) - dayIndex(d), carried: true });
    }
  }
  const layer = (i) => (i.future ? 2 : i.ghost ? 1 : 0);
  items.sort((a, b) => (layer(a) - layer(b))
    || ((a.daysAhead || 0) - (b.daysAhead || 0))
    || (Number(a.done) - Number(b.done))
    || (b.lateDays - a.lateDays)
    || String(a.task.startTime || "99").localeCompare(String(b.task.startTime || "99"))
    || String(a.task.title || "").localeCompare(String(b.task.title || ""), "fr"));
  const counted = items.filter((i) => !i.ghost && !i.future);
  return { items, done: counted.filter((i) => i.done).length, total: counted.length, ghosts: items.filter((i) => i.ghost).length, future: items.filter((i) => i.future).length };
}

/* Regroupement des tâches du jour (projet par défaut). Groupes triés par nom,
   le groupe « Sans … » en dernier. */
/* Clé de regroupement d'une tâche ({id, name, color}, null = « Sans … »).
   Sert aux groupes (rangées) comme aux packages (cases d'une rangée). */
function pixelTaskKey(t, by, ctx) {
  const c = ctx || {};
  if (by === "kind") return t.milestone ? { id: "k:milestone", name: "Jalons", color: "#c2410c" } : { id: "k:task", name: "Tâches avec durée", color: "#475569" };
  if (by === "status") {
    const st = (c.statuses || []).find((s) => s.id === t.statusId);
    return st ? { id: "s:" + st.id, name: st.name, color: st.color || "#94A3B8" } : null;
  }
  if (by === "assignee") {
    const name = String(t.assignee || "").trim();
    if (!name) return null;
    const m = (c.teamMembers || []).find((u) => u.name === name);
    return { id: "a:" + name, name, color: (m && m.color) || "#94A3B8" };
  }
  if (by === "taskType") {
    const tt = (c.taskTypes || []).find((x) => x.id === t.taskTypeId);
    return tt ? { id: "t:" + tt.id, name: tt.name, color: tt.color || "#94A3B8" } : null;
  }
  const p = (c.projects || []).find((x) => x.id === t.projectId);
  if (by === "folder") {
    // Dossier du projet principal, affiché avec son chemin (Parent › Enfant).
    const folders = c.projectFolders || [];
    const f = p && folders.find((x) => x.id === p.folderId);
    if (!f) return null;
    const names = [];
    const seen = new Set();
    for (let cur = f; cur && !seen.has(cur.id); cur = folders.find((x) => x.id === cur.parentId)) { seen.add(cur.id); names.unshift(cur.name); }
    return { id: "f:" + f.id, name: names.join(" › "), color: f.color || "#94A3B8" };
  }
  return p ? { id: "p:" + p.id, name: p.name, color: p.color || "#94A3B8" } : null;
}
const PIXEL_TASKS_EMPTY_LABELS = { status: "Sans statut", assignee: "Non attribuée", taskType: "Sans type", folder: "Sans dossier", project: "Sans projet" };

// Regroupe des entrées par clé ; groupes triés par nom, « Sans … » en dernier.
function pixelTaskBucket(items, by, ctx) {
  const map = new Map();
  for (const item of items || []) {
    const k = pixelTaskKey(item.task, by, ctx) || { id: "none", name: PIXEL_TASKS_EMPTY_LABELS[by] || "Sans valeur", color: "#94A3B8" };
    if (!map.has(k.id)) map.set(k.id, { ...k, items: [], done: 0, total: 0 });
    const g = map.get(k.id);
    g.items.push(item);
    if (!item.ghost && !item.future) { g.total += 1; if (item.done) g.done += 1; }
  }
  return [...map.values()].sort((a, b) => (a.id === "none") - (b.id === "none") || String(a.name).localeCompare(String(b.name), "fr"));
}

/* Regroupement des tâches du jour en rangées (projet par défaut), puis, dans
   chaque rangée, en « packages » de cases (packageBy, « none » = aucun) : les
   entrées d'un même package se suivent, lignes et cases dans le même ordre
   pour que les liaisons restent droites. g.packages = [{id, name, color,
   start, count}] ; sans package, un seul bloc couvre toute la rangée.
   subBy (#546, « none » ou égal à groupBy = aucun) : chaque groupe reçoit
   g.subgroups, regroupés et empaquetés de la même façon, chacun avec sa
   propre rangée de cases et une clé de repli unique (key = groupe › sous-
   groupe) ; g.items et g.packages mettent alors les sous-groupes bout à bout. */
function pixelTaskGroupsFor(items, groupBy, ctx, packageBy, subBy) {
  const groups = pixelTaskBucket(items, groupBy, ctx);
  const withSubs = !!subBy && subBy !== "none" && subBy !== groupBy;
  for (const g of groups) {
    if (withSubs) {
      g.subgroups = pixelTaskGroupsFor(g.items, subBy, ctx, packageBy).map((sg) => ({ ...sg, key: g.id + "›" + sg.id }));
      let start = 0;
      g.items = [];
      g.packages = [];
      for (const sg of g.subgroups) {
        g.items.push(...sg.items);
        for (const p of sg.packages) g.packages.push({ ...p, id: sg.key + "›" + p.id, start: start + p.start });
        start += sg.items.length;
      }
      continue;
    }
    // Fantômes puis futur ferment la rangée, chacun dans son propre package.
    const real = g.items.filter((i) => !i.ghost && !i.future);
    const ghostItems = g.items.filter((i) => i.ghost);
    const futureItems = g.items.filter((i) => i.future);
    let packs;
    if (!packageBy || packageBy === "none") packs = real.length ? [{ id: "all", name: "", color: g.color, items: real }] : [];
    else packs = pixelTaskBucket(real, packageBy, ctx);
    if (ghostItems.length) packs.push({ id: "ghost", name: "Fantômes (en cours)", color: "#94A3B8", items: ghostItems });
    if (futureItems.length) packs.push({ id: "future", name: "Horizon (à venir)", color: "#6366F1", items: futureItems });
    let start = 0;
    g.items = [];
    g.packages = packs.map((p) => {
      const out = { id: p.id, name: p.name, color: p.color, start, count: p.items.length };
      g.items.push(...p.items);
      start += p.items.length;
      return out;
    });
  }
  return groups;
}

/* Groupes affichés en vue Jour : base (tâches du jour) et/ou terminées
   masquées. Les compteurs done / total de chaque groupe et sous-groupe
   restent ceux de la journée complète (fullGroups), pour que « 3 / 10 » ne
   devienne pas « 0 / 7 » quand les terminées sont cachées. Un groupe dont
   toutes les tâches visibles sont terminées disparaît. */
function pixelTaskVisibleGroups(items, fullGroups, opts, groupBy, ctx, packageBy, subBy) {
  const base = !(opts && opts.base === false);
  const hideDone = !!(opts && opts.hideDone);
  // keep (#560, #563) : filtre supplémentaire (recherche, puces, bandeau Focus).
  const keep = opts && typeof opts.keep === "function" ? opts.keep : null;
  if (base && !hideDone && !keep) return fullGroups;
  const kept = (items || []).filter((i) => (base || i.ghost || i.future) && !(hideDone && i.done) && (!keep || keep(i)));
  const groups = pixelTaskGroupsFor(kept, groupBy, ctx, packageBy, subBy);
  if (!hideDone && !keep) return groups;
  const counts = new Map();
  for (const g of fullGroups || []) {
    counts.set(g.id, g);
    for (const sg of g.subgroups || []) counts.set(sg.key, sg);
  }
  const restore = (g, k) => { const src = counts.get(k); return src ? { ...g, done: src.done, total: src.total } : g; };
  return groups.map((g) => {
    const out = restore(g, g.id);
    return g.subgroups ? { ...out, subgroups: g.subgroups.map((sg) => restore(sg, sg.key)) } : out;
  });
}

/* Saisie rapide (#557, #567) : « titre !jalon @Nom >ven ~2h ». Renvoie le titre
   nettoyé et ce que la syntaxe courte fixe ; date = jour affiché à défaut.
   @Nom : membre de l'équipe dont le nom commence par le texte (accents et
   casse ignorés ; le nom le plus long l'emporte), sinon le mot tel quel.
   >demain, >lun…>dim (prochain jour de ce nom, jamais le jour même), >+3,
   >12/10 ou >12/10/2026 (l'année suit si la date est déjà passée). */
const PIXEL_TASKS_WEEKDAYS = { dim: 0, lun: 1, mar: 2, mer: 3, jeu: 4, ven: 5, sam: 6 };
function pixelTaskFold(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
function pixelTaskQuickDate(token, dayIso) {
  const t = pixelTaskFold(token);
  if (t === "auj" || t === "aujourdhui") return dayIso;
  if (t === "demain") return addDays(dayIso, 1);
  let m = /^\+(\d{1,3})j?$/.exec(t);
  if (m) return addDays(dayIso, Number(m[1]));
  const wd = PIXEL_TASKS_WEEKDAYS[t.slice(0, 3)];
  if (wd !== undefined && /^[a-z]+$/.test(t)) {
    const cur = new Date(dayIso + "T00:00:00").getDay();
    return addDays(dayIso, ((wd - cur + 7) % 7) || 7);
  }
  m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/.exec(t);
  if (m) {
    const pad = (n) => String(n).padStart(2, "0");
    const y = m[3] ? Number(m[3]) : Number(dayIso.slice(0, 4));
    const d = new Date(y, Number(m[2]) - 1, Number(m[1]));
    if (d.getMonth() !== Number(m[2]) - 1) return null;
    let out = `${y}-${pad(m[2])}-${pad(m[1])}`;
    if (!m[3] && out < dayIso) out = `${y + 1}-${pad(m[2])}-${pad(m[1])}`;
    return out;
  }
  return null;
}
/* Durée (#567) : « 2h », « 1h30 », « 1,5h », « 45m », « 45min », « 90 ».
   Nombre seul : heures jusqu'à 12, minutes au-delà. Renvoie des minutes
   (entières, > 0, au plus 24 h) ou null. */
function pixelTaskParseDuration(token) {
  const t = String(token || "").trim().toLowerCase().replace(",", ".");
  let m = /^(\d+(?:\.\d+)?)\s*h(?:\s*(\d{1,2})\s*(?:m|min)?)?$/.exec(t);
  let min = null;
  if (m) min = Number(m[1]) * 60 + (m[2] ? Number(m[2]) : 0);
  else if ((m = /^(\d+)\s*(?:m|mn|min)$/.exec(t))) min = Number(m[1]);
  else if ((m = /^(\d+(?:\.\d+)?)$/.exec(t))) min = Number(m[1]) <= 12 ? Number(m[1]) * 60 : Number(m[1]);
  if (min == null || !Number.isFinite(min)) return null;
  min = Math.round(min);
  return min > 0 && min <= 24 * 60 ? min : null;
}
function pixelTaskParseQuickAdd(text, dayIso, teamMembers) {
  let rest = " " + String(text || "") + " ";
  const out = { title: "", milestone: false, assignee: "", date: dayIso, estimate: 0 };
  rest = rest.replace(/\s!(jalon|j)(?=\s)/gi, () => { out.milestone = true; return " "; });
  rest = rest.replace(/\s~(\S+)(?=\s)/g, (all, tok) => { const d = pixelTaskParseDuration(tok); if (!d) return all; out.estimate = d; return " "; });
  rest = rest.replace(/\s>(\S+)(?=\s)/g, (all, tok) => { const d = pixelTaskQuickDate(tok, dayIso); if (!d) return all; out.date = d; return " "; });
  const at = rest.indexOf(" @");
  if (at !== -1) {
    const after = rest.slice(at + 2);
    const folded = pixelTaskFold(after);
    const member = (teamMembers || [])
      .filter((u) => u && u.name && folded.startsWith(pixelTaskFold(u.name)) && /^(\s|$)/.test(after.slice(String(u.name).length)))
      .sort((a, b) => b.name.length - a.name.length)[0];
    const word = member ? member.name : (/^\S+/.exec(after) || [""])[0];
    if (word) { out.assignee = member ? member.name : word; rest = rest.slice(0, at) + " " + after.slice(word.length); }
  }
  out.title = rest.replace(/\s+/g, " ").trim();
  return out;
}

/* Replanifier (#558, #559) : la date de fin passe au jour visé ; un jalon y
   met début et fin ; un début postérieur au jour visé y est ramené. Renvoie
   le patch, ou null si rien ne change. */
function pixelTaskReschedule(task, targetIso) {
  if (!task || !PIXEL_TASKS_DATE_RE.test(String(targetIso || ""))) return null;
  if (task.milestone) return task.start === targetIso && task.end === targetIso ? null : { start: targetIso, end: targetIso };
  const patch = {};
  if (task.end !== targetIso) patch.end = targetIso;
  if (!task.start || task.start > targetIso) patch.start = targetIso;
  return Object.keys(patch).length ? patch : null;
}
// Prochain lundi strictement après le jour donné.
function pixelTaskNextMonday(dayIso) {
  const cur = new Date(dayIso + "T00:00:00").getDay();
  return addDays(dayIso, ((1 - cur + 7) % 7) || 7);
}

/* Filtres éclair (#563) : recherche dans le titre (accents et casse
   ignorés) et puces combinables. lateDays > 0 et non terminée = retard. */
function pixelTaskMatches(item, f) {
  if (!f) return true;
  const t = item.task || {};
  if (f.query && !pixelTaskFold(t.title).includes(pixelTaskFold(f.query).trim())) return false;
  if (f.late && !(item.lateDays > 0 && !item.done)) return false;
  if (f.milestone && !t.milestone) return false;
  if (f.focus && t.focus !== true) return false;
  if (f.assignee && String(t.assignee || "") !== f.assignee) return false;
  return true;
}
function pixelTaskFilterActive(f) {
  return !!(f && ((f.query && f.query.trim()) || f.late || f.milestone || f.focus || f.assignee));
}

/* Charge du jour (#561, #565). estimateMinutes : champ optionnel de la
   tâche. Prévu = estimations des tâches du jour non terminées (hors fantômes
   et futur) ; une réunion n'y entre que si on l'a estimée, comme toute
   tâche — aucune durée n'est déduite automatiquement. Disponible = capacité
   du jour (pixelTaskCapacityFor). */
function pixelTaskEstimate(task) {
  const n = Number(task && task.estimateMinutes);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}
function pixelTaskLoad(items, capacityMinutes, groupOf) {
  const capacity = Math.max(0, Number(capacityMinutes) || 0);
  const parts = new Map();
  let planned = 0, unestimated = 0;
  for (const it of items || []) {
    if (it.ghost || it.future || it.done) continue;
    const e = pixelTaskEstimate(it.task);
    if (!e) { unestimated += 1; continue; }
    planned += e;
    const g = groupOf ? groupOf(it) : { id: "all", name: "", color: "#94A3B8" };
    if (!parts.has(g.id)) parts.set(g.id, { ...g, minutes: 0 });
    parts.get(g.id).minutes += e;
  }
  return { capacity, free: capacity, planned, unestimated, over: Math.max(0, planned - capacity), parts: [...parts.values()] };
}
/* Capacité d'un jour, en heures (#565) : exception datée, sinon valeur du
   jour de la semaine (0 = dimanche … 6 = samedi), sinon capacité unique
   d'avant #565, sinon 7 h. 0 = jour non travaillé. */
const PIXEL_TASKS_DEFAULT_CAPACITY = 7;
function pixelTaskCapacityValid(v) {
  return v !== undefined && v !== null && v !== "" && Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 24;
}
function pixelTaskCapacityFor(dayIso, prefs) {
  const p = prefs || {};
  if (p.dates && pixelTaskCapacityValid(p.dates[dayIso])) return Number(p.dates[dayIso]);
  const wd = new Date(dayIso + "T00:00:00").getDay();
  if (p.byDay && pixelTaskCapacityValid(p.byDay[wd])) return Number(p.byDay[wd]);
  return pixelTaskCapacityValid(p.base) && Number(p.base) > 0 ? Number(p.base) : PIXEL_TASKS_DEFAULT_CAPACITY;
}
// Exceptions datées : on oublie celles de plus de 60 jours.
function pixelTaskCapacityDates(dates, dayIso, hours, todayIso) {
  const out = {};
  const limit = addDays(todayIso, -60);
  for (const [d, v] of Object.entries(dates || {})) if (d >= limit && d !== dayIso && pixelTaskCapacityValid(v)) out[d] = Number(v);
  if (pixelTaskCapacityValid(hours)) out[dayIso] = Number(hours);
  return out;
}
/* Report proposé : parmi les tâches estimées non terminées, ni Focus, ni en
   retard, ni jalon, ni à heure fixe, les plus grosses d'abord jusqu'à
   couvrir le surplus. */
function pixelTaskOverflowCandidates(items, overMinutes) {
  if (!(overMinutes > 0)) return [];
  const pool = (items || []).filter((it) => !it.ghost && !it.future && !it.done && !(it.lateDays > 0) && !it.task.milestone && it.task.focus !== true && !it.task.startTime && pixelTaskEstimate(it.task))
    .sort((a, b) => pixelTaskEstimate(b.task) - pixelTaskEstimate(a.task));
  const out = [];
  let covered = 0;
  for (const it of pool) { if (covered >= overMinutes) break; out.push(it); covered += pixelTaskEstimate(it.task); }
  return out;
}
function pixelTaskMinutesLabel(min) {
  const n = Math.max(0, Math.round(Number(min) || 0));
  const h = Math.floor(n / 60), m = n % 60;
  return h ? (m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`) : `${m} min`;
}
const PIXEL_TASKS_ESTIMATES = [15, 30, 60, 90, 120, 180, 240, 480];

/* Clôture de la journée (#562) : tâches du jour non terminées, retards
   d'abord (les plus anciens en tête), puis dans l'ordre d'affichage. */
function pixelTaskClosureList(items) {
  return (items || []).filter((it) => !it.ghost && !it.future && !it.done)
    .map((it, i) => ({ it, i }))
    .sort((a, b) => (b.it.lateDays || 0) - (a.it.lateDays || 0) || a.i - b.i)
    .map((x) => x.it);
}

/* Ruban spectral d'un groupe (#546) : un segment par sous-groupe, largeur =
   part des tâches comptées du groupe (fantômes et futur à défaut), done =
   part terminée du segment (0 à 1). */
function pixelTaskSpectrum(subgroups) {
  const list = Array.isArray(subgroups) ? subgroups : [];
  const weightOf = (sg) => sg.total || sg.items.length;
  const sum = list.reduce((n, sg) => n + weightOf(sg), 0) || 1;
  return list.map((sg) => ({ id: sg.key || sg.id, name: sg.name, color: sg.color, weight: weightOf(sg) / sum, done: sg.total ? sg.done / sg.total : 0, count: sg.total, doneCount: sg.done }));
}

/* Bourgeon d'un sous-groupe : share = part terminée (arc de l'anneau), bloom
   = tout est fait (au moins une tâche comptée), empty = rien à compter. */
function pixelTaskBud(sg) {
  const total = (sg && sg.total) || 0;
  const done = (sg && sg.done) || 0;
  return { share: total ? done / total : 0, bloom: total > 0 && done >= total, empty: total === 0 };
}

// Côté du carré journalier : assez grand pour la plus longue rangée et le
// nombre de groupes (même principe que habitPixelSquareSize).
function pixelTasksSquareSize(groups) {
  const list = Array.isArray(groups) ? groups : [];
  return Math.max(list.length, list.reduce((m, g) => Math.max(m, g.items.length), 0), 1);
}
/* Anneau de progression : position du pointeur (dx, dy relatifs au centre)
   → pourcentage, 0 en haut, sens horaire, arrondi au pas (5 % par défaut).
   Tout près du haut, côté gauche, on reste à 100 % plutôt que de retomber à 0. */
function pixelTaskRingValue(dx, dy, step) {
  const s = Number(step) > 0 ? Number(step) : 5;
  let deg = Math.atan2(dx, -dy) * 180 / Math.PI;
  if (deg < 0) deg += 360;
  const v = Math.round((deg / 360) * 100 / s) * s;
  return Math.max(0, Math.min(100, v === 0 && dx < 0 ? 100 : v));
}
/* Contour d'une case (carré arrondi ou rond) en chemin SVG qui part du
   milieu du bord haut et tourne dans le sens horaire : sert à foncer la part
   accomplie du trait existant (avancement), sans trait ajouté. inset = demi-
   épaisseur du trait, pour poser le tracé exactement sur le contour. */
function pixelTaskOutlinePath(size, radius, inset, round) {
  const s = Number(size) || 0, o = Number(inset) || 0, w = s - 2 * o;
  const mid = s / 2;
  if (round) { const r = w / 2; return `M ${mid} ${o} A ${r} ${r} 0 1 1 ${mid - 0.01} ${o}`; }
  const r = Math.max(0, Math.min(w / 2, (Number(radius) || 0) - o));
  return `M ${mid} ${o} H ${o + w - r} A ${r} ${r} 0 0 1 ${o + w} ${o + r} V ${o + w - r} A ${r} ${r} 0 0 1 ${o + w - r} ${o + w} H ${o + r} A ${r} ${r} 0 0 1 ${o} ${o + w - r} V ${o + r} A ${r} ${r} 0 0 1 ${o + r} ${o} Z`;
}
const PIXEL_TASKS_FUTURE_WINDOWS = [0, 7, 14, 30, 90];
// === NEXORA:PIXEL-TASKS:END ===
// — ligne 13647
/* ============================================================================
   Pixel des tâches (#524) : la vue du Pixel des habitudes appliquée aux tâches
   filtrées du widget. 1 tâche = 1 pixel, affichée à sa date de jalon (jalon)
   ou de fin (sinon) — voir NEXORA:PIXEL-TASKS. Couleur = statut, ✓ = terminée,
   barre du bas = avancement, anneau rouge = en retard.
   ============================================================================ */
function ptxStatusColor(task, ctx) {
  const st = (ctx.statuses || []).find((s) => s.id === task.statusId);
  return (st && st.color) || "#94A3B8";
}
function ptxBadge(item) {
  if (item.future) return { text: (item.task.milestone ? "◆ " : "") + "dans " + item.daysAhead + " j", cls: " is-horizon" };
  if (item.ghost) return { text: "fin " + String(item.task.end || "").slice(8, 10) + "/" + String(item.task.end || "").slice(5, 7), cls: " is-ghost" };
  if (item.lateDays > 0 && !item.done) return { text: "retard " + item.lateDays + " j", cls: " is-late" };
  if (item.task.startTime) return { text: item.task.startTime, cls: "" };
  if (item.task.milestone) return { text: "jalon", cls: " is-milestone" };
  return null;
}
function ptxLabel(item, ctx) {
  const st = (ctx.statuses || []).find((s) => s.id === item.task.statusId);
  const bits = [item.task.title || "Sans titre", st ? st.name : "Sans statut"];
  if (!item.done && Number(item.task.progress) > 0) bits.push(Math.round(Number(item.task.progress)) + " %");
  if (item.lateDays > 0 && !item.done) bits.push("en retard de " + item.lateDays + " j");
  if (item.task.milestone) bits.push("jalon");
  if (isTaskFocus(item.task)) bits.push("focus");
  if (item.ghost) bits.push("en cours jusqu'au " + String(item.task.end || "").split("-").reverse().join("/"));
  if (item.future) bits.push("à venir, dans " + item.daysAhead + " j");
  return bits.join(" — ") + ". Clic : ouvrir la fiche";
}

function TaskPixel({ item, ctx, size, focused, onClick, onHover, clickHint, futureWindow, extra }) {
  const t = item.task;
  const progress = Math.max(0, Math.min(100, Number(t.progress) || 0));
  // Jalon = pixel rond, tâche avec durée = pixel carré ; futur = « horizon ».
  const cls = "lp-hpx-px lp-ptx-px " + (item.done ? "is-done" : "is-todo") + (item.ghost ? " is-ghost" : "") + (item.future ? " is-horizon" : "") + (isTaskFocus(t) ? " is-flagged" : "") + (t.milestone ? " is-milestone" : "") + (item.lateDays > 0 && !item.done ? " is-late" : "") + (focused ? " is-focus" : "");
  const style = { "--c": ptxStatusColor(t, ctx), width: size, height: size };
  // Futur : plus l'échéance est loin dans la fenêtre, plus la case s'efface.
  if (item.future && futureWindow) style.opacity = Math.max(0.4, 1 - (item.daysAhead / futureWindow) * 0.6);
  const inner = item.future
    ? (size >= 20 ? <span className="lp-ptx-px-j">J+{item.daysAhead}</span> : null)
    : size < 20 ? null : item.done ? <Check size={Math.round(size * 0.5)} strokeWidth={3} /> : null;
  /* Avancement : la part accomplie du contour EXISTANT se fonce (même trait,
     même épaisseur), du milieu du bord haut, sens horaire. */
  const sw = item.future ? 2 : 1.5;
  const ring = !item.done && progress > 0 && size >= 14 ? (
    <svg className="lp-ptx-ring-outline" viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <path d={pixelTaskOutlinePath(size, 5, item.ghost ? 1.25 : sw / 2, !!t.milestone)} pathLength="100" strokeWidth={sw} strokeDasharray={`${progress} 100`} />
    </svg>
  ) : null;
  /* Focus : une comète lumineuse (traînée qui luit + tête vive) fait le tour
     du bord de la case en changeant de couleur, et deux étoiles scintillent
     aux coins. Le point de départ est tiré au hasard UNE fois par tâche (dérivé
     de son id, donc stable d'un rendu à l'autre) : les cases Focus ne tournent
     pas en même temps. */
  const sparkSeed = isTaskFocus(t) ? ptxSparkSeed(t.id) : 0;
  const sparkStyle = { "--ptx-spark-delay": `${-(sparkSeed * 3.6).toFixed(2)}s`, "--ptx-hue-delay": `${-(((sparkSeed * 7.3) % 1) * 7.2).toFixed(2)}s`, "--ptx-star-delay": `${-(((sparkSeed * 13.7) % 1) * 2.6).toFixed(2)}s` };
  const star = (pos) => (
    <svg className={"lp-ptx-star is-" + pos} viewBox="0 0 10 10" aria-hidden="true"><path d="M5 0 Q5.6 4.4 10 5 Q5.6 5.6 5 10 Q4.4 5.6 0 5 Q4.4 4.4 5 0Z" /></svg>
  );
  const spark = isTaskFocus(t) && size >= 14 ? (() => {
    const sparkPath = pixelTaskOutlinePath(size, 5, item.ghost ? 1.25 : sw / 2, !!t.milestone);
    return (
      <span className="lp-ptx-spark-wrap" style={sparkStyle} aria-hidden="true">
        <svg className="lp-ptx-spark" viewBox={`0 0 ${size} ${size}`}>
          <path className="lp-ptx-spark-trail" d={sparkPath} pathLength="100" />
          <path className="lp-ptx-spark-head" d={sparkPath} pathLength="100" />
        </svg>
        {star("tr")}
        {star("bl")}
      </span>
    );
  })() : null;
  if (!onClick) return <span className={cls} style={style} aria-hidden="true">{inner}{ring}{spark}</span>;
  const label = clickHint ? ptxLabel(item, ctx).replace(/Clic : ouvrir la fiche$/, clickHint) : ptxLabel(item, ctx);
  return (
    <button
      type="button"
      className={cls}
      style={style}
      onClick={onClick}
      onMouseEnter={onHover ? () => onHover(t.id) : undefined}
      onMouseLeave={onHover ? () => onHover(null) : undefined}
      onFocus={onHover ? () => onHover(t.id) : undefined}
      onBlur={onHover ? () => onHover(null) : undefined}
      aria-label={label}
      title={label}
      {...(extra || {})}
    >{inner}{ring}{spark}</button>
  );
}

// Graine pseudo-aléatoire dans [0, 1) tirée de l'id de la tâche : décale le
// départ de l'éclat Focus sans le faire sauter à chaque rendu.
function ptxSparkSeed(id) {
  let h = 2166136261;
  const str = String(id || "");
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 10000) / 10000;
}

function TaskPixelMosaic({ groups: allGroups, day, ctx, size = 8, gap = 2 }) {
  // Le carré journalier ne compte que les vraies tâches du jour, sans fantômes.
  const groups = allGroups.map((g) => ({ ...g, items: g.items.filter((i) => !i.ghost && !i.future) })).filter((g) => g.items.length);
  const n = pixelTasksSquareSize(groups);
  const filler = (key) => <span key={key} className="lp-hpx-px is-filler" style={{ width: size, height: size }} aria-hidden="true" />;
  const rows = groups.map((g) => (
    <span key={g.id} className="lp-hpx-mosaic-row" style={{ gap }}>
      {g.items.map((it) => <TaskPixel key={it.task.id} item={it} ctx={ctx} size={size} />)}
      {Array.from({ length: n - g.items.length }, (_, i) => filler("f" + i))}
    </span>
  ));
  for (let r = groups.length; r < n; r++) {
    rows.push(<span key={"r" + r} className="lp-hpx-mosaic-row" style={{ gap }}>{Array.from({ length: n }, (_, i) => filler("f" + i))}</span>);
  }
  return <span className="lp-hpx-mosaic" style={{ gap }} role="img" aria-label={`${day.done} tâches terminées sur ${day.total}`}>{rows}</span>;
}

/* Bourgeon d'un sous-groupe (#546) : anneau dont l'arc se remplit avec les
   tâches terminées, puis fleur éclose (cinq pétales, léger halo) quand tout
   est fait. */
function TaskPixelBud({ sg, size = 18 }) {
  const b = pixelTaskBud(sg);
  const c = 2 * Math.PI * 6.5;
  return (
    <svg className={"lp-ptx-bud" + (b.bloom ? " is-bloom" : "") + (b.empty ? " is-empty" : "")} width={size} height={size} viewBox="0 0 18 18" style={{ "--bc": sg.color }} aria-hidden="true">
      {b.bloom ? (
        <g className="lp-ptx-bud-flower">
          {[0, 72, 144, 216, 288].map((a) => <ellipse key={a} cx="9" cy="4.7" rx="3" ry="4.2" transform={`rotate(${a} 9 9)`} />)}
          <circle className="lp-ptx-bud-heart" cx="9" cy="9" r="2.6" />
        </g>
      ) : (
        <g>
          <circle className="lp-ptx-bud-track" cx="9" cy="9" r="6.5" />
          {b.share > 0 && <circle className="lp-ptx-bud-arc" cx="9" cy="9" r="6.5" strokeDasharray={`${(b.share * c).toFixed(2)} ${c.toFixed(2)}`} transform="rotate(-90 9 9)" />}
          <circle className="lp-ptx-bud-core" cx="9" cy="9" r="2.4" />
        </g>
      )}
    </svg>
  );
}

/* Ruban spectral (#546) : un segment par sous-groupe, largeur = nombre de
   tâches, part foncée = terminées. */
function TaskPixelSpectrum({ subgroups }) {
  const segs = pixelTaskSpectrum(subgroups);
  return (
    <span className="lp-ptx-spectrum" role="img" aria-label={"Sous-groupes : " + segs.map((x) => `${x.name} ${x.doneCount} sur ${x.count}`).join(", ")}>
      {segs.map((x) => (
        <i key={x.id} style={{ flexGrow: x.weight, "--sc": x.color }} title={`${x.name} — ${x.doneCount} / ${x.count}`}><b style={{ width: Math.round(x.done * 100) + "%" }} /></i>
      ))}
    </span>
  );
}

function TaskPixelSide({ date, day, groups: allGroups, ctx, todayIso, onSelect, onOpen, collapsed, side, folded, onToggleFold, drop, dropOver }) {
  const dropCls = dropOver ? " is-drop" : "";
  const dropHint = dropOver ? <div className="lp-ptx-drop-hint">Déposer : fin → {new Date(date + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}</div> : null;
  const groups = allGroups.map((g) => ({ ...g, items: g.items.filter((i) => !i.ghost && !i.future) })).filter((g) => g.items.length);
  const label = hpxDayLabel(date, todayIso);
  /* Volet plié : une fine colonne (chevron, jour en vertical, compteur) ;
     le chevron pointe vers le côté où le volet se déplie. */
  const towardOut = side === "prev" ? "‹" : "›";
  const towardIn = side === "prev" ? "›" : "‹";
  const fold = onToggleFold ? (
    <button type="button" className="lp-ptx-fold" onClick={onToggleFold} aria-expanded={!folded}
      aria-label={(folded ? "Déplier le volet " : "Plier le volet ") + label} title={folded ? "Déplier" : "Plier"}>
      {folded ? towardIn : towardOut}
    </button>
  ) : null;
  if (folded) {
    return (
      <section className={"lp-hpx-side lp-ptx-side is-folded" + dropCls} aria-label={label + " — " + hpxLongDate(date) + " (plié)"} {...(drop || {})}>
        {fold}
        <button type="button" className="lp-ptx-side-strip" onClick={onToggleFold} title={`Déplier — ${label} : ${day.done} / ${day.total}`} tabIndex={-1}>
          <span className="lp-ptx-side-vlabel">{label}</span>
          <span className="lp-hpx-count"><b>{day.done}</b>/{day.total}</span>
        </button>
      </section>
    );
  }
  return (
    <section className={"lp-hpx-side lp-ptx-side" + dropCls} aria-label={label + " — " + hpxLongDate(date)} {...(drop || {})}>
      {dropHint}
      <div className="lp-ptx-side-top">
        <button type="button" className="lp-hpx-side-head" onClick={() => onSelect(date)} title="Afficher ce jour au premier plan">
          <span className="lp-hpx-side-title"><b>{label}</b><span>{hpxSubDate(date, todayIso)}</span></span>
          <TaskPixelMosaic groups={groups} day={day} ctx={ctx} size={8} />
          <span className="lp-hpx-count"><b>{day.done}</b> / {day.total}</span>
        </button>
        {fold}
      </div>
      {!groups.length && <div className="lp-hpx-muted lp-ptx-empty-side">Aucune tâche ce jour.</div>}
      {groups.map((g) => (
        <div key={g.id} className="lp-hpx-side-theme">
          <div className="lp-hpx-side-theme-head"><span className="lp-hpx-dot" style={{ background: g.color }} />{g.name}<span className="lp-hpx-muted">{g.done} / {g.items.length}</span></div>
          {!collapsed.has(g.id) && g.items.map((it) => (
            <button key={it.task.id} type="button" className="lp-hpx-side-row lp-ptx-side-row" onClick={() => onOpen && onOpen(it.task)} title={ptxLabel(it, ctx)}>
              <TaskPixel item={it} ctx={ctx} size={11} />
              <span className={"lp-hpx-side-name" + (it.done ? " lp-ptx-done" : "")}>{it.task.title || "Sans titre"}</span>
              <span className={"lp-hpx-muted" + (it.done ? " lp-ptx-ok" : it.lateDays > 0 ? " lp-ptx-late" : "")}>
                {it.done ? "fait" : it.lateDays > 0 ? (date < todayIso ? "reporté" : "retard") : it.task.startTime || ""}
              </span>
            </button>
          ))}
        </div>
      ))}
    </section>
  );
}

/* Anneau de progression (#524) : un clic sur le pixel d'une tâche avec durée
   l'ouvre ; on fait tourner l'anneau (glisser, clic, flèches ou raccourcis)
   puis « Valider ». À 100 %, la validation passe la tâche en Terminé. */
function TaskProgressRing({ item, ctx, x, y, onClose, onValidate, onOpen }) {
  const t = item.task;
  const [value, setValue] = useState(() => (item.done ? 100 : Math.max(0, Math.min(100, Math.round(Number(t.progress) || 0)))));
  const ref = useRef(null);
  const dragging = useRef(false);
  const R = 46, C = 2 * Math.PI * R, SIZE = 120;
  const color = ptxStatusColor(t, ctx);
  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [onClose]);
  const fromPointer = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    setValue(pixelTaskRingValue(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2), 5));
  };
  const onKeyDown = (e) => {
    if (e.key === "ArrowUp" || e.key === "ArrowRight") { e.preventDefault(); setValue((v) => Math.min(100, v + 5)); }
    if (e.key === "ArrowDown" || e.key === "ArrowLeft") { e.preventDefault(); setValue((v) => Math.max(0, v - 5)); }
    if (e.key === "Enter") { e.preventDefault(); onValidate(value); }
  };
  return (
    <div ref={ref} className="lp-ptx-ring" style={{ left: x, top: y, "--c": color }} role="dialog" aria-label={"Avancement de " + (t.title || "la tâche")}>
      <div className="lp-ptx-ring-title" title={t.title}>{t.title || "Sans titre"}</div>
      <svg
        width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="lp-ptx-ring-svg"
        role="slider" tabIndex={0} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} aria-label="Avancement (%)"
        onKeyDown={onKeyDown}
        onPointerDown={(e) => { dragging.current = true; e.currentTarget.setPointerCapture && e.currentTarget.setPointerCapture(e.pointerId); fromPointer(e); }}
        onPointerMove={(e) => { if (dragging.current) fromPointer(e); }}
        onPointerUp={() => { dragging.current = false; }}
      >
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R} className="lp-ptx-ring-track" />
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R} className="lp-ptx-ring-bar" strokeDasharray={C} strokeDashoffset={C * (1 - value / 100)} transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`} />
        <circle cx={SIZE / 2 + R * Math.sin(value / 100 * 2 * Math.PI)} cy={SIZE / 2 - R * Math.cos(value / 100 * 2 * Math.PI)} r={7} className="lp-ptx-ring-knob" />
        <text x={SIZE / 2} y={SIZE / 2 + 7} textAnchor="middle" className="lp-ptx-ring-value">{value} %</text>
      </svg>
      <div className="lp-ptx-ring-steps">
        {[0, 25, 50, 75, 100].map((v) => (
          <button key={v} type="button" className={value === v ? "is-on" : ""} onClick={() => setValue(v)}>{v}</button>
        ))}
      </div>
      {value === 100 && !item.done && <div className="lp-ptx-ring-hint">Valider passera la tâche en « Terminé ».</div>}
      {value < 100 && item.done && <div className="lp-ptx-ring-hint">Valider rouvrira la tâche.</div>}
      <div className="lp-ptx-ring-actions">
        {onOpen && <button type="button" className="lp-tool-btn" onClick={() => { onClose(); onOpen(t); }}>Fiche</button>}
        <span style={{ flex: 1 }} />
        <button type="button" className="lp-tool-btn" onClick={onClose}>Annuler</button>
        <button type="button" className="lp-btn lp-btn-primary" onClick={() => onValidate(value)}>Valider</button>
      </div>
    </div>
  );
}

/* Pixel Tasks : chaque action sur une tâche (terminer, rouvrir, faire
   avancer) propose « Annuler » quelques secondes dans une notification
   discrète. Annuler remet la tâche telle qu'avant ; une occurrence
   récurrente créée par la complétion est retirée avec. Partagé par le
   widget (tableau de bord) et la vue de projet (#542). */
function makePixelTaskUndoable(ctx, pushToast, setTasks) {
  return (taskId, run, describe) => {
    const all = (ctx && ctx.tasks) || [];
    const before = all.find((t) => t.id === taskId);
    const beforeIds = new Set(all.map((t) => t.id));
    run();
    if (!before || !pushToast || !setTasks) return;
    pushToast({
      message: `« ${before.title || "Tâche"} » ${describe(before)}.`,
      actionLabel: "Annuler",
      duration: 7000,
      onAction: () => setTasks((prev) => prev
        .filter((t) => beforeIds.has(t.id) || !(before.recurrence && t.title === before.title))
        .map((t) => (t.id === taskId ? { ...before, lastInteraction: new Date().toISOString() } : t))),
    });
  };
}
const pixelTaskDoneLabel = (ctx) => (t) => (isTaskDoneGlobal(t, ctx) ? "rouverte" : "terminée");
const pixelTaskUpdateLabel = (patch) => () => {
  if ("progress" in patch && patch.progress >= 100 && patch.statusId) return "terminée";
  if ("end" in patch) return "replanifiée au " + new Date(patch.end + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }).replace(/\.$/, "");
  if ("statusId" in patch) return "statut modifié";
  if ("focus" in patch) return patch.focus ? "marquée Focus" : "retirée du Focus";
  if ("estimateMinutes" in patch) return patch.estimateMinutes ? "estimée à " + pixelTaskMinutesLabel(patch.estimateMinutes) : "sans estimation";
  return "avancement " + Math.round(Number(patch.progress) || 0) + " %";
};

/* Glisser-déposer (#558) : une case ou une ligne se dépose sur le volet
   Hier / Demain ou sur un jour de la barre semaine pour y être replanifiée. */
const PTX_DND_TYPE = "application/x-nexora-task";
function ptxDragSource(taskId) {
  return {
    draggable: true,
    onDragStart: (e) => { e.dataTransfer.setData(PTX_DND_TYPE, taskId); e.dataTransfer.setData("text/plain", taskId); e.dataTransfer.effectAllowed = "move"; },
  };
}
function ptxDropTarget(onDropTask, date, setOver) {
  if (!onDropTask) return {};
  const ok = (e) => [...((e.dataTransfer && e.dataTransfer.types) || [])].includes(PTX_DND_TYPE);
  return {
    onDragOver: (e) => { if (!ok(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = "move"; setOver(date); },
    // Chromium envoie souvent dragleave sans relatedTarget en passant sur un
    // enfant : seule la position du pointeur dit si l'on a quitté la cible.
    onDragLeave: (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      if (e.clientX <= r.left || e.clientX >= r.right || e.clientY <= r.top || e.clientY >= r.bottom) setOver((v) => (v === date ? null : v));
    },
    onDrop: (e) => { if (!ok(e)) return; e.preventDefault(); setOver(null); const id = e.dataTransfer.getData(PTX_DND_TYPE); if (id) onDropTask(id, date); },
  };
}

// Valeurs que la saisie rapide (#557) déduit du groupe : projet, statut,
// responsable, type, jalon ; projet le plus fréquent du groupe à défaut.
function ptxGroupDefaults(ids, items) {
  const d = {};
  for (const id of ids) {
    if (!id) continue;
    const v = String(id).slice(2);
    if (id.startsWith("p:")) d.projectId = v;
    else if (id.startsWith("s:")) d.statusId = v;
    else if (id.startsWith("a:")) d.assignee = v;
    else if (id.startsWith("t:")) d.taskTypeId = v;
    else if (id === "k:milestone") d.milestone = true;
  }
  if (!d.projectId) {
    const n = new Map();
    for (const it of items || []) if (it.task.projectId) n.set(it.task.projectId, (n.get(it.task.projectId) || 0) + 1);
    const best = [...n.entries()].sort((a, b) => b[1] - a[1])[0];
    if (best) d.projectId = best[0];
  }
  return d;
}

/* Saisie rapide (#557) : bulle flottante sous l'en-tête de groupe. Entrée
   crée et vide le champ (on enchaîne), Échap ou clic ailleurs ferme. */
function PixelQuickAdd({ x, y, label, date, ctx, onSubmit, onClose }) {
  const [text, setText] = useState("");
  const ref = useRef(null);
  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [onClose]);
  const q = pixelTaskParseQuickAdd(text, date, ctx.teamMembers);
  const when = new Date(q.date + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
  return (
    <div ref={ref} className="lp-ptx-quickadd" style={{ left: x, top: y }} role="dialog" aria-label={"Nouvelle tâche — " + label}>
      <div className="lp-ptx-quickadd-head"><Plus size={13} /> Nouvelle tâche · <b>{label}</b></div>
      <input
        autoFocus className="lp-input" value={text} placeholder="Titre…  !jalon  @Nom  >ven  >12/10  ~2h"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") { e.preventDefault(); onClose(); }
          if (e.key === "Enter") { e.preventDefault(); if (onSubmit(text)) setText(""); }
        }}
        aria-label="Titre de la nouvelle tâche"
      />
      <div className="lp-ptx-quickadd-hint">
        {q.title ? <>fin <b>{when}</b>{q.milestone ? " · jalon" : ""}{q.assignee ? <> · <b>@{q.assignee}</b></> : null}{q.estimate ? <> · <b>⏱ {pixelTaskMinutesLabel(q.estimate)}</b></> : null}</> : "Entrée ↵ créer · Échap fermer"}
      </div>
    </div>
  );
}

/* Capacité de travail (#565) : une valeur par jour de la semaine et une
   exception pour le jour affiché. Chaque choix est enregistré aussitôt. */
const PIXEL_TASKS_CAP_HOURS = Array.from({ length: 25 }, (_, i) => i / 2);
const PIXEL_TASKS_WEEK = [[1, "Lundi"], [2, "Mardi"], [3, "Mercredi"], [4, "Jeudi"], [5, "Vendredi"], [6, "Samedi"], [0, "Dimanche"]];
function PixelCapacityPanel({ x, y, date, todayIso, prefs, onClose, onUpdate }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ left: x, top: y, visibility: "hidden" });
  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target) && !(e.target.closest && e.target.closest(".lp-ptx-cap-btn"))) onClose(); };
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [onClose]);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos({ left: Math.max(8, Math.min(x, window.innerWidth - r.width - 8)), top: Math.max(8, Math.min(y, window.innerHeight - r.height - 8)), visibility: "visible" });
  }, [x, y]);
  const label = (h) => (h ? pixelTaskMinutesLabel(h * 60) : "0 h — non travaillé");
  const weekdayValue = (wd) => {
    const v = prefs.byDay && prefs.byDay[wd];
    return pixelTaskCapacityValid(v) ? Number(v) : (pixelTaskCapacityValid(prefs.base) && Number(prefs.base) > 0 ? Number(prefs.base) : PIXEL_TASKS_DEFAULT_CAPACITY);
  };
  const setWeekday = (wd, h) => {
    const next = {};
    for (const [d] of PIXEL_TASKS_WEEK) next[d] = weekdayValue(d);
    next[wd] = h;
    onUpdate({ pixelTasksCapacityByDay: next });
  };
  const dayWd = new Date(date + "T00:00:00").getDay();
  const exception = prefs.dates && pixelTaskCapacityValid(prefs.dates[date]) ? Number(prefs.dates[date]) : null;
  const when = new Date(date + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  return createPortal(
    <div ref={ref} className="lp-quick-context-menu lp-ptx-cap" style={{ left: pos.left, top: pos.top, visibility: pos.visibility }} role="dialog" aria-label="Capacité de travail">
      <div className="lp-ptx-menu-title">Capacité de travail</div>
      <label className="lp-ptx-cap-row is-day">
        <span>Ce jour : <b>{when}</b></span>
        <select className="lp-input" value={exception == null ? "" : String(exception)}
          onChange={(e) => onUpdate({ pixelTasksCapacityDates: pixelTaskCapacityDates(prefs.dates, date, e.target.value === "" ? null : Number(e.target.value), todayIso) })}>
          <option value="">Comme d'habitude ({label(weekdayValue(dayWd))})</option>
          {PIXEL_TASKS_CAP_HOURS.map((h) => <option key={h} value={String(h)}>{label(h)}</option>)}
        </select>
      </label>
      <div className="lp-ptx-cap-sub">Par jour de la semaine</div>
      {PIXEL_TASKS_WEEK.map(([wd, name]) => (
        <label key={wd} className={"lp-ptx-cap-row" + (wd === dayWd ? " is-current" : "")}>
          <span>{name}</span>
          <select className="lp-input" value={String(weekdayValue(wd))} onChange={(e) => setWeekday(wd, Number(e.target.value))}>
            {PIXEL_TASKS_CAP_HOURS.map((h) => <option key={h} value={String(h)}>{label(h)}</option>)}
          </select>
        </label>
      ))}
      <div className="lp-ptx-cap-hint">Aucune réunion n'est déduite : estime-la (clic droit → Estimation) si elle doit compter.</div>
    </div>,
    document.body
  );
}

/* Menu d'actions (#559) : clic droit sur une ligne ou une case, ou « ⋯ ».
   Panneaux : principal, statut, avancement, estimation, date. */
function PixelTaskMenu({ item, ctx, x, y, todayIso, onClose, onReschedule, onPatch, onProgress, onToggleDone, onOpen }) {
  const t = item.task;
  const [panel, setPanel] = useState("main");
  const [pick, setPick] = useState(addDays(todayIso, 1));
  const ref = useRef(null);
  const [pos, setPos] = useState({ left: x, top: y, visibility: "hidden" });
  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [onClose]);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos({ left: Math.max(8, Math.min(x, window.innerWidth - r.width - 8)), top: Math.max(8, Math.min(y, window.innerHeight - r.height - 8)), visibility: "visible" });
  }, [x, y, panel]);
  const run = (fn) => () => { onClose(); fn(); };
  const fmt = (d) => new Date(d + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
  const tomorrow = addDays(todayIso, 1);
  const monday = pixelTaskNextMonday(todayIso);
  const plusWeek = addDays(t.end || t.start || todayIso, 7);
  const est = pixelTaskEstimate(t);
  const statusesAllowed = getStatusesForTask(ctx.statuses || [], ctx.projects || [], ctx.taskTypes || [], t.projectId, t.taskTypeId, t.statusId);
  const restricted = restrictedStatusForType(ctx.taskTypes || [], ctx.statuses || [], t.taskTypeId);
  const Item = ({ icon, label, hint, onClick, active, danger }) => (
    <button type="button" className={"lp-quick-context-item" + (active ? " is-active" : "") + (danger ? " lp-quick-context-item-danger" : "")} onClick={onClick}>
      <span className="lp-ptx-menu-icon" aria-hidden="true">{icon}</span><span className="lp-ptx-menu-label">{label}</span>{hint ? <span className="lp-ptx-menu-hint">{hint}</span> : null}
    </button>
  );
  const back = <Item icon="←" label="Retour" onClick={() => setPanel("main")} />;
  return createPortal(
    <div ref={ref} className="lp-quick-context-menu lp-ptx-menu" style={{ left: pos.left, top: pos.top, visibility: pos.visibility }} role="menu" aria-label={"Actions — " + (t.title || "tâche")}>
      <div className="lp-ptx-menu-title" title={t.title}>{t.title || "Sans titre"}</div>
      {panel === "main" && (
        <>
          {!item.future && <Item icon={item.done ? "↺" : "✓"} label={item.done ? "Rouvrir" : t.milestone ? "Terminer le jalon" : "Terminer"} onClick={run(() => onToggleDone(t.id))} />}
          <hr />
          <Item icon="⏭" label="Reporter à demain" hint={fmt(tomorrow)} onClick={run(() => onReschedule(t, tomorrow))} />
          <Item icon="📅" label="Reporter à lundi" hint={fmt(monday)} onClick={run(() => onReschedule(t, monday))} />
          <Item icon="↔" label="Décaler d'une semaine" hint={fmt(plusWeek)} onClick={run(() => onReschedule(t, plusWeek))} />
          <Item icon="🗓" label="Choisir une date…" hint="▸" onClick={() => setPanel("date")} />
          <hr />
          {!restricted && <Item icon="●" label="Statut" hint={((ctx.statuses || []).find((st) => st.id === t.statusId) || {}).name || "▸"} onClick={() => setPanel("status")} />}
          {!t.milestone && !item.future && <Item icon="◔" label="Avancement" hint={Math.round(Number(t.progress) || 0) + " %"} onClick={() => setPanel("progress")} />}
          <Item icon="⏱" label="Estimation" hint={est ? pixelTaskMinutesLabel(est) : "aucune"} onClick={() => setPanel("estimate")} />
          <Item icon="⭐" label={isTaskFocus(t) ? "Retirer du Focus" : "Marquer Focus"} onClick={run(() => onPatch(t.id, { focus: !isTaskFocus(t) }))} />
          <hr />
          {onOpen && <Item icon="↗" label="Ouvrir la fiche" onClick={run(() => onOpen(t))} />}
        </>
      )}
      {panel === "date" && (
        <>
          {back}
          <div className="lp-ptx-menu-date">
            <input type="date" className="lp-input" value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Nouvelle date de fin" autoFocus />
            <button type="button" className="lp-btn lp-btn-primary" disabled={!pick} onClick={run(() => onReschedule(t, pick))}>Reporter</button>
          </div>
        </>
      )}
      {panel === "status" && (
        <>
          {back}
          {statusesAllowed.map((st) => (
            <Item key={st.id} icon={<i className="lp-ptx-menu-dot" style={{ background: st.color || "#94A3B8" }} />} label={st.name} active={st.id === t.statusId}
              onClick={run(() => { if (st.id !== t.statusId) onPatch(t.id, /termin/i.test(st.name || "") ? { statusId: st.id, progress: 100 } : { statusId: st.id }); })} />
          ))}
        </>
      )}
      {panel === "progress" && (
        <>
          {back}
          {[0, 25, 50, 75, 100].map((v) => <Item key={v} icon="◔" label={v + " %"} active={Math.round(Number(t.progress) || 0) === v} onClick={run(() => onProgress(item, v))} />)}
        </>
      )}
      {panel === "estimate" && (
        <>
          {back}
          {PIXEL_TASKS_ESTIMATES.map((m) => <Item key={m} icon="⏱" label={pixelTaskMinutesLabel(m)} active={est === m} onClick={run(() => onPatch(t.id, { estimateMinutes: m }))} />)}
          {est > 0 && <Item icon="×" label="Sans estimation" onClick={run(() => onPatch(t.id, { estimateMinutes: null }))} />}
        </>
      )}
    </div>,
    document.body
  );
}

/* Clôturer la journée (#562) : revue, une à une, des tâches du jour non
   terminées. La liste est figée à l'ouverture ; chaque tâche est relue en
   direct (une action faite ailleurs est prise en compte). */
function PixelClosure({ title, ids, findItem, ctx, date, todayIso, onClose, onDone, onReschedule }) {
  const [handled, setHandled] = useState([]); // { id, text }
  const [pickOpen, setPickOpen] = useState(false);
  const nextDay = addDays(date > todayIso ? date : todayIso, 1);
  const [pick, setPick] = useState(nextDay);
  const seen = new Set(handled.map((h) => h.id));
  const currentId = ids.find((id) => !seen.has(id));
  const it = currentId ? findItem(currentId) : null;
  const t = it ? it.task : null;
  const fmt = (d) => new Date(d + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
  const mark = (text) => { setHandled((h) => [...h, { id: currentId, title: (t && t.title) || "Tâche", text }]); setPickOpen(false); setPick(nextDay); };
  const project = t && (ctx.projects || []).find((p) => p.id === t.projectId);
  return (
    <Modal title={title} onClose={onClose} className="lp-ptx-closure" footer={<button type="button" className="lp-btn lp-btn-primary" onClick={onClose}>{currentId ? "Terminer plus tard" : "Fermer"}</button>}>
      <div className="lp-ptx-closure-top"><span>{handled.length} / {ids.length} traitée{handled.length > 1 ? "s" : ""}</span></div>
      <div className="lp-ptx-closure-bar" aria-hidden="true"><span style={{ width: (ids.length ? Math.round((handled.length / ids.length) * 100) : 100) + "%" }} /></div>
      {currentId && !t && (
        <div className="lp-ptx-closure-card"><div className="lp-hpx-muted">Cette tâche n'est plus dans la journée.</div><button type="button" className="lp-tool-btn" onClick={() => mark("ignorée")}>Suivante</button></div>
      )}
      {t && (
        <div className="lp-ptx-closure-card" style={{ "--c": ptxStatusColor(t, ctx) }}>
          <TaskPixel item={it} ctx={ctx} size={18} />
          <div className="lp-ptx-closure-what">
            <b>{t.title || "Sans titre"}</b>
            <span className="lp-hpx-muted">{project ? project.name + " · " : ""}{it.lateDays > 0 ? `retard ${it.lateDays} j` : "fin " + fmt(t.end || t.start || date)}{!t.milestone ? ` · avancement ${Math.round(Number(t.progress) || 0)} %` : " · jalon"}{pixelTaskEstimate(t) ? " · ⏱ " + pixelTaskMinutesLabel(pixelTaskEstimate(t)) : ""}</span>
          </div>
          <div className="lp-ptx-closure-actions">
            {it.done
              ? <span className="lp-ptx-closure-ok">✓ déjà terminée</span>
              : <button type="button" className="lp-tool-btn lp-ptx-closure-do" onClick={() => { onDone(t.id); mark("terminée"); }}>✓ Terminer</button>}
            <button type="button" className="lp-tool-btn lp-ptx-closure-next" autoFocus onClick={() => { onReschedule(t, nextDay); mark("reportée au " + fmt(nextDay)); }}>→ {date >= todayIso ? "Demain" : "Demain (" + fmt(nextDay) + ")"}</button>
            <button type="button" className="lp-tool-btn" onClick={() => setPickOpen((v) => !v)} aria-expanded={pickOpen}>🗓 Date…</button>
            <button type="button" className="lp-tool-btn" onClick={() => mark(it.done ? "terminée" : "laissée")}>Laisser</button>
          </div>
          {pickOpen && (
            <div className="lp-ptx-closure-pick">
              <input type="date" className="lp-input" value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Nouvelle date de fin" />
              <button type="button" className="lp-btn lp-btn-primary" disabled={!pick} onClick={() => { onReschedule(t, pick); mark("reportée au " + fmt(pick)); }}>Reporter</button>
            </div>
          )}
        </div>
      )}
      {!currentId && <div className="lp-ptx-closure-end">{ids.length ? "Journée clôturée. Plus rien ne traîne." : "Rien à clôturer : toutes les tâches du jour sont terminées."}</div>}
      {handled.length > 0 && (
        <ul className="lp-ptx-closure-log">
          {handled.slice().reverse().map((h) => <li key={h.id}><b>{h.title}</b> — {h.text}</li>)}
        </ul>
      )}
    </Modal>
  );
}

/* Vue de projet Pixel Tasks (#542) : le widget sur les tâches filtrées de la
   vue (projet / dossier sélectionné, filtres). Ses réglages vivent dans les
   préférences de vue au lieu du widget ; la barre d'outils va dans celle de
   l'application. */
/* Création directe (#557) : même forme que la fiche (id, lastInteraction),
   annulable quelques secondes. */
function makePixelTaskCreator(setTasks, pushToast) {
  if (!setTasks) return null;
  return (data) => {
    const task = { ...data, id: uid(), lastInteraction: new Date().toISOString() };
    setTasks((prev) => [...prev, task]);
    if (pushToast) pushToast({ message: `Tâche « ${task.title} » créée.`, actionLabel: "Annuler", duration: 7000, onAction: () => setTasks((prev) => prev.filter((t) => t.id !== task.id)) });
    return task;
  };
}

function PixelTasksView({ tasks, ctx, onOpen, prefs, setPrefs, onToggleDone, onUpdateTask, setTasks, pushToast, toolbarSlot }) {
  const undoable = makePixelTaskUndoable(ctx, pushToast, setTasks);
  return (
    <div className="lp-ptx-view">
      <WidgetPixelTasks widget={prefs || {}} tasks={tasks} ctx={ctx} onOpen={onOpen}
        onToggleDone={(id) => undoable(id, () => onToggleDone && onToggleDone(id), pixelTaskDoneLabel(ctx))}
        onUpdateTask={(id, patch) => undoable(id, () => onUpdateTask && onUpdateTask(id, patch), pixelTaskUpdateLabel(patch))}
        onCreateTask={makePixelTaskCreator(setTasks, pushToast)}
        onUpdateWidget={setPrefs} externalToolbarSlot={toolbarSlot} />
    </div>
  );
}

function WidgetPixelTasks({ widget, tasks, ctx, onOpen, onToggleDone, onUpdateTask, onCreateTask, onUpdateWidget, onEditWidget, externalToolbarSlot }) {
  const todayIso = iso(new Date());
  const [date, setDate] = useState(todayIso);
  const [hover, setHover] = useState(null);
  const [view, setViewState] = useState(() => (HPX_VIEWS.some(([k]) => k === (widget && widget.pixelTasksView)) ? widget.pixelTasksView : "day"));
  const setView = (v) => { setViewState(v); if (onUpdateWidget) onUpdateWidget({ pixelTasksView: v }); };
  const [groupBy, setGroupByState] = useState(() => (PIXEL_TASKS_GROUP_BY.some(([k]) => k === (widget && widget.pixelTasksGroupBy)) ? widget.pixelTasksGroupBy : "project"));
  const setGroupBy = (g) => { setGroupByState(g); if (onUpdateWidget) onUpdateWidget({ pixelTasksGroupBy: g }); };
  // Réglage mémorisé sur le widget (ex. autre onglet) : le choix suit.
  useEffect(() => { if (PIXEL_TASKS_GROUP_BY.some(([k]) => k === (widget && widget.pixelTasksGroupBy))) setGroupByState(widget.pixelTasksGroupBy); }, [widget && widget.pixelTasksGroupBy]);
  // Packages de cases dans chaque rangée (sélecteur de l'en-tête, mémorisé sur le widget).
  const packageBy = PIXEL_TASKS_PACKAGE_BY.some(([k]) => k === (widget && widget.pixelTasksPackageBy)) ? widget.pixelTasksPackageBy : "none";
  // Sous-groupes « Rameaux » (#546) : aucun si la clé est celle des groupes.
  const subBy = PIXEL_TASKS_SUB_BY.some(([k]) => k === (widget && widget.pixelTasksSubBy)) && widget.pixelTasksSubBy !== groupBy ? widget.pixelTasksSubBy : "none";
  // Fantômes : tâches en cours ce jour-là (début avant, fin après), en gris pointillé.
  const ghostOn = !!(widget && widget.pixelTasksGhost);
  // Futur : tâches entièrement à venir dans la fenêtre choisie (0 = désactivé).
  const futureWindow = PIXEL_TASKS_FUTURE_WINDOWS.includes(Number(widget && widget.pixelTasksFuture)) ? Number(widget.pixelTasksFuture) : 0;
  const [ring, setRing] = useState(null); // { taskId, x, y } — anneau de progression ouvert
  const [menu, setMenu] = useState(null); // { taskId, x, y } — menu d'actions (#559)
  const [adding, setAdding] = useState(null); // { key, label, defaults, x, y } — saisie rapide (#557)
  const [closure, setClosure] = useState(null); // { title, ids } — revue de fin de journée (#562)
  const [dropOver, setDropOver] = useState(null); // jour survolé pendant un glisser (#558)
  // Filtres éclair (#563) : propres à l'écran, non mémorisés.
  const [flt, setFlt] = useState({ query: "", late: false, milestone: false, focus: false, assignee: "" });
  // Bandeau Focus (#560, actif par défaut) et jauge de charge (#561).
  const bandPref = !(widget && widget.pixelTasksFocusBand === false);
  const loadOn = !!(widget && widget.pixelTasksLoad);
  // Capacité du jour affiché (#565) : exception datée, jour de la semaine, puis capacité unique.
  const capPrefs = { base: widget && widget.pixelTasksCapacity, byDay: widget && widget.pixelTasksCapacityByDay, dates: widget && widget.pixelTasksCapacityDates };
  const [capOpen, setCapOpen] = useState(null); // { x, y } — panneau de capacité
  const rootRef = useRef(null);
  // Préfixe des identifiants SVG (dégradés) propre à ce widget : deux Pixel
  // Tasks sur une même page ne se prêtent pas leurs couleurs.
  const svgIdRef = useRef("ptx" + Math.random().toString(36).slice(2, 8));
  const openDay = (d) => { setDate(d); setView("day"); };
  // Groupes repliés, mémorisés sur le widget (identifiants de groupe).
  const [collapsedList, setCollapsedList] = useState(() => (Array.isArray(widget && widget.pixelTasksCollapsed) ? widget.pixelTasksCollapsed.map(String) : []));
  useEffect(() => { setCollapsedList(Array.isArray(widget && widget.pixelTasksCollapsed) ? widget.pixelTasksCollapsed.map(String) : []); }, [widget && widget.pixelTasksCollapsed]);
  const collapsed = useMemo(() => new Set(collapsedList), [collapsedList]);
  const saveCollapsed = (list) => { setCollapsedList(list); if (onUpdateWidget) onUpdateWidget({ pixelTasksCollapsed: list }); };
  const toggleGroup = (id) => saveCollapsed(collapsed.has(id) ? collapsedList.filter((x) => x !== id) : [...collapsedList, id]);
  // Volets Hier / Demain pliés, mémorisés sur le widget.
  const [sidesFolded, setSidesFolded] = useState(() => ({ ...((widget && widget.pixelTasksSidesFolded) || {}) }));
  useEffect(() => { setSidesFolded({ ...((widget && widget.pixelTasksSidesFolded) || {}) }); }, [widget && widget.pixelTasksSidesFolded]);
  const toggleSide = (key) => {
    const nextFolded = { prev: !!sidesFolded.prev, next: !!sidesFolded.next, [key]: !sidesFolded[key] };
    setSidesFolded(nextFolded);
    if (onUpdateWidget) onUpdateWidget({ pixelTasksSidesFolded: nextFolded });
  };

  const prev = addDays(date, -1);
  const next = addDays(date, 1);
  const week = useMemo(() => { const s = hpxWeekStart(date); return [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(s, i)); }, [date]);
  const stateOf = useMemo(() => {
    const cache = new Map();
    return (d) => {
      if (!cache.has(d)) {
        const day = pixelTasksForDay(tasks, d, todayIso, ctx.statuses, { ghosts: ghostOn, futureDays: futureWindow });
        cache.set(d, { ...day, groups: pixelTaskGroupsFor(day.items, groupBy, ctx, packageBy, subBy) });
      }
      return cache.get(d);
    };
  }, [tasks, ctx, groupBy, packageBy, subBy, ghostOn, futureWindow, todayIso]);
  const day = stateOf(date);
  /* Base (case cochée par défaut) : décochée, les tâches du jour quittent la
     vue Jour — il ne reste que fantômes et futur. Le score et le carré
     journalier, eux, comptent toujours les tâches du jour. */
  const baseOn = !(widget && widget.pixelTasksBase === false);
  // Terminées masquées (bouton de l'en-tête, mémorisé sur le widget) : les
  // cases et lignes cochées quittent la vue Jour, score et compteurs restent.
  const hideDone = !!(widget && widget.pixelTasksHideDone);
  const hiddenDone = hideDone ? day.items.filter((i) => i.done && (baseOn || i.ghost || i.future)).length : 0;
  const capacityH = pixelTaskCapacityFor(date, capPrefs);
  const capException = !!(capPrefs.dates && pixelTaskCapacityValid(capPrefs.dates[date]));
  const fltOn = pixelTaskFilterActive(flt);
  // Bandeau « Mes 3 du jour » (#560) : les trois premières tâches Focus du
  // jour quittent leurs groupes ; au-delà, elles y restent.
  const focusAll = useMemo(
    () => (bandPref && baseOn && view === "day" ? day.items.filter((i) => !i.ghost && !i.future && isTaskFocus(i.task) && !(hideDone && i.done) && pixelTaskMatches(i, flt)) : []),
    [bandPref, baseOn, view, day, hideDone, flt]
  );
  const bandItems = focusAll.slice(0, 3);
  const bandIds = useMemo(() => new Set(focusAll.slice(0, 3).map((i) => i.task.id)), [focusAll]);
  const groups = useMemo(
    () => pixelTaskVisibleGroups(day.items, day.groups, { base: baseOn, hideDone, keep: fltOn || bandIds.size ? (i) => !bandIds.has(i.task.id) && pixelTaskMatches(i, flt) : null }, groupBy, ctx, packageBy, subBy),
    [baseOn, hideDone, day, groupBy, ctx, packageBy, subBy, flt, fltOn, bandIds]
  );
  // Compteurs des puces (#563) et revue (#562), sur la journée complète.
  const baseItems = useMemo(() => day.items.filter((i) => !i.ghost && !i.future), [day]);
  const chipCount = {
    late: baseItems.filter((i) => i.lateDays > 0 && !i.done).length,
    milestone: baseItems.filter((i) => i.task.milestone).length,
    focus: baseItems.filter((i) => isTaskFocus(i.task)).length,
  };
  const assignees = useMemo(() => [...new Set(day.items.map((i) => String(i.task.assignee || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr")), [day]);
  const shownCount = groups.reduce((n, g) => n + g.items.length, 0) + bandItems.length;
  const closureIds = useMemo(() => pixelTaskClosureList(day.items).map((i) => i.task.id), [day]);
  // Jauge de charge (#561) : réunions horodatées lues sur toutes les tâches.
  const load = useMemo(() => {
    if (!loadOn || view !== "day") return null;
    const groupOfItem = new Map();
    for (const g of day.groups) for (const it of g.items) groupOfItem.set(it, g);
    return pixelTaskLoad(day.items, capacityH * 60, (it) => { const g = groupOfItem.get(it); return g ? { id: g.id, name: g.name, color: g.color } : { id: "none", name: "Autres", color: "#94A3B8" }; });
  }, [loadOn, view, day, capacityH]);
  const findDayItem = (id) => day.items.find((i) => i.task.id === id) || null;
  const taskById = (id) => (tasks || []).find((t) => t.id === id) || (ctx.tasks || []).find((t) => t.id === id) || null;
  const reschedule = (task, target) => { const patch = pixelTaskReschedule(task, target); if (patch && onUpdateTask) onUpdateTask(task.id, patch); };
  const onDropTask = onUpdateTask ? (id, target) => { const t = taskById(id); if (t) reschedule(t, target); } : null;
  const dropOn = (d) => ptxDropTarget(onDropTask, d, setDropOver);
  const dragSrc = (it) => (onDropTask ? { ...ptxDragSource(it.task.id), onDragEnd: () => setDropOver(null) } : {});
  const openMenu = (it, e) => {
    e.preventDefault();
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    setRing(null);
    setMenu({ taskId: it.task.id, x: e.type === "contextmenu" ? e.clientX : r.left, y: e.type === "contextmenu" ? e.clientY : r.bottom + 4 });
  };
  const menuProps = (it) => ({ ...dragSrc(it), onContextMenu: (e) => openMenu(it, e) });
  // Bulle de saisie rapide sous le bouton « + » du groupe (#557).
  const openAdd = (key, label, ids, items, e) => {
    e.stopPropagation();
    const root = rootRef.current;
    const r = e.currentTarget.getBoundingClientRect();
    const base = root ? root.getBoundingClientRect() : { left: 0, top: 0 };
    const rootW = root ? root.clientWidth : 0;
    setRing(null);
    setAdding({ key, label, defaults: ptxGroupDefaults(ids, items), x: Math.max(4, Math.min(r.right - base.left + (root ? root.scrollLeft : 0) - 360, rootW - 384)), y: r.bottom - base.top + (root ? root.scrollTop : 0) + 6 });
  };
  const addBtn = (key, label, ids, items) => (onCreateTask && view === "day" ? (
    <button type="button" className={"lp-ptx-add" + (adding && adding.key === key ? " is-on" : "")} onClick={(e) => openAdd(key, label, ids, items, e)} title={"Ajouter une tâche — " + label} aria-label={"Ajouter une tâche dans " + label}><Plus size={13} strokeWidth={2.6} /></button>
  ) : null);
  const createQuick = (text) => {
    if (!adding || !onCreateTask) return false;
    const q = pixelTaskParseQuickAdd(text, date, ctx.teamMembers);
    if (!q.title) return false;
    const d = adding.defaults;
    const projects = ctx.projects || [];
    const projectId = d.projectId || (projects[0] && projects[0].id) || "";
    const types = getTaskTypesForProject(ctx.taskTypes || [], projects, projectId, d.taskTypeId || null);
    const taskTypeId = d.taskTypeId && types.some((x) => x.id === d.taskTypeId) ? d.taskTypeId : ((types[0] && types[0].id) || "");
    const allowed = getStatusesForTask(ctx.statuses || [], projects, ctx.taskTypes || [], projectId, taskTypeId);
    const fallback = getDefaultStatusForTask(ctx.statuses || [], projects, ctx.taskTypes || [], projectId, taskTypeId);
    const statusId = d.statusId && allowed.some((x) => x.id === d.statusId) ? d.statusId : ((fallback && fallback.id) || "");
    const assignee = q.assignee || d.assignee || "";
    onCreateTask({ title: q.title, projectId, taskTypeId, statusId, start: q.date, end: q.date, milestone: q.milestone || !!d.milestone, progress: 0, desc: "", ...(assignee ? { assignee } : {}), ...(q.estimate ? { estimateMinutes: q.estimate } : {}) });
    return true;
  };
  // Largeur de la carte centrale, pour dimensionner les rangées de pixels.
  const mainRef = useRef(null);
  const [mainW, setMainW] = useState(0);
  useEffect(() => {
    const el = mainRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver((entries) => setMainW(Math.round(entries[0].contentRect.width + 32)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [view]);
  const allCollapsed = groups.length > 0 && groups.every((g) => collapsed.has(g.id));
  const onKeyDown = (e) => {
    if (e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
    if (e.key === "ArrowLeft" && e.altKey) { e.preventDefault(); setDate(prev); }
    if (e.key === "ArrowRight" && e.altKey) { e.preventDefault(); setDate(next); }
  };
  const statusLegend = useMemo(() => {
    const seen = new Map();
    for (const it of day.items) {
      const st = (ctx.statuses || []).find((s) => s.id === it.task.statusId);
      if (st && !seen.has(st.id)) seen.set(st.id, st);
    }
    return [...seen.values()];
  }, [day, ctx.statuses]);

  const toolbar = (
    <ViewToolbarPortal slot={externalToolbarSlot}>
      <span className="lp-density-row lp-hpx-views" role="group" aria-label="Vue">
        {HPX_VIEWS.map(([k, label]) => (
          <button key={k} type="button" className={"lp-density-btn" + (view === k ? " active" : "")} aria-pressed={view === k} onClick={() => setView(k)}>{label}</button>
        ))}
      </span>
      <select className="lp-ptx-groupby" value={groupBy} onChange={(e) => setGroupBy(e.target.value)} aria-label="Regrouper les tâches par" title="Regrouper les tâches par">
        {PIXEL_TASKS_GROUP_BY.map(([k, label]) => <option key={k} value={k}>Par {label.toLowerCase()}</option>)}
      </select>
      <select className="lp-ptx-groupby" value={packageBy} onChange={(e) => onUpdateWidget && onUpdateWidget({ pixelTasksPackageBy: e.target.value })} aria-label="Packages de cases dans chaque rangée" title="Packages de cases dans chaque rangée">
        {PIXEL_TASKS_PACKAGE_BY.map(([k, label]) => <option key={k} value={k}>{k === "none" ? "Sans packages" : "Packages : " + (k === "kind" ? "jalon / durée" : label.toLowerCase())}</option>)}
      </select>
      <select className={"lp-ptx-groupby" + (subBy !== "none" ? " lp-ptx-sub-select is-on" : "")} value={subBy} onChange={(e) => onUpdateWidget && onUpdateWidget({ pixelTasksSubBy: e.target.value })} aria-label="Sous-groupes sous chaque groupe" title="Sous-groupes « Rameaux » : chaque groupe devient un petit arbre">
        {PIXEL_TASKS_SUB_BY.map(([k, label]) => <option key={k} value={k} disabled={k !== "none" && k === groupBy}>{k === "none" ? "Sans sous-groupes" : "Sous-groupes : " + label.toLowerCase()}</option>)}
      </select>
      {view === "day" && (
        <label className={"lp-ptx-ghost-toggle lp-ptx-base-toggle" + (baseOn ? " is-on" : "")} title="Affiche les tâches du jour (date de jalon ou de fin, retards compris) — décocher pour ne garder que fantômes et futur">
          <input type="checkbox" checked={baseOn} onChange={(e) => onUpdateWidget && onUpdateWidget({ pixelTasksBase: e.target.checked })} />
          Base
        </label>
      )}
      {view === "day" && (
        <button type="button" className={"lp-tool-btn lp-ptx-done-toggle" + (hideDone ? " is-on" : "")} aria-pressed={hideDone} onClick={() => onUpdateWidget && onUpdateWidget({ pixelTasksHideDone: !hideDone })} title={hideDone ? "Afficher les tâches terminées" : "Cacher les tâches terminées (le score les compte toujours)"}>
          {hideDone ? <Eye size={13} /> : <EyeOff size={13} />} {hideDone ? "Afficher terminées" + (hiddenDone ? " (" + hiddenDone + ")" : "") : "Cacher terminées"}
        </button>
      )}
      {view === "day" && (
        <label className={"lp-ptx-ghost-toggle" + (bandPref ? " is-on" : "")} title="Bandeau « Mes 3 du jour » : les tâches Focus du jour en tête du widget">
          <input type="checkbox" checked={bandPref} onChange={(e) => onUpdateWidget && onUpdateWidget({ pixelTasksFocusBand: e.target.checked })} />
          Mes 3
        </label>
      )}
      {view === "day" && (
        <label className={"lp-ptx-ghost-toggle" + (loadOn ? " is-on" : "")} title="Jauge de charge : estimations des tâches du jour face au temps disponible (réunions déduites)">
          <input type="checkbox" checked={loadOn} onChange={(e) => onUpdateWidget && onUpdateWidget({ pixelTasksLoad: e.target.checked })} />
          Charge
        </label>
      )}
      {view === "day" && loadOn && (
        <button type="button" className={"lp-tool-btn lp-ptx-cap-btn" + (capOpen ? " is-on" : "")} aria-expanded={!!capOpen} aria-haspopup="dialog"
          onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setCapOpen(capOpen ? null : { x: r.left, y: r.bottom + 6 }); }}
          title="Capacité de travail : par jour de la semaine, avec exception pour une date">
          ⏱ Capacité {capacityH ? pixelTaskMinutesLabel(capacityH * 60) : "0 h"}{capException ? " *" : ""}
        </button>
      )}
      {view === "day" && (onUpdateTask || onToggleDone) && (
        <button type="button" className="lp-tool-btn lp-ptx-closure-btn" onClick={() => setClosure({ title: "Clôturer " + hpxLongDate(date), ids: closureIds })} title="Passer en revue les tâches non terminées du jour : terminer, reporter ou laisser">
          <CheckCircle2 size={13} /> Clôturer{closureIds.length ? " (" + closureIds.length + ")" : ""}
        </button>
      )}
      {view === "day" && (
        <label className={"lp-ptx-ghost-toggle" + (ghostOn ? " is-on" : "")} title="Ajoute, en gris pointillé, les tâches en cours ce jour-là (début avant, fin après) — hors score">
          <input type="checkbox" checked={ghostOn} onChange={(e) => onUpdateWidget && onUpdateWidget({ pixelTasksGhost: e.target.checked })} />
          Fantômes
        </label>
      )}
      {view === "day" && (
        <select className={"lp-ptx-groupby lp-ptx-future-select" + (futureWindow ? " is-on" : "")} value={futureWindow} onChange={(e) => onUpdateWidget && onUpdateWidget({ pixelTasksFuture: Number(e.target.value) })} aria-label="Tâches à venir (futur)" title="Ajoute les tâches entièrement à venir (début, fin, jalon après ce jour) dans la fenêtre choisie — hors score">
          {PIXEL_TASKS_FUTURE_WINDOWS.map((n) => <option key={n} value={n}>{n ? "Futur · " + n + " j" : "Sans futur"}</option>)}
        </select>
      )}
      {view === "day" ? (
        <span className="lp-hpx-nav" role="group" aria-label="Jour affiché">
          <button type="button" className="lp-icon-btn" aria-label="Jour précédent" onClick={() => setDate(prev)}><ChevronLeft size={14} /></button>
          <button type="button" className="lp-hpx-nav-side" onClick={() => setDate(prev)}>{hpxDayLabel(prev, todayIso)}</button>
          <label className="lp-hpx-nav-current">
            {hpxDayLabel(date, todayIso)} · {hpxSubDate(date, todayIso)}
            <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Choisir un jour" />
          </label>
          <button type="button" className="lp-hpx-nav-side" onClick={() => setDate(next)}>{hpxDayLabel(next, todayIso)}</button>
          <button type="button" className="lp-icon-btn" aria-label="Jour suivant" onClick={() => setDate(next)}><ChevronRight size={14} /></button>
        </span>
      ) : (
        <span className="lp-hpx-nav" role="group" aria-label={view === "week" ? "Semaine affichée" : "Mois affiché"}>
          <button type="button" className="lp-icon-btn" aria-label={view === "week" ? "Semaine précédente" : "Mois précédent"} onClick={() => setDate(view === "week" ? addDays(date, -7) : hpxAddMonths(date, -1))}><ChevronLeft size={14} /></button>
          <label className="lp-hpx-nav-current">
            {view === "week"
              ? "Semaine du " + new Date(week[0] + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long" })
              : (() => { const t = new Date(date + "T00:00:00").toLocaleDateString("fr-FR", { month: "long", year: "numeric" }); return t.charAt(0).toUpperCase() + t.slice(1); })()}
            <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Choisir une date" />
          </label>
          <button type="button" className="lp-icon-btn" aria-label={view === "week" ? "Semaine suivante" : "Mois suivant"} onClick={() => setDate(view === "week" ? addDays(date, 7) : hpxAddMonths(date, 1))}><ChevronRight size={14} /></button>
        </span>
      )}
      <button type="button" className="lp-tool-btn" disabled={date === todayIso} onClick={() => setDate(todayIso)}>Aujourd'hui</button>
      {onEditWidget && (
        <button type="button" className="lp-tool-btn" onClick={onEditWidget} title="Filtre du widget (responsable, projets, statuts…)" aria-label="Modifier le filtre du widget">
          <Filter size={13} /> Filtre · {(tasks || []).length} tâche{(tasks || []).length > 1 ? "s" : ""}
        </button>
      )}
      {view === "day" && groups.length > 1 && (
        <button type="button" className="lp-tool-btn" onClick={() => saveCollapsed(allCollapsed ? [] : groups.map((g) => g.id))} aria-label={allCollapsed ? "Déplier tous les groupes" : "Replier tous les groupes"}>
          {allCollapsed ? <ChevronsDown size={13} /> : <ChevronsUp size={13} />} {allCollapsed ? "Tout déplier" : "Tout replier"}
        </button>
      )}
    </ViewToolbarPortal>
  );

  const miniOf = (d, size, gap) => { const k = stateOf(d); return <TaskPixelMosaic groups={k.groups} day={k} ctx={ctx} size={size} gap={gap} />; };

  if (view === "week") {
    return (
      <div className="lp-hpx">
        {toolbar}
        <div className="lp-hpx-weekview">
          {week.map((d) => {
            const k = stateOf(d);
            const n = pixelTasksSquareSize(k.groups);
            const size = Math.max(6, Math.min(22, Math.floor(150 / n) - 2));
            const pct = k.total ? Math.round((k.done / k.total) * 100) : 0;
            return (
              <button key={d} type="button" className={"lp-hpx-weekview-day" + (d === todayIso ? " is-today" : "") + (d > todayIso ? " is-future" : "")} onClick={() => openDay(d)} aria-label={`${hpxLongDate(d)} : ${k.done} sur ${k.total} — ouvrir le jour`}>
                <span className="lp-hpx-weekview-head">
                  <b>{new Date(d + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "long" })}</b>
                  <span>{new Date(d + "T00:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>
                </span>
                {miniOf(d, size, 3)}
                <span className="lp-hpx-count"><b>{k.done}</b> / {k.total}</span>
                <span className="lp-hpx-weekview-bar" aria-hidden="true"><span style={{ width: pct + "%" }} /></span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (view === "month") {
    const first = date.slice(0, 7) + "-01";
    const start = hpxWeekStart(first);
    const nextMonth = hpxAddMonths(first, 1);
    const days = [];
    for (let d = start; d < nextMonth || days.length % 7; d = addDays(d, 1)) days.push(d);
    const month = first.slice(0, 7);
    return (
      <div className="lp-hpx">
        {toolbar}
        <div className="lp-hpx-monthview">
          {["Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam.", "Dim."].map((l) => <span key={l} className="lp-hpx-monthview-dow">{l}</span>)}
          {days.map((d) => {
            const k = stateOf(d);
            const n = pixelTasksSquareSize(k.groups);
            const size = Math.max(3, Math.min(8, Math.floor(64 / n) - 1));
            return (
              <button key={d} type="button" className={"lp-hpx-monthview-day" + (d.slice(0, 7) !== month ? " is-out" : "") + (d === todayIso ? " is-today" : "")} onClick={() => openDay(d)} aria-label={`${hpxLongDate(d)} : ${k.done} sur ${k.total} — ouvrir le jour`}>
                <span className="lp-hpx-monthview-num">{Number(d.slice(8, 10))}</span>
                {k.total ? miniOf(d, size, 1) : <span className="lp-ptx-month-empty" aria-hidden="true" />}
                <span className="lp-hpx-muted">{k.done} / {k.total}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  /* Taille des pixels par groupe : 28 px tant que la rangée tient dans la
     zone des liaisons, puis réduite (jusqu'à 12 px) pour ne pas déborder de
     la carte — un groupe de tâches est souvent plus long qu'un thème
     d'habitudes. */
  // Colonne des titres : élargie quand le widget a de la place, pour que les
  // en-têtes de groupe (nom, compteurs, « en cours », « à venir ») tiennent
  // sur une ligne ; même largeur pour tous les groupes (cases alignées).
  const listW = Math.round(Math.min(440, Math.max(300, (mainW || 0) * 0.3)));
  const wiresW = Math.max(0, mainW - 32 - listW);
  /* Packages actifs : chaque package est un conteneur distinct (cadre et
     fond à sa couleur, nom et nombre dans l'infobulle), côte à côte avec un
     écart net. */
  const PACK_GAP = 14; // écart entre deux conteneurs
  const PACK_PAD = 5;  // marge intérieure d'un conteneur, bordure comprise
  const PACK_TOP = 2;  // léger retrait des conteneurs sous le haut du groupe
  const PACK_LABEL = 0; // pas d'étiquette : le nom du package est dans l'infobulle
  /* Géométrie d'une rangée : taille des cases, écart, et centre x de chaque
     case (packages compris), pour poser les liaisons au bon endroit. */
  const pxGeom = (g) => {
    const packs = g.packages || [{ start: 0, count: g.items.length }];
    const tinted = packs.length > 1 || (packs[0] && packs[0].id !== "all");
    const pp = tinted ? PACK_PAD : 0;
    const width = (size, gap) => HPX_LEFT + HPX_PAD * 2 + packs.reduce((w, p) => w + pp * 2 + p.count * size + Math.max(0, p.count - 1) * gap, 0) + Math.max(0, packs.length - 1) * PACK_GAP + 8;
    let size = HPX_PX, gap = HPX_GAP;
    if (mainW && width(size, gap) > wiresW) {
      gap = 4;
      const fixed = width(0, gap);
      size = Math.max(12, Math.min(HPX_PX, Math.floor((wiresW - fixed) / Math.max(1, g.items.length))));
    }
    const xs = [];
    let x = HPX_LEFT + HPX_PAD;
    for (const p of packs) {
      x += pp;
      for (let j = 0; j < p.count; j++) xs.push(x + j * (size + gap) + size / 2);
      x += p.count * size + Math.max(0, p.count - 1) * gap + pp + PACK_GAP;
    }
    const top = tinted ? PACK_TOP : 0;
    const bottom = top + HPX_PAD * 2 + pp * 2 + (tinted ? PACK_LABEL : 0) + size;
    return { size, gap, pp, tinted, packs, xs, top, bottom, headH: tinted ? Math.max(HPX_HEAD_H, bottom + 12) : HPX_HEAD_H };
  };
  // Clic sur une case : jalon → terminé / rouvert ; tâche avec durée → anneau.
  const pixelClick = (it, e) => {
    // Futur : ouverture de la fiche seulement.
    if (it.future) { if (onOpen) onOpen(it.task); return; }
    if (it.task.milestone) { if (onToggleDone) onToggleDone(it.task.id); return; }
    const root = rootRef.current;
    const r = e.currentTarget.getBoundingClientRect();
    const base = root ? root.getBoundingClientRect() : { left: 0, top: 0 };
    const rootW = root ? root.clientWidth : 0;
    const left = Math.max(4, Math.min(r.left - base.left + (root ? root.scrollLeft : 0) - 90, rootW - 244));
    setRing({ taskId: it.task.id, x: left, y: r.bottom - base.top + (root ? root.scrollTop : 0) + 8 });
  };
  const groupCounts = (g) => (
    <>
      {g.items.some((i) => i.ghost) && <span className="lp-hpx-muted lp-ptx-ghost-count" title="Tâches en cours ce jour-là (fantômes)">+{g.items.filter((i) => i.ghost).length} en cours</span>}
      {g.items.some((i) => i.future) && <span className="lp-ptx-future-count" title="Tâches à venir (futur)">✦ {g.items.filter((i) => i.future).length} à venir</span>}
    </>
  );
  /* Un bloc = un en-tête (head(headH, folded)), ses lignes et sa rangée de
     cases reliée par les liaisons. Sert aux groupes simples comme à chaque
     sous-groupe d'un arbre. uid : suffixe unique des identifiants SVG. */
  const blockHeight = (b, folded) => pxGeom(b).headH + (folded ? 0 : b.items.length * HPX_ROW_H);
  const renderBlock = (b, uid, folded, head, key, cls) => {
    const geom = pxGeom(b);
    const headH = geom.headH;
    const blockH = headH + (folded ? 0 : b.items.length * HPX_ROW_H);
    const pxX = (i) => geom.xs[i];
    const pxBottom = geom.bottom;
    return (
      <div key={key} className={"lp-hpx-theme" + (folded ? " is-folded" : "") + (cls || "")} style={{ height: blockH, "--hpx-rows": folded ? 0 : b.items.length }}>
        <div className="lp-hpx-list" style={{ width: listW }}>
          {head(headH, folded)}
          {!folded && b.items.map((it) => {
            const t = it.task;
            const active = hover === t.id;
            const badge = ptxBadge(it);
            const color = ptxStatusColor(t, ctx);
            return (
              <div key={t.id} className={"lp-hpx-row" + (active ? " is-focus" : "") + (it.ghost ? " lp-ptx-ghost-row" : "") + (it.future ? " lp-ptx-future-row" : "") + (isTaskFocus(t) ? " lp-ptx-flag-row" : "") + (menu && menu.taskId === t.id ? " is-menu" : "")} style={{ height: HPX_ROW_H }} onMouseEnter={() => setHover(t.id)} onMouseLeave={() => setHover(null)} {...menuProps(it)}>
                <TaskPixel item={it} ctx={ctx} size={16} focused={active} onClick={(e) => pixelClick(it, e)} onHover={setHover} futureWindow={futureWindow} clickHint={it.future ? "Clic : ouvrir la fiche" : t.milestone ? "Clic : terminer / rouvrir le jalon" : "Clic : faire avancer"} />
                <button type="button" className={"lp-hpx-row-name lp-ptx-title" + (it.done ? " lp-ptx-done" : "")} onClick={() => onOpen && onOpen(t)} title={ptxLabel(it, ctx)}>{t.title || "Sans titre"}</button>
                {loadOn && pixelTaskEstimate(t) > 0 && <span className="lp-ptx-est" title="Estimation">⏱ {pixelTaskMinutesLabel(pixelTaskEstimate(t))}</span>}
                {badge && <span className={"lp-ptx-badge" + badge.cls}>{badge.text}</span>}
                <button type="button" className="lp-ptx-more" onClick={(e) => openMenu(it, e)} aria-label={"Actions — " + (t.title || "tâche")} title="Actions (ou clic droit)" aria-haspopup="menu">⋯</button>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={it.done}
                  aria-label={(it.done ? "Rouvrir " : "Terminer ") + (t.title || "la tâche")}
                  title={it.done ? "Rouvrir la tâche" : "Terminer la tâche"}
                  className={"lp-hpx-check" + (it.done ? " is-on" : "")}
                  style={{ "--c": color }}
                  disabled={!onToggleDone}
                  onClick={() => onToggleDone && onToggleDone(t.id)}
                  onFocus={() => setHover(t.id)}
                  onBlur={() => setHover(null)}
                >{it.done && <Check size={11} strokeWidth={3.2} />}</button>
                <span className="lp-hpx-anchor" style={{ background: color }} aria-hidden="true" />
              </div>
            );
          })}
        </div>
        <div className="lp-hpx-wires">
          <svg className="lp-hpx-wires-svg" aria-hidden="true">
            <defs><linearGradient id={`${svgIdRef.current}-aurore-${uid}`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#6366f1" /><stop offset=".6" stopColor="#06b6d4" /><stop offset="1" stopColor="#a855f7" /></linearGradient></defs>
            {!folded && b.items.map((it, i) => (
              <path
                key={it.task.id}
                d={habitPixelWirePath(headH + i * HPX_ROW_H + HPX_ROW_H / 2, pxX(i), pxBottom + 4, 6)}
                className={"lp-hpx-wire" + (it.done ? " is-on" : "") + (it.ghost ? " lp-ptx-ghost-wire" : "") + (it.future ? " lp-ptx-future-wire" : "") + (hover === it.task.id ? " is-focus" : "")}
                style={{ stroke: it.ghost ? undefined : it.future ? `url(#${svgIdRef.current}-aurore-${uid})` : ptxStatusColor(it.task, ctx) }}
              />
            ))}
          </svg>
          <div className={"lp-hpx-pixels" + (geom.tinted ? " lp-ptx-packed" : "")} style={{ left: HPX_LEFT, top: geom.top, padding: HPX_PAD, gap: PACK_GAP, "--tc": b.color }}>
            {geom.packs.map((pk) => (
              <span key={pk.id} className={"lp-ptx-pack" + (geom.tinted ? " is-tinted" : "") + (pk.id === "ghost" ? " is-ghost" : "") + (pk.id === "future" ? " is-horizon" : "")} style={{ gap: geom.gap, padding: geom.tinted ? `${geom.pp - 1 + PACK_LABEL}px ${geom.pp - 1}px ${geom.pp - 1}px` : 0, "--pc": pk.color }} title={pk.name ? pk.name + " — " + pk.count + " tâche" + (pk.count > 1 ? "s" : "") : undefined}>
                {b.items.slice(pk.start, pk.start + pk.count).map((it) => (
                  <TaskPixel key={it.task.id} item={it} ctx={ctx} size={geom.size} futureWindow={futureWindow} extra={menuProps(it)} focused={hover === it.task.id || (ring && ring.taskId === it.task.id) || (menu && menu.taskId === it.task.id)} onClick={(e) => pixelClick(it, e)} onHover={setHover} clickHint={it.future ? "Clic : ouvrir la fiche" : it.task.milestone ? (it.done ? "Clic : rouvrir le jalon" : "Clic : terminer le jalon (100 %)") : "Clic : faire avancer"} />
                ))}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  };
  /* « Rameaux » (#546) : un groupe à sous-groupes devient un petit arbre. Le
     tronc, à la couleur du groupe, descend de sa pastille ; chaque sous-
     groupe s'en détache par un rameau en dégradé jusqu'à son bourgeon, et
     garde sa propre rangée de cases, repliable à part. TRUNK_X = centre de
     la pastille du groupe, BUD_X = bord gauche du bourgeon (cf. CSS).
     Sous chaque bourgeon, un fil pointillé descend le long des tâches du
     sous-groupe, avec un nœud par tâche, plein quand elle est terminée ;
     THREAD_X = centre du bourgeon. */
  const TRUNK_X = 23.5, BUD_X = 33, THREAD_X = 42;
  const renderTree = (g, gi) => {
    const folded = collapsed.has(g.id);
    const subs = g.subgroups;
    const ys = [];
    const knots = []; // par sous-groupe : ordonnées des lignes de tâches
    let y = HPX_HEAD_H;
    for (const sg of subs) {
      const sgFolded = collapsed.has(sg.key);
      const headH = pxGeom(sg).headH;
      ys.push(y + headH / 2);
      knots.push(sgFolded ? [] : sg.items.map((_, j) => y + headH + j * HPX_ROW_H + HPX_ROW_H / 2));
      y += blockHeight(sg, sgFolded);
    }
    return (
      <div key={g.id} className={"lp-ptx-tree" + (folded ? " is-folded" : "")}>
        {!folded && subs.length > 0 && (
          <svg className="lp-ptx-tree-svg" width={listW} height={y} aria-hidden="true">
            <defs>
              {subs.map((sg, si) => (
                <linearGradient key={sg.key} id={`${svgIdRef.current}-rameau-${gi}-${si}`} gradientUnits="userSpaceOnUse" x1={TRUNK_X} y1="0" x2={BUD_X} y2="0">
                  <stop offset="0" stopColor={g.color} /><stop offset="1" stopColor={sg.color} />
                </linearGradient>
              ))}
            </defs>
            <path className="lp-ptx-trunk" d={`M ${TRUNK_X} ${HPX_HEAD_H / 2 + 7} V ${ys[ys.length - 1] - 12}`} style={{ stroke: g.color }} />
            {subs.map((sg, si) => (
              <path key={sg.key} className="lp-ptx-rameau" d={`M ${TRUNK_X} ${ys[si] - 12} Q ${TRUNK_X} ${ys[si]} ${TRUNK_X + 8} ${ys[si]} L ${BUD_X} ${ys[si]}`} stroke={`url(#${svgIdRef.current}-rameau-${gi}-${si})`} />
            ))}
            {subs.map((sg, si) => knots[si].length > 0 && (
              <g key={"fil-" + sg.key} className={"lp-ptx-thread" + (sg.items.some((it) => it.task.id === hover) ? " is-focus" : "")} style={{ "--bc": sg.color }}>
                <path className="lp-ptx-thread-line" d={`M ${THREAD_X} ${ys[si] + 10} V ${knots[si][knots[si].length - 1]}`} />
                {knots[si].map((ky, j) => {
                  const it = sg.items[j];
                  return <circle key={it.task.id} className={"lp-ptx-knot" + (it.done ? " is-on" : "") + (it.ghost || it.future ? " is-soft" : "") + (hover === it.task.id ? " is-focus" : "")} cx={THREAD_X} cy={ky} r={it.done ? 2.4 : 1.9} />;
                })}
              </g>
            ))}
          </svg>
        )}
        <div className={"lp-hpx-theme" + (folded ? " is-folded" : "")} style={{ height: HPX_HEAD_H }}>
          <div className="lp-hpx-list" style={{ width: listW }}>
            <div className="lp-ptx-head-wrap" style={{ height: HPX_HEAD_H }}>
            <button type="button" className="lp-hpx-theme-head lp-ptx-group-head" style={{ height: HPX_HEAD_H }} onClick={() => toggleGroup(g.id)} aria-expanded={!folded} title={(folded ? "Déplier le groupe " : "Replier le groupe ") + g.name}>
              <ChevronRight size={14} className="lp-hpx-theme-chevron" aria-hidden="true" />
              <span className="lp-hpx-dot is-big" style={{ background: g.color }} /><span className="lp-ptx-group-name">{g.name}</span>
              <TaskPixelSpectrum subgroups={subs} />
              {baseOn && <span className="lp-hpx-muted">{g.done} / {g.total}</span>}
              {groupCounts(g)}
              {folded && <span className="lp-hpx-muted lp-hpx-theme-hint">{subs.length} sous-groupe{subs.length > 1 ? "s" : ""} · {g.total} tâche{g.total > 1 ? "s" : ""}</span>}
            </button>
            {addBtn(g.id, g.name, [g.id], g.items)}
            </div>
          </div>
        </div>
        {!folded && subs.map((sg, si) => renderBlock(sg, `${gi}-${si}`, collapsed.has(sg.key), (headH, sgFolded) => (
          <div className="lp-ptx-head-wrap" style={{ height: headH }}>
          <button type="button" className="lp-hpx-theme-head lp-ptx-group-head lp-ptx-sub-head" style={{ height: headH }} onClick={() => toggleGroup(sg.key)} aria-expanded={!sgFolded} title={(sgFolded ? "Déplier le sous-groupe " : "Replier le sous-groupe ") + sg.name}>
            <TaskPixelBud sg={sg} />
            <span className="lp-ptx-group-name">{sg.name}</span>{baseOn && <span className="lp-hpx-muted">{sg.done} / {sg.total}</span>}
            {groupCounts(sg)}
            <ChevronRight size={12} className="lp-hpx-theme-chevron lp-ptx-sub-chevron" aria-hidden="true" />
            {sgFolded && <span className="lp-hpx-muted lp-hpx-theme-hint">{sg.total} tâche{sg.total > 1 ? "s" : ""}</span>}
          </button>
          {addBtn(sg.key, g.name + " › " + sg.name, [g.id, sg.id], sg.items)}
          </div>
        ), sg.key, " lp-ptx-sub"))}
      </div>
    );
  };
  const ringItem = ring ? day.items.find((i) => i.task.id === ring.taskId) : null;
  const validateRing = (value) => { setRing(null); applyProgress(ringItem, value); };
  const applyProgress = (it, value) => {
    if (!it) return;
    const t = it.task;
    const allowed = getStatusesForProject(ctx.statuses || [], ctx.projects || [], t.projectId, t.statusId);
    if (value >= 100) {
      if (it.done) { if (onUpdateTask && Number(t.progress) !== 100) onUpdateTask(t.id, { progress: 100 }); return; }
      const doneStatus = allowed.find((st) => /termin/i.test(st.name || ""));
      // Même chemin que la fiche : le passage à Terminé suit markTaskDone.
      if (onUpdateTask && doneStatus) onUpdateTask(t.id, { progress: 100, statusId: doneStatus.id });
      else if (onToggleDone) onToggleDone(t.id);
      return;
    }
    if (!onUpdateTask) return;
    const patch = { progress: value };
    if (it.done) {
      const reopen = allowed.find((st) => /en\s*cours/i.test(st.name || "")) || allowed.find((st) => !/termin/i.test(st.name || ""));
      if (reopen) patch.statusId = reopen.id;
    }
    onUpdateTask(t.id, patch);
  };
  return (
    <div ref={rootRef} className="lp-hpx lp-ptx" onKeyDown={onKeyDown}>
      {toolbar}
      {ringItem && <TaskProgressRing key={ringItem.task.id} item={ringItem} ctx={ctx} x={ring.x} y={ring.y} onClose={() => setRing(null)} onValidate={validateRing} onOpen={onOpen} />}
      {menu && findDayItem(menu.taskId) && (
        <PixelTaskMenu key={menu.taskId + ":" + menu.x + ":" + menu.y} item={findDayItem(menu.taskId)} ctx={ctx} x={menu.x} y={menu.y} todayIso={todayIso} onClose={() => setMenu(null)}
          onReschedule={reschedule} onPatch={(id, patch) => onUpdateTask && onUpdateTask(id, patch)} onProgress={applyProgress}
          onToggleDone={(id) => onToggleDone && onToggleDone(id)} onOpen={onOpen} />
      )}
      {capOpen && (
        <PixelCapacityPanel x={capOpen.x} y={capOpen.y} date={date} todayIso={todayIso} prefs={capPrefs} onClose={() => setCapOpen(null)}
          onUpdate={(patch) => onUpdateWidget && onUpdateWidget(patch)} />
      )}
      {adding && <PixelQuickAdd key={adding.key} x={adding.x} y={adding.y} label={adding.label} date={date} ctx={ctx} onSubmit={createQuick} onClose={() => setAdding(null)} />}
      {closure && (
        <PixelClosure title={closure.title} ids={closure.ids} findItem={findDayItem} ctx={ctx} date={date} todayIso={todayIso} onClose={() => setClosure(null)}
          onDone={(id) => onToggleDone && onToggleDone(id)} onReschedule={reschedule} />
      )}
      <div className={"lp-hpx-days lp-ptx-days" + (sidesFolded.prev ? " is-prev-folded" : "") + (sidesFolded.next ? " is-next-folded" : "")}>
        <TaskPixelSide date={prev} day={stateOf(prev)} groups={stateOf(prev).groups} ctx={ctx} todayIso={todayIso} onSelect={setDate} onOpen={onOpen} collapsed={collapsed} side="prev" folded={!!sidesFolded.prev} onToggleFold={() => toggleSide("prev")} drop={dropOn(prev)} dropOver={dropOver === prev} />
        <section ref={mainRef} className="lp-hpx-main" aria-label={hpxDayLabel(date, todayIso) + " — " + hpxLongDate(date)}>
          <div className="lp-hpx-main-head">
            <div className="lp-hpx-main-title"><b>{hpxDayLabel(date, todayIso)}</b><span>{hpxSubDate(date, todayIso)}</span></div>
            <div className="lp-hpx-summary">
              <TaskPixelMosaic groups={day.groups} day={day} ctx={ctx} size={9} />
              <span className="lp-hpx-summary-text"><b>Le pixel du jour</b><span>1 tâche = 1 pixel · date de jalon ou de fin{date === todayIso ? " · retards inclus" : ""}</span></span>
              <span className="lp-hpx-count is-big" aria-live="polite"><b>{day.done}</b> / {day.total}</span>
            </div>
          </div>
          {statusLegend.length > 0 && (
            <div className="lp-ptx-legend" aria-label="Légende">
              {statusLegend.map((s) => <span key={s.id}><i style={{ "--c": s.color || "#94A3B8" }} />{s.name}</span>)}
              {day.items.some((i) => i.lateDays > 0 && !i.done) && <span><i className="is-late" />En retard</span>}
              <span className="lp-ptx-legend-shape"><i className="is-milestone" />Jalon (clic = terminé)</span>
              <span className="lp-ptx-legend-shape"><i className="is-duration" />Tâche avec durée (clic = avancement)</span>
              <span className="lp-ptx-legend-shape"><i className="is-progress" />Avancement : le contour se fonce, depuis le haut</span>
              {day.items.some((i) => isTaskFocus(i.task)) && <span className="lp-ptx-legend-shape"><i className="is-flagged" />Focus</span>}
              {ghostOn && <span className="lp-ptx-legend-shape"><i className="is-ghost" />Fantôme : en cours</span>}
              {futureWindow > 0 && <span className="lp-ptx-legend-shape"><i className="is-horizon" />Futur : à venir sous {futureWindow} j (J+N)</span>}
            </div>
          )}
          {day.items.length > 0 && (
            <div className="lp-ptx-filters" role="search" aria-label="Filtres éclair">
              <label className="lp-ptx-search">
                <Search size={13} aria-hidden="true" />
                <input value={flt.query} onChange={(e) => setFlt((f) => ({ ...f, query: e.target.value }))} placeholder="Rechercher…" aria-label="Rechercher une tâche du jour" onKeyDown={(e) => { if (e.key === "Escape") setFlt((f) => ({ ...f, query: "" })); }} />
                {flt.query && <button type="button" onClick={() => setFlt((f) => ({ ...f, query: "" }))} aria-label="Effacer la recherche"><X size={12} /></button>}
              </label>
              <button type="button" className={"lp-ptx-chip is-late" + (flt.late ? " is-on" : "")} aria-pressed={flt.late} onClick={() => setFlt((f) => ({ ...f, late: !f.late }))}>● Retards <b>{chipCount.late}</b></button>
              <button type="button" className={"lp-ptx-chip" + (flt.milestone ? " is-on" : "")} aria-pressed={flt.milestone} onClick={() => setFlt((f) => ({ ...f, milestone: !f.milestone }))}>◆ Jalons <b>{chipCount.milestone}</b></button>
              <button type="button" className={"lp-ptx-chip is-focus" + (flt.focus ? " is-on" : "")} aria-pressed={flt.focus} onClick={() => setFlt((f) => ({ ...f, focus: !f.focus }))}>⭐ Focus <b>{chipCount.focus}</b></button>
              {assignees.length > 0 && (
                <select className={"lp-ptx-chip" + (flt.assignee ? " is-on" : "")} value={flt.assignee} onChange={(e) => setFlt((f) => ({ ...f, assignee: e.target.value }))} aria-label="Responsable">
                  <option value="">Tous responsables</option>
                  {assignees.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              )}
              {fltOn && (
                <>
                  <span className="lp-hpx-muted lp-ptx-filter-count">{shownCount} tâche{shownCount > 1 ? "s" : ""} affichée{shownCount > 1 ? "s" : ""} sur {day.items.length}</span>
                  <button type="button" className="lp-tool-btn" onClick={() => setFlt({ query: "", late: false, milestone: false, focus: false, assignee: "" })}>Effacer</button>
                </>
              )}
            </div>
          )}
          {load && (
            <div className={"lp-ptx-load" + (load.over ? " is-over" : "")} aria-label="Charge du jour">
              <div className="lp-ptx-load-top">
                <b>Charge : {pixelTaskMinutesLabel(load.planned)} / {pixelTaskMinutesLabel(load.free)} disponible{load.free >= 120 ? "s" : ""}</b>
                <span className={load.over ? "lp-ptx-late" : "lp-ptx-ok"}>{load.over ? "+" + pixelTaskMinutesLabel(load.over) + " de trop" : pixelTaskMinutesLabel(load.free - load.planned) + " de marge"}</span>
              </div>
              {(() => {
                const scale = Math.max(load.free, load.planned, 1);
                return (
                  <div className="lp-ptx-load-bar" role="img" aria-label={`${pixelTaskMinutesLabel(load.planned)} prévues pour ${pixelTaskMinutesLabel(load.free)} disponibles`}>
                    {load.parts.map((p) => <span key={p.id} style={{ width: (p.minutes / scale) * 100 + "%", background: p.color }} title={`${p.name} — ${pixelTaskMinutesLabel(p.minutes)}`} />)}
                    {load.over > 0 && <i className="lp-ptx-load-over" style={{ left: (load.free / scale) * 100 + "%", width: (load.over / scale) * 100 + "%" }} />}
                    {load.over > 0 && <i className="lp-ptx-load-cap" style={{ left: (load.free / scale) * 100 + "%" }} title="Temps disponible" />}
                  </div>
                );
              })()}
              <div className="lp-ptx-load-legend">
                {load.parts.map((p) => <span key={p.id}><i style={{ background: p.color }} />{p.name} {pixelTaskMinutesLabel(p.minutes)}</span>)}
                <span className="lp-hpx-muted">{capacityH ? "Capacité ce jour : " + pixelTaskMinutesLabel(capacityH * 60) : "Jour non travaillé (capacité 0 h)"}{capException ? " (exception)" : ""}</span>
                {load.unestimated > 0 && <span className="lp-hpx-muted">{load.unestimated} tâche{load.unestimated > 1 ? "s" : ""} sans estimation (clic droit → Estimation)</span>}
                {load.over > 0 && onUpdateTask && (
                  <button type="button" className="lp-tool-btn" onClick={() => setClosure({ title: "Reporter le surplus (" + pixelTaskMinutesLabel(load.over) + ")", ids: pixelTaskOverflowCandidates(day.items, load.over).map((i) => i.task.id) })}>Proposer un report</button>
                )}
              </div>
            </div>
          )}
          {bandItems.length > 0 && (
            <div className="lp-ptx-band" aria-label="Mes tâches Focus du jour">
              {bandItems.map((it, n) => {
                const t = it.task;
                const project = (ctx.projects || []).find((x) => x.id === t.projectId);
                const pr = Math.max(0, Math.min(100, Number(t.progress) || 0));
                return (
                  <div key={t.id} className={"lp-ptx-band-card" + (it.done ? " is-done" : "") + (it.lateDays > 0 && !it.done ? " is-late" : "")} style={{ "--c": ptxStatusColor(t, ctx) }} onMouseEnter={() => setHover(t.id)} onMouseLeave={() => setHover(null)} {...menuProps(it)}>
                    <div className="lp-ptx-band-meta"><span aria-hidden="true">⭐ {n + 1}</span>{project ? " · " + project.name : ""}</div>
                    <button type="button" className={"lp-ptx-band-title" + (it.done ? " lp-ptx-done" : "")} onClick={() => onOpen && onOpen(t)} title={ptxLabel(it, ctx)}>{t.title || "Sans titre"}</button>
                    <div className="lp-ptx-band-foot">
                      {it.done ? <span className="lp-ptx-ok">✓ terminée</span>
                        : it.lateDays > 0 ? <span className="lp-ptx-badge is-late">retard {it.lateDays} j</span>
                        : t.milestone ? <span className="lp-ptx-badge is-milestone">jalon</span>
                        : <span className="lp-ptx-band-progress" aria-label={"Avancement " + pr + " %"}><b style={{ width: pr + "%" }} /></span>}
                      <span style={{ flex: 1 }} />
                      <button type="button" className="lp-ptx-more" onClick={(e) => openMenu(it, e)} aria-label={"Actions — " + (t.title || "tâche")} title="Actions">⋯</button>
                      <button type="button" role="checkbox" aria-checked={it.done} aria-label={(it.done ? "Rouvrir " : "Terminer ") + (t.title || "la tâche")} className={"lp-hpx-check" + (it.done ? " is-on" : "")} style={{ "--c": ptxStatusColor(t, ctx) }} disabled={!onToggleDone} onClick={() => onToggleDone && onToggleDone(t.id)}>{it.done && <Check size={11} strokeWidth={3.2} />}</button>
                    </div>
                  </div>
                );
              })}
              {focusAll.length > 3 && <div className="lp-hpx-muted lp-ptx-band-more">+{focusAll.length - 3} autre{focusAll.length - 3 > 1 ? "s" : ""} Focus dans les groupes</div>}
            </div>
          )}
          {!groups.length && fltOn && <div className="lp-empty lp-ptx-empty">{bandItems.length ? "Aucune autre tâche ne correspond aux filtres." : "Aucune tâche ne correspond aux filtres."}</div>}
          {!groups.length && !fltOn && !bandItems.length && <div className="lp-empty lp-ptx-empty">{baseOn ? (hiddenDone ? "Toutes les tâches de ce jour sont terminées (" + hiddenDone + " masquée" + (hiddenDone > 1 ? "s" : "") + ")." : "Aucune tâche à cette date pour ce filtre.") : "Tâches du jour masquées (case « Base ») — cocher Fantômes ou Futur pour afficher les autres couches."}</div>}
          {groups.map((g, gi) => (g.subgroups ? renderTree(g, gi) : renderBlock(g, String(gi), collapsed.has(g.id), (headH, folded) => (
            <div className="lp-ptx-head-wrap" style={{ height: headH }}>
            <button type="button" className="lp-hpx-theme-head lp-ptx-group-head" style={{ height: headH }} onClick={() => toggleGroup(g.id)} aria-expanded={!folded} title={(folded ? "Déplier le groupe " : "Replier le groupe ") + g.name}>
              <ChevronRight size={14} className="lp-hpx-theme-chevron" aria-hidden="true" />
              <span className="lp-hpx-dot is-big" style={{ background: g.color }} /><span className="lp-ptx-group-name">{g.name}</span>{baseOn && <span className="lp-hpx-muted">{g.done} / {g.total}</span>}
              {groupCounts(g)}
              {folded && <span className="lp-hpx-muted lp-hpx-theme-hint">{g.total} tâche{g.total > 1 ? "s" : ""}</span>}
            </button>
            {addBtn(g.id, g.name, [g.id], g.items)}
            </div>
          ), g.id)))}
        </section>
        <TaskPixelSide date={next} day={stateOf(next)} groups={stateOf(next).groups} ctx={ctx} todayIso={todayIso} onSelect={setDate} onOpen={onOpen} collapsed={collapsed} side="next" folded={!!sidesFolded.next} onToggleFold={() => toggleSide("next")} drop={dropOn(next)} dropOver={dropOver === next} />
      </div>
      <div className="lp-hpx-week" role="group" aria-label="Semaine">
        {week.map((d) => {
          const k = stateOf(d);
          return (
            <button key={d} type="button" className={"lp-hpx-week-day" + (d === date ? " is-active" : "") + (d === todayIso ? " is-today" : "") + (dropOver === d ? " is-drop" : "")} onClick={() => setDate(d)} aria-pressed={d === date} aria-label={`${hpxLongDate(d)} : ${k.done} sur ${k.total}`} {...(d !== date ? dropOn(d) : {})}>
              {miniOf(d, 6, 2)}
              <span><b>{new Date(d + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" })}</b><span className="lp-hpx-muted">{k.done} / {k.total}</span></span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
// Styles de Nexora (GlobalStyles, part-001) utilisés par le module, et jetons de thème résolus.
const PIXEL_TASKS_CSS = ".nx-ptx-scope,body>.lp-quick-context-menu,body>.lp-overlay{--accent:#FF7A3D;--border:#DBDFDB;--border-strong:#C2C8C3;--danger-text:#D72C20;--font-display:'Inter', ui-sans-serif, sans-serif;--ink:var(--text-primary);--ink-hover:#232B3A;--line-blue:#2C6BE0;--paper-soft:#E6E9E7;--radius:7px;--radius-lg:8px;--radius-sm:5px;--signal:#FF7A3D;--surface:#FFFFFF;--text-600:var(--text-secondary);--text-900:var(--text-primary);--text-primary:#10151F;--text-secondary:#495166}\n\n.lp-icon-btn{ background:none; border:none; cursor:pointer; color:var(--text-600); padding:4px; border-radius:var(--radius-sm); display:flex; transition:background .12s ease, color .12s ease; }\n.lp-icon-btn:hover{ background:var(--paper-soft); color:var(--text-900); }\n.lp-tool-btn{ display:flex; align-items:center; gap:5px; background:var(--surface); border:1px solid var(--border); padding:5px 9px; border-radius:var(--radius-sm); font-size:11px; font-weight:600; color:var(--text-900); cursor:pointer; white-space:nowrap; transition:background .12s ease, color .12s ease, border-color .12s ease; }\n.lp-tool-btn:hover{ background:var(--paper-soft); }\n.lp-tool-btn.active{ background:var(--ink); color:#fff; border-color:var(--ink); }\n.lp-quick-context-menu{ position:fixed; z-index:2000; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); box-shadow:0 8px 24px rgba(10,15,25,0.16); padding:5px; min-width:180px; animation:lp-modal-in .1s ease; }\n.lp-tool-btn:disabled, .lp-btn:disabled{ opacity:0.4; cursor:not-allowed; }\n.lp-empty{ padding:24px; text-align:center; color:var(--text-600); font-size:13px; }\n.lp-widget-head-toolbar{ display:flex; align-items:center; gap:5px; flex:1 1 auto; min-width:20px; overflow-x:auto; overflow-y:hidden; cursor:default; scrollbar-width:none; }\n.lp-widget-head-toolbar::-webkit-scrollbar{ display:none; }\n.lp-widget-head-toolbar:has(.lp-ptx-groupby){ flex-wrap:wrap; overflow:visible; row-gap:5px; }\n.lp-widget-head:has(.lp-ptx-groupby) > .lp-icon-btn, .lp-widget-head:has(.lp-ptx-groupby) > .lp-drag-handle, .lp-widget-head:has(.lp-ptx-groupby) > .lp-widget-title{ margin-top:5px; }\n.lp-widget-move-group .lp-icon-btn:disabled{ opacity:0.3; cursor:default; }\n.lp-filter-select-actions .lp-btn{ flex:1; padding:4px 8px; font-size:11px; }\n.lp-widget-minigantt-toolbar .lp-tool-btn{ height:26px; padding:0 8px; font-size:10px; gap:4px; }\n.lp-orgmetro-views-form .lp-btn{ display:inline-flex; align-items:center; gap:4px; white-space:nowrap; }\n.lp-userprofile-head .lp-btn{ margin-left:auto; flex:0 0 auto; }\n.lp-pm-selection-bar .lp-btn{ background:rgba(255,255,255,0.12); color:#fff; border:none; }\n.lp-pm-selection-bar .lp-btn:hover{ background:rgba(255,255,255,0.22); }\n.lp-table-bulkbar .lp-tool-btn{ background:rgba(255,255,255,0.12); border-color:rgba(255,255,255,0.2); color:#fff; }\n.lp-table-bulkbar .lp-tool-btn:hover{ background:rgba(255,255,255,0.22); }\n.lp-overlay{\n          position:fixed; inset:0; background:rgba(10,15,25,0.5); display:flex; align-items:center; justify-content:center;\n          \n          z-index:1200;\n          animation:lp-overlay-in .12s ease;\n        }\n.lp-modal{ background:var(--surface); width:420px; max-width:92vw; border-radius:var(--radius-lg); max-height:86vh; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 12px 32px rgba(10,15,25,0.14); animation:lp-modal-in .14s cubic-bezier(.2,.8,.3,1); }\n.lp-modal-wide{ width:560px; }\n.lp-modal-extra-wide{ width:780px; }\n.lp-modal-compact{ width:340px; }\n.lp-modal-compact .lp-modal-head{ padding:13px 16px; }\n.lp-modal-compact .lp-modal-head h3{ font-size:14.5px; }\n.lp-modal-compact .lp-modal-body{ padding:14px 16px; gap:10px; }\n.lp-modal-compact .lp-modal-foot{ padding:11px 16px; }\n.lp-icon-btn.lp-focus-row-btn.is-on{ color:#0E9F8E; background:color-mix(in srgb, #0E9F8E 12%, transparent); }\n.lp-modal-head{ display:flex; align-items:center; justify-content:space-between; padding:16px 18px; border-bottom:1px solid var(--border); }\n.lp-modal-head h3{ font-family:var(--font-display); margin:0; font-size:16px; font-weight:700; }\n.lp-modal-body{ padding:18px; overflow-y:auto; display:flex; flex-direction:column; gap:14px; }\n.lp-modal-foot{ padding:14px 18px; border-top:1px solid var(--border); display:flex; justify-content:space-between; gap:8px; }\n.lp-btn-mini{ display:inline-flex; align-items:center; gap:6px; padding:6px 10px; font-size:11.5px; }\n.lp-btn{ padding:8px 14px; border-radius:var(--radius-sm); font-size:13px; font-weight:600; cursor:pointer; border:1px solid var(--border); background:var(--surface); color:var(--text-900); transition:background .12s ease, border-color .12s ease, color .12s ease; }\n.lp-btn:hover{ background:var(--paper-soft); }\n.lp-btn-primary{ background:var(--ink); color:#fff; border-color:var(--ink); }\n.lp-btn-primary:hover{ background:var(--ink-hover); }\n.lp-btn-danger{ color:var(--danger-text); border-color:#f2c9c9; background:#FEF4F4; }\n.lp-view-order-arrows .lp-icon-btn{ padding:1px; }\n.lp-view-order-arrows .lp-icon-btn:disabled{ opacity:0.25; cursor:default; }\n.lp-manage-item .lp-icon-btn{ position:relative; }\n.lp-carte-quick.is-active .lp-tool-btn{ border-color:var(--primary, #245edb); color:var(--primary, #245edb); background:rgba(36,94,219,.08); }\n.lp-carte-zoom .lp-icon-btn{ width:38px; height:38px; justify-content:center; align-items:center; background:var(--surface); border:1px solid var(--border); box-shadow:0 2px 8px rgba(24,38,61,.12); }\n.lp-carte-zoom .lp-icon-btn.is-active{ background:var(--accent, #2563eb); color:#fff; border-color:transparent; }\n.lp-carte-wheel-chips .lp-btn{ min-height:28px; padding:2px 9px; font-size:12px; }\n.lp-cosmos-cta .lp-btn{ flex:1; justify-content:center; min-height:38px; }\n.lp-fleuve-zoom .lp-icon-btn{ color:#4e2f19; }\n.lp-task-quick-dates .lp-btn{ padding:5px 12px; font-size:12.5px; }\n.nexora-icon-footer .lp-btn{padding:7px 14px!important;font-size:11.5px!important;}\n.nexora-icon-footer .lp-btn-primary{min-width:112px;font-weight:800;box-shadow:0 3px 9px color-mix(in srgb,var(--accent) 24%,transparent);}\n.lp-filter-condition-row > .lp-filter-cond-select,\n        .lp-filter-condition-row > .lp-mode-toggle,\n        .lp-filter-condition-row > .lp-icon-btn{ margin-top:1px; }\n.lp-density-row{ display:flex; gap:8px; }\n.lp-density-btn{ flex:1; display:flex; align-items:center; justify-content:center; gap:5px; padding:9px 10px; border:1px solid var(--border); border-radius:var(--radius-sm); background:var(--surface); cursor:pointer; font-size:12.5px; font-weight:600; color:var(--text-600); }\n.lp-density-btn.active{ border-color:var(--accent); color:var(--text-900); background:color-mix(in srgb, var(--accent) 12%, white); }\n.nexora-icon-editor-panel-v16 .nexora-icon-footer .lp-btn:not(.nexora-icon-save-bottom){\n  flex:0 0 auto!important;\n  white-space:nowrap!important;\n}\n.nexora-icon-editor-panel-v16 .nexora-icon-footer .lp-btn:not(.nexora-icon-save-bottom){\n  flex:0 0 auto!important;\n  margin:0!important;\n}\n.lp-modal-host .lp-overlay{z-index:10000;}\n.lp-modal-host :focus-visible{outline:2px solid var(--signal);outline-offset:2px;}\n.lp-modal[tabindex=\"-1\"]:focus{outline:none;}\n.lp-tool-btn.active{\n          border-color:color-mix(in srgb,var(--line-blue) 50%,var(--border));\n        }\n.lp-modal.lp-markdown-import-modal{\n          width:min(1060px,94vw);\n          max-width:1060px;\n          max-height:90vh;\n        }\n.lp-markdown-import-modal .lp-modal-body{\n          overflow-x:hidden;\n          padding:18px 20px;\n        }\n.lp-markdown-import-modal .lp-modal-foot{\n          padding:12px 20px;\n        }\n.lp-md-common-grid .lp-btn{\n          flex:0 0 auto;\n          min-width:58px;\n        }\n.lp-modal.lp-filters-modal{\n          width:min(920px,calc(100vw - 32px));\n          max-width:min(920px,calc(100vw - 32px));\n          max-height:min(90vh,900px);\n        }\n.lp-filters-modal .lp-modal-body{\n          overflow-y:auto;\n          overflow-x:hidden;\n          min-width:0;\n          padding:16px 18px;\n        }\n.lp-filters-modal .lp-modal-foot{\n          padding:12px 18px;\n        }\n.lp-filters-modal .lp-filter-condition-row > .lp-icon-btn{\n          justify-self:end;\n          flex:0 0 auto;\n        }\n.lp-density-btn:disabled{ opacity:.45; cursor:not-allowed; }\n        /* Pixel des habitudes (#353) : une habitude = un pixel. Couleurs de\n           donn\u00e9es (--c : couleur de l'habitude) ; surfaces et textes en\n           variables s\u00e9mantiques pour suivre le th\u00e8me. L'\u00e9tat ne repose\n           jamais sur la couleur seule : coche, valeur, hachures, tiret. */\n        .lp-hpx{ container-type:inline-size; display:flex; flex-direction:column; gap:12px; height:100%; min-height:0; overflow:auto; font-variant-numeric:tabular-nums; }\n        .lp-hpx-muted{ color:var(--text-600); font-weight:600; font-size:11.5px; }\n        .lp-hpx-dot{ width:9px; height:9px; border-radius:3px; flex:none; }\n        .lp-hpx-dot.is-big{ width:11px; height:11px; }\n        .lp-hpx-nav{ display:inline-flex; align-items:center; gap:2px; border:1px solid var(--border); border-radius:9px; padding:2px; background:var(--paper-soft); }\n        .lp-hpx-nav-side{ font:inherit; font-size:12px; font-weight:600; color:var(--text-600); background:transparent; border:0; border-radius:7px; padding:4px 8px; cursor:pointer; }\n        .lp-hpx-nav-side:hover{ background:var(--surface); color:var(--text-900); }\n        .lp-hpx-nav-current{ position:relative; font-size:12px; font-weight:650; color:#fff; background:var(--life-blue, #245edb); border-radius:7px; padding:4px 10px; cursor:pointer; white-space:nowrap; }\n        .lp-hpx-nav-current input{ position:absolute; inset:0; opacity:0; cursor:pointer; width:100%; }\n        .lp-hpx-nav-current:focus-within{ outline:2px solid var(--life-blue, #245edb); outline-offset:2px; }\n        .lp-hpx-days{ display:grid; grid-template-columns:minmax(200px, 260px) minmax(0, 1fr) minmax(200px, 260px); gap:12px; align-items:start; }\n        .lp-hpx-side, .lp-hpx-main{ border:1px solid var(--border); border-radius:14px; background:var(--surface); }\n        .lp-hpx-side{ background:var(--paper-soft); padding:10px 12px; display:flex; flex-direction:column; gap:4px; }\n        .lp-hpx-side-head{ display:flex; align-items:flex-start; gap:8px; font:inherit; text-align:left; background:transparent; border:0; padding:0 0 4px; cursor:pointer; color:inherit; border-radius:8px; }\n        .lp-hpx-side-head:focus-visible{ outline:2px solid var(--life-blue, #245edb); outline-offset:2px; }\n        .lp-hpx-side-title{ display:flex; flex-direction:column; flex:1; min-width:0; }\n        .lp-hpx-side-title b{ font-size:14px; }\n        .lp-hpx-side-title span{ font-size:11.5px; color:var(--text-600); }\n        .lp-hpx-count{ font-size:14px; white-space:nowrap; }\n        .lp-hpx-count b{ font-weight:800; }\n        .lp-hpx-count.is-big{ font-size:21px; }\n        .lp-hpx-side-theme-head{ display:flex; align-items:center; gap:6px; font-size:11.5px; font-weight:700; margin-top:4px; }\n        .lp-hpx-side-row{ display:flex; align-items:center; gap:7px; font-size:12px; padding:1px 0 1px 15px; }\n        .lp-hpx-side-row.is-na .lp-hpx-side-name{ color:var(--text-600); }\n        .lp-hpx-side-name{ flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }\n        .lp-hpx-mosaic{ display:inline-flex; flex-direction:column; gap:2px; flex:none; }\n        .lp-hpx-mosaic-row{ display:flex; gap:2px; }\n        .lp-hpx-main{ padding:10px 16px 14px; display:flex; flex-direction:column; gap:4px; min-width:0; }\n        .lp-hpx-main-head{ display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:4px; }\n        .lp-hpx-main-title{ display:flex; flex-direction:column; flex:1; min-width:140px; }\n        .lp-hpx-main-title b{ font-size:20px; font-weight:750; }\n        .lp-hpx-main-title span{ color:var(--text-600); }\n        .lp-hpx-summary{ display:flex; align-items:center; gap:12px; border:1px solid var(--border); border-radius:12px; padding:6px 12px; }\n        .lp-hpx-summary-text{ display:flex; flex-direction:column; }\n        .lp-hpx-summary-text span{ font-size:11px; color:var(--text-600); }\n        .lp-hpx-theme{ display:flex; align-items:flex-start; min-width:0; }\n        .lp-hpx-list{ width:300px; flex:none; }\n        .lp-hpx-theme-head{ display:flex; align-items:center; gap:8px; font:inherit; font-size:13.5px; font-weight:700; color:inherit; background:transparent; border:0; padding:0 6px 0 0; margin-left:-4px; width:100%; text-align:left; cursor:pointer; border-radius:8px; }\n        .lp-hpx-theme-head:hover{ background:var(--paper-soft); }\n        .lp-hpx-theme-head:focus-visible{ outline:2px solid var(--life-blue, #245edb); outline-offset:1px; }\n        .lp-hpx-theme-chevron{ flex:none; color:var(--text-600); transform:rotate(90deg); transition:transform .15s ease; }\n        .lp-hpx-theme.is-folded .lp-hpx-theme-chevron{ transform:rotate(0deg); }\n        .lp-hpx-theme-hint{ font-weight:500; }\n        .lp-hpx-row{ display:flex; align-items:center; gap:8px; padding-left:19px; font-size:12.5px; border-radius:6px; }\n        .lp-hpx-row.is-focus{ background:color-mix(in srgb, var(--life-blue, #245edb) 7%, transparent); }\n        .lp-hpx-row.is-na .lp-hpx-row-name{ color:var(--text-600); }\n        .lp-hpx-row > .lp-hpx-px{ display:none; }\n        .lp-hpx-row-name{ flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }\n        .lp-hpx-anchor{ width:6px; height:6px; border-radius:50%; flex:none; }\n        .lp-hpx-check{ width:18px; height:18px; border-radius:5px; border:1.5px solid var(--border-strong, #b9c7d8); background:var(--surface); display:inline-grid; place-items:center; padding:0; cursor:pointer; color:#fff; flex:none; }\n        .lp-hpx-check.is-on{ background:var(--c); border-color:var(--c); }\n        .lp-hpx-check:focus-visible, .lp-hpx-step button:focus-visible, .lp-hpx-na-btn:focus-visible, .lp-hpx-na-chip:focus-visible{ outline:2px solid var(--life-blue, #245edb); outline-offset:2px; }\n        .lp-hpx-step{ display:inline-flex; align-items:center; border:1px solid var(--border); border-radius:999px; background:var(--surface); height:22px; flex:none; }\n        .lp-hpx-step button{ width:22px; height:20px; border:0; background:transparent; color:var(--text-600); font-weight:700; font-size:13px; cursor:pointer; border-radius:999px; padding:0; }\n        .lp-hpx-step button:disabled{ opacity:.35; cursor:default; }\n        .lp-hpx-step b{ min-width:34px; text-align:center; font-size:12px; }\n        .lp-hpx-na-btn{ font:inherit; font-size:10px; font-weight:700; color:var(--text-600); background:transparent; border:1px dashed var(--border); border-radius:999px; padding:0 5px; height:18px; cursor:pointer; opacity:0; flex:none; }\n        .lp-hpx-row:hover .lp-hpx-na-btn, .lp-hpx-row.is-focus .lp-hpx-na-btn, .lp-hpx-na-btn:focus-visible{ opacity:1; }\n        .lp-hpx-na-chip{ font:inherit; font-size:10.5px; font-weight:700; color:var(--text-600); background:var(--paper-soft); border:1px dashed var(--border-strong, #b9c7d8); border-radius:999px; padding:1px 8px; cursor:pointer; flex:none; }\n        .lp-hpx-wires{ position:relative; flex:1; min-width:0; align-self:stretch; }\n        .lp-hpx-wires-svg{ position:absolute; inset:0; width:100%; height:100%; overflow:visible; pointer-events:none; }\n        .lp-hpx-wire{ fill:none; stroke-width:1.5; stroke-opacity:.45; }\n        .lp-hpx-wire.is-on{ stroke-opacity:.95; }\n        .lp-hpx-wire.is-na{ stroke:var(--border-strong, #b9c7d8); stroke-dasharray:3 3; }\n        .lp-hpx-wire.is-focus{ stroke-width:2.6; stroke-opacity:1; }\n        .lp-hpx-pixels{ position:absolute; top:0; display:flex; border-radius:10px; background:color-mix(in srgb, var(--tc) 5%, var(--surface)); border:1px solid color-mix(in srgb, var(--tc) 20%, var(--surface)); }\n        .lp-hpx-px{ position:relative; display:inline-grid; place-items:center; flex:none; border:0; padding:0; border-radius:5px; color:#fff; font:inherit; }\n        button.lp-hpx-px{ cursor:pointer; }\n        button.lp-hpx-px:focus-visible{ outline:2.5px solid var(--life-blue, #245edb); outline-offset:2px; }\n        .lp-hpx-px.is-done{ background:var(--c); box-shadow:inset 0 -2px 0 rgba(0,0,0,.14); }\n        .lp-hpx-px.is-part{ background:linear-gradient(to top, var(--c) var(--fill), color-mix(in srgb, var(--c) 12%, var(--surface)) var(--fill)); box-shadow:inset 0 0 0 1.5px var(--c); }\n        .lp-hpx-px.is-todo{ background:color-mix(in srgb, var(--c) 9%, var(--surface)); box-shadow:inset 0 0 0 1.5px color-mix(in srgb, var(--c) 42%, var(--surface)); }\n        .lp-hpx-px.is-todo.is-future{ background:var(--surface); box-shadow:inset 0 0 0 1.5px var(--border); }\n        .lp-hpx-px.is-na{ background:repeating-linear-gradient(135deg, var(--paper-soft) 0 4px, var(--border) 4px 6px); box-shadow:inset 0 0 0 1px var(--border); }\n        .lp-hpx-px.is-focus{ outline:2.5px solid var(--life-blue, #245edb); outline-offset:2px; }\n        .lp-hpx-mosaic .lp-hpx-px, .lp-hpx-side-row .lp-hpx-px{ border-radius:2px; }\n        .lp-hpx-px.is-filler{ background:var(--paper-soft); box-shadow:inset 0 0 0 1px var(--border); opacity:.7; }\n        .lp-hpx-px-val{ font-size:10px; font-weight:800; }\n        .lp-hpx-px.is-done .lp-hpx-px-val{ color:#fff; text-shadow:0 1px 1px rgba(0,0,0,.25); }\n        .lp-hpx-px.is-part .lp-hpx-px-val{ color:var(--text-900); background:color-mix(in srgb, var(--surface) 85%, transparent); border-radius:4px; padding:0 2px; }\n        .lp-hpx-px-na{ color:var(--text-600); font-weight:800; }\n        .lp-hpx-week{ display:grid; grid-template-columns:repeat(7, minmax(0, 1fr)); gap:8px; }\n        .lp-hpx-week-day{ display:flex; align-items:center; gap:8px; font:inherit; font-size:12px; text-align:left; border:1px solid var(--border); border-radius:12px; background:var(--surface); padding:7px 9px; cursor:pointer; color:inherit; min-width:0; }\n        .lp-hpx-week-day > span:last-child{ display:flex; flex-direction:column; min-width:0; }\n        .lp-hpx-week-day.is-active{ border-color:var(--life-blue, #245edb); box-shadow:0 0 0 2px color-mix(in srgb, var(--life-blue, #245edb) 18%, transparent); }\n        .lp-hpx-week-day:focus-visible{ outline:2px solid var(--life-blue, #245edb); outline-offset:2px; }\n        /* Pixel Tasks (#524) : m\u00eames gabarits, pixel color\u00e9 par le statut. */\n        .lp-ptx-px.is-late{ box-shadow:0 0 0 2px var(--surface), 0 0 0 3.5px #dc2626; }\n        .lp-ptx-px.is-todo.is-late{ box-shadow:inset 0 0 0 1.5px color-mix(in srgb, var(--c) 42%, var(--surface)), 0 0 0 2px var(--surface), 0 0 0 3.5px #dc2626; }\n        .lp-hpx-mosaic .lp-ptx-px.is-late, .lp-hpx-side-row .lp-ptx-px.is-late{ box-shadow:inset 0 0 0 1.5px #dc2626; }\n        /* Avancement : la part accomplie du contour existant se fonce. */\n        .lp-ptx-ring-outline{ position:absolute; inset:0; width:100%; height:100%; overflow:visible; pointer-events:none; }\n        .lp-ptx-ring-outline path{ fill:none; stroke:var(--c); }\n        .lp-ptx-px.is-ghost .lp-ptx-ring-outline path{ stroke:var(--text-900); }\n        .lp-ptx-px.is-horizon .lp-ptx-ring-outline path{ stroke:#3730a3; }\n        .lp-ptx-title{ font:inherit; font-size:12.5px; text-align:left; background:transparent; border:0; padding:0; color:inherit; cursor:pointer; }\n        .lp-ptx-title:hover{ text-decoration:underline; }\n        .lp-ptx-title:focus-visible{ outline:2px solid var(--life-blue, #245edb); outline-offset:2px; border-radius:3px; }\n        .lp-ptx-done{ color:var(--text-600); text-decoration:line-through; }\n        .lp-ptx-badge{ flex:none; font-size:11px; font-weight:650; color:var(--text-600); white-space:nowrap; }\n        .lp-ptx-badge.is-late{ color:#b91c1c; background:#fee2e2; border-radius:999px; padding:1px 7px; }\n        .lp-ptx-badge.is-milestone{ color:#c2410c; background:#ffedd5; border-radius:999px; padding:1px 7px; }\n        .lp-hpx-check:disabled{ cursor:default; opacity:.5; }\n        .lp-ptx-side-row{ font:inherit; font-size:12px; text-align:left; background:transparent; border:0; color:inherit; cursor:pointer; width:100%; border-radius:6px; }\n        .lp-ptx-side-row:hover{ background:var(--surface); }\n        .lp-ptx-side-row:focus-visible{ outline:2px solid var(--life-blue, #245edb); outline-offset:1px; }\n        .lp-ptx-ok{ color:#15803d; }\n        .lp-ptx-late{ color:#b91c1c; }\n        .lp-ptx-empty-side{ padding:2px 0; }\n        /* Vue de projet (#542) : m\u00eame page que la Heat map ; conteneur de\n           requ\u00eates pour que le widget s'adapte \u00e0 la largeur de la vue. */\n        .lp-ptx-view{ padding:16px 20px; height:calc(100vh - 70px); overflow-y:auto; container-type:inline-size; }\n        .lp-ptx-days.is-prev-folded{ grid-template-columns:34px minmax(0, 1fr) minmax(200px, 260px); }\n        .lp-ptx-days.is-next-folded{ grid-template-columns:minmax(200px, 260px) minmax(0, 1fr) 34px; }\n        .lp-ptx-days.is-prev-folded.is-next-folded{ grid-template-columns:34px minmax(0, 1fr) 34px; }\n        .lp-ptx-side-top{ display:flex; align-items:flex-start; gap:4px; }\n        .lp-ptx-side-top .lp-hpx-side-head{ flex:1; min-width:0; }\n        .lp-ptx-fold{ flex:none; width:22px; height:22px; display:inline-grid; place-items:center; font:inherit; font-size:15px; line-height:1; font-weight:700; color:var(--text-600); background:transparent; border:0; border-radius:6px; cursor:pointer; padding:0; }\n        .lp-ptx-fold:hover{ background:var(--surface); color:inherit; }\n        .lp-ptx-fold:focus-visible{ outline:2px solid var(--life-blue, #245edb); outline-offset:1px; }\n        .lp-ptx-side.is-folded{ padding:6px 0; align-items:center; gap:6px; min-height:120px; }\n        .lp-ptx-side-strip{ display:flex; flex-direction:column; align-items:center; gap:8px; font:inherit; background:transparent; border:0; color:inherit; cursor:pointer; padding:2px 0; }\n        .lp-ptx-side-vlabel{ writing-mode:vertical-rl; font-size:12.5px; font-weight:700; white-space:nowrap; }\n        .lp-ptx-side.is-folded .lp-hpx-count{ font-size:11px; }\n        .lp-ptx-empty{ padding:18px 4px; }\n        .lp-ptx-legend{ display:flex; flex-wrap:wrap; gap:4px 14px; font-size:11.5px; color:var(--text-600); margin:0 0 4px 2px; }\n        .lp-ptx-legend span{ display:inline-flex; align-items:center; gap:5px; }\n        .lp-ptx-legend i{ width:10px; height:10px; border-radius:3px; background:color-mix(in srgb, var(--c) 18%, var(--surface)); box-shadow:inset 0 0 0 1.5px var(--c); }\n        .lp-ptx-legend i.is-late{ background:var(--surface); box-shadow:inset 0 0 0 1.5px #dc2626; }\n        .lp-ptx-groupby{ flex:none; font:inherit; font-size:12px; font-weight:600; border:1px solid var(--border); border-radius:8px; padding:3px 6px; background:var(--surface); color:var(--text-900); }\n        .lp-ptx-month-empty{ height:8px; }\n        /* Jalon = pixel rond ; t\u00e2che avec dur\u00e9e = pixel carr\u00e9. */\n        .lp-ptx-px.is-milestone{ border-radius:50%; }\n        .lp-ptx-legend-shape i{ background:var(--paper-soft); box-shadow:inset 0 0 0 1.5px var(--text-600); }\n        .lp-ptx-legend-shape i.is-milestone{ border-radius:50%; }\n        /* Packages de cases : blocs teint\u00e9s par la couleur de leur cl\u00e9. */\n        .lp-ptx-pack{ position:relative; display:inline-flex; align-items:center; border-radius:8px; }\n        /* Packages actifs : la rang\u00e9e perd son cadre commun, chaque package\n           devient un conteneur distinct, cadr\u00e9 et teint\u00e9 \u00e0 sa couleur. */\n        .lp-hpx-pixels.lp-ptx-packed{ background:transparent; border-color:transparent; }\n        .lp-ptx-pack.is-tinted{ background:color-mix(in srgb, var(--pc) 10%, var(--surface)); border:1px solid color-mix(in srgb, var(--pc) 60%, var(--surface)); border-radius:10px; box-shadow:0 1px 2px rgba(15,23,42,.08); }\n        /* Fant\u00f4mes : t\u00e2ches en cours ce jour-l\u00e0, en gris pointill\u00e9, hors score. */\n        .lp-ptx-px.is-ghost{ background:transparent !important; box-shadow:none !important; outline:1.5px dashed var(--text-600); outline-offset:-2px; opacity:.55; color:var(--text-600); }\n        .lp-ptx-pack.is-tinted.is-ghost{ background:transparent; border:1.5px dashed var(--border-strong, #b9c7d8); box-shadow:none; }\n        .lp-ptx-ghost-row .lp-ptx-title, .lp-ptx-ghost-row .lp-ptx-badge{ color:var(--text-600); font-style:italic; opacity:.8; }\n        .lp-ptx-ghost-row .lp-hpx-check{ opacity:.6; }\n        .lp-hpx-wire.lp-ptx-ghost-wire{ stroke:var(--text-600); stroke-dasharray:3 3; stroke-opacity:.45; }\n        .lp-ptx-badge.is-ghost{ border:1px dashed var(--border-strong, #b9c7d8); border-radius:999px; padding:0 6px; }\n        .lp-ptx-ghost-count{ font-weight:500; font-style:italic; }\n        /* En-t\u00eate de groupe sur une seule ligne : l'indice \u00ab N t\u00e2ches \u00bb c\u00e8de\n           d'abord, puis le nom (points de suspension), jamais les compteurs. */\n        .lp-ptx-group-head{ white-space:nowrap; min-width:0; }\n        .lp-ptx-group-head > *{ flex:none; }\n        .lp-ptx-group-head > .lp-ptx-group-name{ flex:0 1 auto; min-width:0; overflow:hidden; text-overflow:ellipsis; }\n        .lp-ptx-group-head > .lp-hpx-theme-hint{ flex:0 1000 auto; min-width:0; overflow:hidden; text-overflow:ellipsis; }\n        .lp-ptx-ghost-toggle{ flex:none; display:inline-flex; align-items:center; gap:5px; font-size:12px; font-weight:600; color:var(--text-600); border:1px dashed var(--border-strong, #b9c7d8); border-radius:8px; padding:3px 8px; cursor:pointer; white-space:nowrap; }\n        .lp-ptx-ghost-toggle.is-on{ color:var(--text-900); border-style:solid; background:var(--paper-soft); }\n        .lp-ptx-ghost-toggle input{ margin:0; }\n        .lp-ptx-base-toggle{ border-style:solid; }\n        /* Termin\u00e9es masqu\u00e9es : bouton marqu\u00e9 tant que le filtre est actif. */\n        .lp-ptx-done-toggle{ white-space:nowrap; }\n        .lp-ptx-done-toggle.is-on{ color:var(--text-900); background:var(--paper-soft); border-color:var(--border-strong, #b9c7d8); }\n        /* Ajout rapide (#557) : \u00ab + T\u00e2che \u00bb \u00e0 droite de l'en-t\u00eate, bulle de saisie. */\n        .lp-ptx-head-wrap{ display:flex; align-items:center; gap:2px; }\n        .lp-ptx-head-wrap > .lp-hpx-theme-head{ flex:1 1 auto; width:auto; min-width:0; overflow:hidden; }\n        .lp-ptx-add{ flex:none; width:22px; height:22px; display:inline-grid; place-items:center; color:#4338ca; background:var(--surface); border:1px solid #c7d2fe; border-radius:7px; padding:0; cursor:pointer; opacity:.4; transition:opacity .12s; }\n        .lp-ptx-head-wrap:hover .lp-ptx-add, .lp-ptx-add:focus-visible, .lp-ptx-add.is-on{ opacity:1; }\n        .lp-ptx-add:hover, .lp-ptx-add.is-on{ background:#eef2ff; }\n        .lp-ptx-quickadd{ position:absolute; z-index:45; width:380px; background:var(--surface); border:2px solid #6366f1; border-radius:12px; box-shadow:0 12px 32px rgba(15,23,42,.18); padding:9px 10px; display:flex; flex-direction:column; gap:6px; }\n        .lp-ptx-quickadd-head{ display:flex; align-items:center; gap:5px; font-size:12px; color:var(--text-600); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }\n        .lp-ptx-quickadd input{ width:100%; }\n        .lp-ptx-quickadd-hint{ font-size:11.5px; color:var(--text-600); min-height:15px; }\n        /* Glisser-d\u00e9poser (#558). */\n        .lp-hpx-row[draggable=\"true\"]{ cursor:grab; }\n        .lp-hpx-side.is-drop, .lp-hpx-week-day.is-drop{ outline:2px dashed #6366f1; outline-offset:-2px; background:#eef2ff; }\n        .lp-ptx-drop-hint{ font-size:12px; font-weight:700; color:#4338ca; text-align:center; padding:4px 0; }\n        /* Menu d'actions (#559). */\n        .lp-ptx-more{ flex:none; width:20px; height:18px; display:inline-grid; place-items:center; font:inherit; font-size:14px; line-height:1; color:var(--text-600); background:transparent; border:1px solid transparent; border-radius:5px; padding:0; cursor:pointer; opacity:0; }\n        .lp-hpx-row:hover .lp-ptx-more, .lp-hpx-row.is-menu .lp-ptx-more, .lp-ptx-more:focus-visible, .lp-ptx-band-card:hover .lp-ptx-more{ opacity:1; }\n        .lp-ptx-more:hover{ background:var(--paper-soft); border-color:var(--border); }\n        .lp-ptx-menu{ width:250px; max-height:calc(100vh - 16px); overflow:auto; }\n        .lp-ptx-menu hr{ border:0; border-top:1px solid var(--border); margin:4px 2px; }\n        .lp-ptx-menu .lp-quick-context-item{ padding:6px 9px; }\n        .lp-ptx-menu .lp-quick-context-item.is-active{ background:#eef2ff; color:#3730a3; }\n        .lp-ptx-menu-title{ font-size:11.5px; font-weight:700; color:var(--text-600); padding:4px 9px 6px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }\n        .lp-ptx-menu-icon{ width:18px; flex:none; text-align:center; }\n        .lp-ptx-menu-label{ flex:1; min-width:0; }\n        .lp-ptx-menu-hint{ flex:none; font-size:11.5px; font-weight:600; color:var(--text-600); }\n        .lp-ptx-menu-dot{ display:inline-block; width:10px; height:10px; border-radius:3px; }\n        .lp-ptx-menu-date{ display:flex; gap:6px; padding:6px 4px; }\n        .lp-ptx-menu-date input{ flex:1; min-width:0; }\n        /* Bandeau \u00ab Mes 3 du jour \u00bb (#560). */\n        .lp-ptx-band{ display:flex; flex-wrap:wrap; gap:10px; margin:6px 0 10px; }\n        .lp-ptx-band-card{ flex:1 1 220px; min-width:0; display:flex; flex-direction:column; gap:4px; border:2px solid #f59e0b; background:#fffbeb; border-radius:12px; padding:9px 11px; cursor:grab; }\n        .lp-ptx-band-card.is-late{ border-color:#ef4444; background:#fef2f2; }\n        .lp-ptx-band-card.is-done{ border-color:#10b981; background:#ecfdf5; }\n        .lp-ptx-band-meta{ font-size:11.5px; color:var(--text-600); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }\n        .lp-ptx-band-title{ font:inherit; font-size:14px; font-weight:750; color:#1f2937; text-align:left; background:none; border:0; padding:0; cursor:pointer; line-height:1.25; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }\n        .lp-ptx-band-foot{ display:flex; align-items:center; gap:6px; min-height:20px; }\n        .lp-ptx-band-progress{ flex:0 1 140px; height:6px; border-radius:3px; background:#fde68a; overflow:hidden; }\n        .lp-ptx-band-progress b{ display:block; height:100%; background:#f59e0b; border-radius:3px; }\n        .lp-ptx-band-more{ align-self:center; font-size:12px; }\n        /* Jauge de charge (#561). */\n        .lp-ptx-est{ flex:none; font-size:11px; font-weight:650; color:var(--text-600); border:1px solid var(--border); border-radius:999px; padding:0 6px; white-space:nowrap; }\n        .lp-ptx-load{ border:1px solid var(--border); border-radius:12px; padding:9px 12px; margin:4px 0 10px; display:flex; flex-direction:column; gap:6px; }\n        .lp-ptx-load-top{ display:flex; justify-content:space-between; gap:10px; font-size:13px; flex-wrap:wrap; }\n        .lp-ptx-load-top span{ font-weight:700; }\n        .lp-ptx-load-bar{ position:relative; display:flex; height:14px; border-radius:7px; overflow:hidden; background:var(--paper-soft); }\n        .lp-ptx-load-bar > span{ height:100%; flex:none; }\n        .lp-ptx-load-over{ position:absolute; top:0; bottom:0; background:repeating-linear-gradient(45deg, rgba(239,68,68,.55) 0 5px, rgba(254,226,226,.55) 5px 10px); }\n        .lp-ptx-load-cap{ position:absolute; top:-2px; bottom:-2px; width:2px; background:#b91c1c; }\n        .lp-ptx-load-legend{ display:flex; flex-wrap:wrap; align-items:center; gap:4px 14px; font-size:11.5px; }\n        .lp-ptx-load-legend i{ display:inline-block; width:9px; height:9px; border-radius:3px; margin-right:4px; vertical-align:-1px; }\n        /* Capacit\u00e9 par jour (#565). */\n        .lp-ptx-cap{ width:300px; padding:6px 8px 8px; }\n        .lp-ptx-cap-row{ display:flex; align-items:center; justify-content:space-between; gap:8px; font-size:12.5px; padding:3px 2px; }\n        .lp-ptx-cap-row select{ width:150px; padding:3px 6px; font-size:12.5px; }\n        .lp-ptx-cap-row.is-current span{ font-weight:750; color:#3730a3; }\n        .lp-ptx-cap-row.is-day{ flex-direction:column; align-items:stretch; gap:4px; padding-bottom:8px; border-bottom:1px solid var(--border); margin-bottom:4px; }\n        .lp-ptx-cap-row.is-day select{ width:100%; }\n        .lp-ptx-cap-sub{ font-size:11.5px; font-weight:700; color:var(--text-600); padding:4px 2px 2px; }\n        .lp-ptx-cap-hint{ font-size:11.5px; color:var(--text-600); padding:8px 2px 0; line-height:1.35; }\n        /* Cl\u00f4ture de la journ\u00e9e (#562). */\n        .lp-ptx-closure-top{ display:flex; justify-content:flex-end; font-size:12.5px; color:var(--text-600); }\n        .lp-ptx-closure-bar{ height:6px; border-radius:3px; background:var(--paper-soft); margin:6px 0 12px; overflow:hidden; }\n        .lp-ptx-closure-bar span{ display:block; height:100%; background:#6366f1; border-radius:3px; transition:width .2s; }\n        .lp-ptx-closure-card{ display:flex; flex-wrap:wrap; align-items:center; gap:10px; border:2px solid #6366f1; border-radius:12px; padding:12px; }\n        .lp-ptx-closure-what{ flex:1 1 220px; min-width:0; display:flex; flex-direction:column; gap:2px; }\n        .lp-ptx-closure-what b{ font-size:14px; }\n        .lp-ptx-closure-actions{ display:flex; flex-wrap:wrap; gap:6px; align-items:center; }\n        .lp-ptx-closure-do{ color:#047857; border-color:#a7f3d0; background:#ecfdf5; }\n        .lp-ptx-closure-next{ color:#3730a3; border-color:#a5b4fc; background:#eef2ff; }\n        .lp-ptx-closure-ok{ font-size:12px; font-weight:700; color:#047857; }\n        .lp-ptx-closure-pick{ flex-basis:100%; display:flex; gap:6px; }\n        .lp-ptx-closure-end{ text-align:center; font-weight:700; color:#047857; padding:16px 0; }\n        .lp-ptx-closure-log{ list-style:none; margin:12px 0 0; padding:0; display:flex; flex-direction:column; gap:4px; font-size:12.5px; color:var(--text-600); max-height:180px; overflow:auto; }\n        /* Filtres \u00e9clair (#563). */\n        .lp-ptx-filters{ display:flex; flex-wrap:wrap; align-items:center; gap:6px; margin:2px 0 8px; }\n        .lp-ptx-search{ display:inline-flex; align-items:center; gap:6px; border:1px solid var(--border-strong, #b9c7d8); border-radius:8px; padding:3px 8px; background:var(--surface); color:var(--text-600); flex:0 1 240px; min-width:140px; }\n        .lp-ptx-search input{ border:0; outline:0; background:transparent; font:inherit; font-size:12.5px; color:var(--text-900); flex:1; min-width:0; padding:1px 0; }\n        .lp-ptx-search button{ border:0; background:none; padding:0; cursor:pointer; color:var(--text-600); display:inline-grid; }\n        .lp-ptx-chip{ font:inherit; font-size:12px; font-weight:650; color:var(--text-600); background:var(--surface); border:1px solid var(--border-strong, #b9c7d8); border-radius:999px; padding:3px 10px; cursor:pointer; white-space:nowrap; }\n        .lp-ptx-chip b{ font-weight:800; margin-left:2px; }\n        .lp-ptx-chip.is-on{ color:#3730a3; border-color:#6366f1; background:#eef2ff; }\n        .lp-ptx-chip.is-late.is-on{ color:#b91c1c; border-color:#ef4444; background:#fef2f2; }\n        .lp-ptx-chip.is-focus.is-on{ color:#92400e; border-color:#f59e0b; background:#fffbeb; }\n        .lp-ptx-filter-count{ font-size:12px; margin-left:auto; }\n        /* Futur : cases plates \u00e0 bord d\u00e9grad\u00e9 (indigo \u2192 cyan \u2192 violet), J+N. */\n        .lp-ptx-px.is-horizon{ background:linear-gradient(var(--surface), var(--surface)) padding-box, linear-gradient(120deg, #6366f1, #06b6d4 55%, #a855f7) border-box !important; border:2px solid transparent; box-shadow:none !important; color:#4338ca; }\n        .lp-ptx-px.is-horizon{ box-sizing:border-box; }\n        .lp-ptx-px.is-horizon .lp-ptx-ring-outline{ inset:-2px; width:calc(100% + 4px); height:calc(100% + 4px); }\n        .lp-ptx-px-j{ font-size:9.5px; font-weight:800; letter-spacing:-.2px; color:#4338ca; }\n        .lp-ptx-pack.is-tinted.is-horizon{ position:relative; background:linear-gradient(color-mix(in srgb, #6366f1 5%, var(--surface)), color-mix(in srgb, #6366f1 5%, var(--surface))) padding-box, linear-gradient(120deg, #6366f1, #06b6d4 55%, #a855f7) border-box; border:1.5px solid transparent; box-shadow:none; }\n        .lp-ptx-pack.is-tinted.is-horizon::after{ content:\"\"; position:absolute; right:-8px; top:50%; transform:translateY(-50%); border-left:6px solid #a855f7; border-top:4px solid transparent; border-bottom:4px solid transparent; opacity:.7; }\n        .lp-ptx-future-row .lp-ptx-title{ color:#4338ca; }\n        .lp-ptx-future-row .lp-hpx-check{ border-style:dotted; border-color:#a5b4fc; }\n        .lp-hpx-wire.lp-ptx-future-wire{ stroke-dasharray:1 4; stroke-linecap:round; stroke-width:2; stroke-opacity:.85; }\n        .lp-ptx-badge.is-horizon{ color:#4338ca; background:linear-gradient(90deg, #eef2ff, #ecfeff); border:1px solid #c7d2fe; border-radius:999px; padding:0 7px; }\n        .lp-ptx-future-count{ font-size:11.5px; font-weight:650; background:linear-gradient(90deg, #6366f1, #06b6d4); -webkit-background-clip:text; background-clip:text; color:transparent; }\n        .lp-ptx-future-select.is-on{ border-color:#a5b4fc; color:#4338ca; }\n        .lp-ptx-legend-shape i.is-progress{ background:var(--paper-soft); box-shadow:inset 0 0 0 1.5px color-mix(in srgb, var(--text-600) 40%, transparent); border-top:1.5px solid var(--text-900); border-right:1.5px solid var(--text-900); box-sizing:border-box; }\n        .lp-ptx-legend-shape i.is-ghost{ background:transparent; box-shadow:none; outline:1.5px dashed var(--text-600); outline-offset:-2px; }\n        .lp-ptx-legend-shape i.is-horizon{ background:linear-gradient(var(--surface), var(--surface)) padding-box, linear-gradient(120deg, #6366f1, #06b6d4, #a855f7) border-box; border:2px solid transparent; box-shadow:none; box-sizing:border-box; }\n        /* Focus : petit \u25ce devant le titre, une com\u00e8te lumineuse qui fait le\n           tour du bord de la case en changeant de couleur, et deux \u00e9toiles qui\n           scintillent aux coins. Chaque case part d'un point diff\u00e9rent\n           (d\u00e9lais n\u00e9gatifs pos\u00e9s par TaskPixel). Masqu\u00e9 si le mouvement est r\u00e9duit. */\n        .lp-ptx-spark-wrap{ position:absolute; inset:0; pointer-events:none; color:#f59e0b; animation:lp-ptx-spark-hue 7.2s linear infinite; animation-delay:var(--ptx-hue-delay, 0s); }\n        .lp-ptx-px.is-horizon .lp-ptx-spark-wrap{ inset:-2px; }\n        .lp-ptx-spark{ position:absolute; inset:0; width:100%; height:100%; overflow:visible; }\n        .lp-ptx-spark path{ fill:none; stroke:currentColor; stroke-linecap:round; animation:lp-ptx-spark-run 3.6s linear infinite; animation-delay:var(--ptx-spark-delay, 0s); }\n        .lp-ptx-spark-trail{ stroke-width:3.5; stroke-dasharray:28 72; stroke-opacity:.45; filter:drop-shadow(0 0 2px currentColor); }\n        .lp-ptx-spark-head{ stroke-width:3; stroke-dasharray:5 95; stroke-dashoffset:-23; filter:drop-shadow(0 0 3px currentColor) drop-shadow(0 0 6px currentColor); }\n        .lp-ptx-spark path.lp-ptx-spark-head{ animation-name:lp-ptx-spark-run-head; }\n        @keyframes lp-ptx-spark-run{ from{ stroke-dashoffset:0; } to{ stroke-dashoffset:-100; } }\n        @keyframes lp-ptx-spark-run-head{ from{ stroke-dashoffset:-23; } to{ stroke-dashoffset:-123; } }\n        @keyframes lp-ptx-spark-hue{ 0%,100%{ color:#f59e0b; } 25%{ color:#ec4899; } 50%{ color:#06b6d4; } 75%{ color:#8b5cf6; } }\n        .lp-ptx-star{ position:absolute; width:10px; height:10px; overflow:visible; filter:drop-shadow(0 0 2px currentColor); transform:scale(0); animation:lp-ptx-star-twinkle 2.6s ease-in-out infinite; animation-delay:var(--ptx-star-delay, 0s); }\n        .lp-ptx-star path{ fill:#fff; stroke:currentColor; stroke-width:1; }\n        .lp-ptx-star.is-tr{ top:-5px; right:-5px; }\n        .lp-ptx-star.is-bl{ bottom:-4px; left:-4px; width:7px; height:7px; animation-delay:calc(var(--ptx-star-delay, 0s) - 1.3s); }\n        @keyframes lp-ptx-star-twinkle{ 0%,55%,100%{ transform:scale(0) rotate(0deg); opacity:0; } 70%{ transform:scale(1.15) rotate(45deg); opacity:1; } 85%{ transform:scale(.7) rotate(90deg); opacity:.8; } }\n        .lp-ptx-flag-row .lp-ptx-title::before{ content:\"\u25ce\"; color:#d97706; margin-right:5px; font-weight:800; }\n        .lp-ptx-legend-shape i.is-flagged{ background:transparent; box-shadow:none; width:auto; height:auto; font-style:normal; color:#d97706; font-weight:800; line-height:1; }\n        .lp-ptx-legend-shape i.is-flagged::before{ content:\"\u25ce\"; }\n        @media (prefers-reduced-motion: reduce){ .lp-ptx-spark-wrap{ display:none; } }\n        /* Sous-groupes \u00ab Rameaux \u00bb (#546) : tronc \u00e0 la couleur du groupe,\n           rameaux en d\u00e9grad\u00e9 vers chaque sous-groupe, bourgeon qui se remplit\n           puis \u00e9cl\u00f4t, ruban spectral dans l'en-t\u00eate du groupe. */\n        .lp-ptx-tree{ position:relative; }\n        .lp-ptx-tree-svg{ position:absolute; left:0; top:0; overflow:visible; pointer-events:none; z-index:2; }\n        .lp-ptx-trunk{ fill:none; stroke-width:2.5; stroke-linecap:round; stroke-opacity:.6; }\n        .lp-ptx-rameau{ fill:none; stroke-width:2; stroke-linecap:round; }\n        .lp-ptx-sub-head{ padding-left:37px; font-size:12.5px; font-weight:650; gap:7px; }\n        .lp-ptx-sub-head .lp-ptx-sub-chevron{ color:var(--text-600); opacity:.7; }\n        .lp-ptx-sub .lp-hpx-row{ padding-left:52px; }\n        /* Fil des t\u00e2ches d'un sous-groupe : pointill\u00e9 sous le bourgeon, un\n           n\u0153ud par t\u00e2che (plein = termin\u00e9e, estomp\u00e9 = fant\u00f4me ou futur). */\n        .lp-ptx-thread-line{ fill:none; stroke:var(--bc); stroke-width:1.3; stroke-dasharray:1 3.5; stroke-linecap:round; stroke-opacity:.55; }\n        .lp-ptx-knot{ fill:var(--surface); stroke:var(--bc); stroke-width:1.3; transition:r .15s ease; }\n        .lp-ptx-knot.is-on{ fill:var(--bc); }\n        .lp-ptx-knot.is-soft{ stroke-dasharray:1.5 1.5; stroke-opacity:.6; }\n        .lp-ptx-knot.is-focus{ r:3.2px; stroke-width:1.8; }\n        .lp-ptx-thread.is-focus .lp-ptx-thread-line{ stroke-opacity:.95; }\n        .lp-ptx-sub-select.is-on{ border-color:color-mix(in srgb, #16a34a 45%, var(--border)); color:#15803d; }\n        .lp-ptx-bud{ flex:none; overflow:visible; transform-origin:50% 50%; }\n        .lp-ptx-bud-track{ fill:var(--surface); stroke:color-mix(in srgb, var(--bc) 32%, var(--surface)); stroke-width:2.2; }\n        .lp-ptx-bud.is-empty .lp-ptx-bud-track{ stroke-dasharray:2 2; stroke:var(--border-strong, #b9c7d8); }\n        .lp-ptx-bud-arc{ fill:none; stroke:var(--bc); stroke-width:2.4; stroke-linecap:round; transition:stroke-dasharray .25s ease; }\n        .lp-ptx-bud-core{ fill:color-mix(in srgb, var(--bc) 55%, var(--surface)); }\n        .lp-ptx-bud-flower ellipse{ fill:var(--bc); fill-opacity:.88; stroke:var(--surface); stroke-width:.6; }\n        .lp-ptx-bud-heart{ fill:#fde68a; stroke:#f59e0b; stroke-width:.8; }\n        .lp-ptx-bud.is-bloom{ animation:lp-ptx-bloom .55s cubic-bezier(.34,1.56,.64,1) both, lp-ptx-bloom-halo 3.2s ease-in-out .55s infinite; }\n        @keyframes lp-ptx-bloom{ from{ transform:scale(.35) rotate(-50deg); opacity:.3; } to{ transform:scale(1) rotate(0deg); opacity:1; } }\n        @keyframes lp-ptx-bloom-halo{ 0%,100%{ filter:drop-shadow(0 0 1.5px color-mix(in srgb, var(--bc) 55%, transparent)); } 50%{ filter:drop-shadow(0 0 5px color-mix(in srgb, var(--bc) 75%, transparent)); } }\n        .lp-ptx-spectrum{ display:inline-flex; width:84px; height:8px; gap:2px; border-radius:99px; overflow:hidden; }\n        /* En-t\u00eate d'arbre : le nom garde au moins quelques lettres, le ruban\n           c\u00e8de ensuite (jusqu'\u00e0 28 px), jamais les compteurs. */\n        .lp-ptx-group-head > .lp-ptx-spectrum{ flex:0 4 84px; min-width:28px; width:auto; }\n        .lp-ptx-tree .lp-ptx-group-head > .lp-ptx-group-name{ min-width:3.5em; }\n        .lp-ptx-spectrum i{ position:relative; flex:1 1 0; min-width:4px; background:color-mix(in srgb, var(--sc) 26%, var(--surface)); }\n        .lp-ptx-spectrum b{ position:absolute; left:0; top:0; bottom:0; background:var(--sc); }\n        @media (prefers-reduced-motion: reduce){ .lp-ptx-bud.is-bloom{ animation:none; filter:drop-shadow(0 0 3px color-mix(in srgb, var(--bc) 60%, transparent)); } .lp-ptx-bud-arc{ transition:none; } }\n        /* Anneau de progression. */\n        .lp-ptx{ position:relative; }\n        .lp-ptx-ring{ position:absolute; z-index:40; width:240px; background:var(--surface); border:1px solid var(--border); border-radius:14px; box-shadow:0 12px 32px rgba(15,23,42,.18); padding:12px; display:flex; flex-direction:column; align-items:center; gap:8px; }\n        .lp-ptx-ring-title{ font-size:12.5px; font-weight:700; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; align-self:stretch; text-align:center; }\n        .lp-ptx-ring-svg{ cursor:pointer; touch-action:none; outline:none; border-radius:50%; }\n        .lp-ptx-ring-svg:focus-visible{ box-shadow:0 0 0 2px var(--life-blue, #245edb); }\n        .lp-ptx-ring-track{ fill:none; stroke:var(--paper-soft); stroke-width:12; }\n        .lp-ptx-ring-bar{ fill:none; stroke:var(--c); stroke-width:12; stroke-linecap:round; transition:stroke-dashoffset .12s ease; }\n        .lp-ptx-ring-knob{ fill:var(--surface); stroke:var(--c); stroke-width:3; }\n        .lp-ptx-ring-value{ font-size:20px; font-weight:800; fill:var(--text-900); }\n        .lp-ptx-ring-steps{ display:flex; gap:4px; }\n        .lp-ptx-ring-steps button{ font:inherit; font-size:11.5px; font-weight:650; border:1px solid var(--border); background:var(--surface); color:var(--text-900); border-radius:999px; padding:2px 8px; cursor:pointer; }\n        .lp-ptx-ring-steps button.is-on{ background:var(--c); border-color:var(--c); color:#fff; }\n        .lp-ptx-ring-hint{ font-size:11.5px; color:var(--text-600); text-align:center; }\n        .lp-ptx-ring-actions{ display:flex; gap:6px; align-self:stretch; align-items:center; }\n        /* Vues Semaine et Mois (#353) : carr\u00e9s journaliers. */\n        .lp-hpx-views{ flex:none; }\n        .lp-hpx-weekview{ display:grid; grid-template-columns:repeat(7, minmax(0, 1fr)); gap:10px; }\n        .lp-hpx-weekview-day{ display:flex; flex-direction:column; align-items:center; gap:10px; font:inherit; color:inherit; background:var(--surface); border:1px solid var(--border); border-radius:14px; padding:12px 8px; cursor:pointer; min-width:0; }\n        .lp-hpx-weekview-day:hover{ border-color:var(--border-strong, #b9c7d8); }\n        .lp-hpx-weekview-day:focus-visible, .lp-hpx-monthview-day:focus-visible{ outline:2px solid var(--life-blue, #245edb); outline-offset:2px; }\n        .lp-hpx-weekview-day.is-today{ border-color:var(--life-blue, #245edb); box-shadow:0 0 0 2px color-mix(in srgb, var(--life-blue, #245edb) 18%, transparent); }\n        .lp-hpx-weekview-head{ display:flex; flex-direction:column; align-items:center; }\n        .lp-hpx-weekview-head b{ font-size:13px; text-transform:capitalize; }\n        .lp-hpx-weekview-head span{ font-size:11.5px; color:var(--text-600); }\n        .lp-hpx-weekview-bar{ width:80%; height:5px; border-radius:99px; background:var(--paper-soft); overflow:hidden; }\n        .lp-hpx-weekview-bar span{ display:block; height:100%; background:var(--life-blue, #245edb); }\n        .lp-hpx-monthview{ display:grid; grid-template-columns:repeat(7, minmax(0, 1fr)); gap:6px; }\n        .lp-hpx-monthview-dow{ text-align:center; font-size:11px; font-weight:700; color:var(--text-600); }\n        .lp-hpx-monthview-day{ position:relative; display:flex; flex-direction:column; align-items:center; gap:4px; font:inherit; color:inherit; background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:18px 4px 6px; cursor:pointer; min-width:0; }\n        .lp-hpx-monthview-day:hover{ border-color:var(--border-strong, #b9c7d8); }\n        .lp-hpx-monthview-day.is-out{ opacity:.45; }\n        .lp-hpx-monthview-day.is-today{ border-color:var(--life-blue, #245edb); box-shadow:0 0 0 2px color-mix(in srgb, var(--life-blue, #245edb) 18%, transparent); }\n        .lp-hpx-monthview-num{ position:absolute; top:3px; left:7px; font-size:11px; font-weight:750; }\n        @container (max-width: 700px){\n          .lp-hpx-weekview{ grid-template-columns:repeat(auto-fill, minmax(120px, 1fr)); }\n          .lp-hpx-monthview-day .lp-hpx-muted{ display:none; }\n        }\n        /* Petites largeurs : Hier / Demain repli\u00e9s (le bandeau de la semaine\n           y m\u00e8ne), puis liaisons remplac\u00e9es par un pixel en t\u00eate de ligne. */\n        @container (max-width: 980px){\n          .lp-hpx-days, .lp-ptx-days.is-prev-folded, .lp-ptx-days.is-next-folded, .lp-ptx-days.is-prev-folded.is-next-folded{ grid-template-columns:minmax(0, 1fr); }\n          .lp-hpx-side{ display:none; }\n        }\n        @container (max-width: 620px){\n          .lp-hpx-theme{ height:auto !important; }\n          .lp-hpx-list{ width:100%; }\n          .lp-hpx-wires, .lp-hpx-anchor{ display:none; }\n          .lp-hpx-row{ padding-left:4px; }\n          .lp-hpx-row > .lp-hpx-px{ display:inline-grid; }\n          .lp-ptx-tree-svg{ display:none; }\n          .lp-ptx-sub-head{ padding-left:18px; }\n          .lp-ptx-sub .lp-hpx-row{ padding-left:18px; }\n          .lp-hpx-na-btn{ opacity:1; }\n          .lp-hpx-summary-text{ display:none; }\n          .lp-hpx-week{ grid-template-columns:repeat(7, minmax(44px, 1fr)); overflow-x:auto; }\n          .lp-hpx-week-day .lp-hpx-mosaic{ display:none; }\n        }";

export { WidgetPixelTasks, makePixelTaskUndoable, pixelTaskUpdateLabel, pixelTaskDoneLabel, makePixelTaskCreator, pixelTasksForDay, pixelTaskDate, isTaskDoneGlobal, PIXEL_TASKS_CSS };
