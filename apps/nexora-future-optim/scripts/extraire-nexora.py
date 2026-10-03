# Extrait TEL QUEL de nexora-project (apps/nexora/source) les fonctions et
# composants des graphiques financiers (Sankey mensuel, Sankey patrimoine,
# Budget cumulé par mois) vers src/nexora/finance-nexora.jsx — Ref #690.
# Décision de Quentin : ces graphiques gardent exactement l'esthétique de
# Nexora. Relancer ce script pour resynchroniser ; ne jamais modifier le
# fichier généré à la main.
#   python3 scripts/extraire-nexora.py   (depuis apps/nexora-future-optim)
import json, pathlib, re, subprocess
RACINE = pathlib.Path(__file__).resolve().parents[3]
SOURCES = {p: (RACINE / "apps/nexora/source" / p).read_text(encoding="utf-8") for p in ["index.html.part-001", "index.html.part-002", "index.html.part-003"]}
SHA = subprocess.run(["git", "-C", str(RACINE), "log", "-1", "--format=%h", "--", "apps/nexora/source"], capture_output=True, text=True).stdout.strip()

def bloc(part, debut):
    src = SOURCES[part]
    i = src.index("\n" + debut) + 1
    ligne = src.count("\n", 0, i) + 1
    fin_ligne = src.index("\n", i)
    tete = src[i:fin_ligne]
    if debut.startswith("function"):
        k = src.index("{", src.index(")", i))
        prof = 0
        for p in range(k, len(src)):
            if src[p] == "{": prof += 1
            elif src[p] == "}":
                prof -= 1
                if prof == 0: return ligne, src[i:p + 1]
    if tete.rstrip().endswith("`"):
        return ligne, src[i:src.index("`;", src.index("`", i) + 1) + 2]
    if tete.rstrip().endswith("= ["):
        return ligne, src[i:src.index("];", i) + 2]
    if tete.rstrip().endswith("= {"):
        return ligne, src[i:src.index("};", i) + 2]
    return ligne, src[i:src.index(";\n", i) + 1]

P3 = "index.html.part-003"
ELEMENTS = [
  ("index.html.part-002", "function WidgetPointerTooltip("),
  (P3, "const FINANCE_SANKEY_INCOME_PALETTE"), (P3, "const FINANCE_SANKEY_DEFAULT_CONFIG"),
  (P3, "function financeSankeyText("), (P3, "function financeSankeyNumber("), (P3, "function financeSankeyColor("),
  (P3, "function financeSankeyIsDate("), (P3, "function financeSankeyAddDays("), (P3, "function financeSankeyToday("),
  (P3, "function financeSankeyQuickPeriod("), (P3, "function financeSankeyPeriod("), (P3, "function financeSankeyDateLabel("), (P3, "function financeSankeyRound("), (P3, "function financeSankeyFormat("),
  (P3, "function financeSankeyNormalize("), (P3, "function financeSankeyPeriodTransactions("), (P3, "function financeSankeyAccountBalances("),
  (P3, "const financeSankeySum"), (P3, "function financeSankeyMonthlyGraph("), (P3, "function financeSankeyWealthGraph("), (P3, "function financeSankeyBuild("),
  (P3, "function financeSankeyOrderNodes("), (P3, "function financeSankeyLayout("),
  (P3, "let financeSankeyCanvas"), (P3, "function financeSankeyMeasure("), (P3, "function financeSankeyTruncate("),
  (P3, "const FINANCE_SANKEY_SVG_CSS"), (P3, "const FINANCE_SANKEY_CSS"), (P3, "function FinanceSankeyChart("),
  (P3, "function financeBudgetEuro("), (P3, "function financeChartTicks("), (P3, "function financeChartShortEuro("), (P3, "const FINANCE_BUDGET_CHART_CSS"),
  (P3, "const FINANCE_CUMUL_PALETTE"), (P3, "const FINANCE_CUMUL_OTHER"), (P3, "const FINANCE_CUMUL_INK"),
  (P3, "function financeCumulRound("), (P3, "function financeCumulModel("), (P3, "function financeCumulSpread("),
  (P3, "const FINANCE_BUDGET_CUMUL_CSS"), (P3, "function financeCumulFrame("),
  (P3, "const FINANCE_CUMUL_REF"), (P3, "const FINANCE_CUMUL_MIN_H"), (P3, "const FINANCE_CUMUL_MIN_W"), (P3, "function financeCumulPlotSize("),
  (P3, "function FinanceCumulPlot("), (P3, "function financeCumulPath("), (P3, "function financeCumulDayLabel("),
  (P3, "function FinanceCumulAxes("), (P3, "function FinanceCumulHit("), (P3, "function FinanceCumulTip("), (P3, "function FinanceCumulLegend("),
  (P3, "function FinanceCumulEndLabels("), (P3, "function FinanceCumulRefLines("), (P3, "function FinanceCumulCategories("),
]
EXPORTS = ["financeSankeyBuild", "FinanceSankeyChart", "FinanceCumulCategories", "financeSankeyNormalize", "financeSankeyPeriodTransactions", "financeSankeyMonthlyGraph", "financeSankeyWealthGraph", "financeCumulModel", "financeBudgetEuro", "financeChartTicks", "financeChartShortEuro", "FINANCE_SANKEY_DEFAULT_CONFIG", "FINANCE_SANKEY_CSS", "FINANCE_BUDGET_CHART_CSS", "FINANCE_BUDGET_CUMUL_CSS", "WidgetPointerTooltip"]

sortie = [
  "/* eslint-disable */",
  "// @ts-nocheck",
  "// Fichier GÉNÉRÉ par scripts/extraire-nexora.py — NE PAS MODIFIER À LA MAIN (Ref #690).",
  f"// Code repris tel quel de apps/nexora/source (dernier commit du dossier : {SHA}) : graphiques",
  "// Sankey et « Budget cumulé par mois » de Nexora, pour en garder exactement l'esthétique.",
  'import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";',
  'import { createPortal } from "react-dom";',
  "",
]
# Adaptations documentées (seules différences avec Nexora), appliquées au code extrait.
# (#690, retour du 03/10/2026) : période libre jusqu'à une année. Au-delà de 62 jours,
# l'axe du budget cumulé montre le mois au 1er jour au lieu de 365 numéros de jour.
ADAPTATIONS = [(
  '<line x1={f.x(k)} x2={f.x(k)} y1={f.H - f.B} y2={f.H - f.B + 3} stroke={I.axis} />\n          <text x={f.x(k)} y={f.H - f.B + 13} textAnchor="middle" style={{ fontSize: f.days.length > 31 ? 7 : 8.5 }}>{Number(d.slice(8))}</text>',
  '{(f.days.length <= 62 || d.slice(8) === "01") && <line x1={f.x(k)} x2={f.x(k)} y1={f.H - f.B} y2={f.H - f.B + 3} stroke={I.axis} />}\n          <text x={f.x(k)} y={f.H - f.B + 13} textAnchor={f.days.length > 62 ? "start" : "middle"} style={{ fontSize: f.days.length > 31 ? 7 : 8.5 }}>{f.days.length > 62 ? (d.slice(8) === "01" ? ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."][Number(d.slice(5, 7)) - 1] : "") : Number(d.slice(8))}</text>',
)]
for part, debut in ELEMENTS:
    ligne, code = bloc(part, debut)
    for avant, apres in ADAPTATIONS:
        if avant in code: code = code.replace(avant, apres); sortie.append("// ADAPTÉ pour Optim : voir ADAPTATIONS dans scripts/extraire-nexora.py")
    sortie.append(f"// — {part}, ligne {ligne}")
    sortie.append(code)
sortie.append("")
sortie.append("export { " + ", ".join(EXPORTS) + " };")
cible = pathlib.Path(__file__).resolve().parents[1] / "src/nexora/finance-nexora.jsx"
cible.write_text("\n".join(sortie) + "\n", encoding="utf-8")
print("écrit", cible, len(ELEMENTS), "éléments")

# Calculs budgétaires de Nexora (lib/finance-budget.mjs), copiés tels quels :
# suivi et cumul d'une période libre avec exactement les règles de Nexora.
lib = (RACINE / "apps/nexora/lib/finance-budget.mjs").read_text(encoding="utf-8")
SHA_LIB = subprocess.run(["git", "-C", str(RACINE), "log", "-1", "--format=%h", "--", "apps/nexora/lib/finance-budget.mjs"], capture_output=True, text=True).stdout.strip()
cible2 = pathlib.Path(__file__).resolve().parents[1] / "src/nexora/finance-budget.mjs"
cible2.write_text("/* eslint-disable */\n// @ts-nocheck\n// Fichier GÉNÉRÉ par scripts/extraire-nexora.py — NE PAS MODIFIER À LA MAIN (Ref #690).\n" + f"// Copie de apps/nexora/lib/finance-budget.mjs (commit {SHA_LIB}).\n" + lib, encoding="utf-8")
print("écrit", cible2)

# Comparaison des photos corporelles (retour du 03/10/2026) : bloc pur
# NEXORA:BODY-PHOTOS (alignement, rognage, dates) et composants d'affichage
# repris tels quels. Le chargement des images passe par photos-adaptateur.tsx
# (relais corps d'Optim, lecture seule) au lieu de l'API de nexora-project.
src3 = SOURCES[P3]
debut_pur = src3.index("// === NEXORA:BODY-PHOTOS:START ===")
fin_pur = src3.index("// === NEXORA:BODY-PHOTOS:END ===") + len("// === NEXORA:BODY-PHOTOS:END ===")
ELEMENTS_PHOTOS = [(P3, "const BODY_PHOTO_CSS"), (P3, "const BODY_PHOTO_COLORS"), (P3, "function useBodyPhotoFrame("), (P3, "function BodyPhotoMarks("),
  (P3, "function BodyPhotoCompare("), (P3, "const BODY_PHOTO_CROP_HANDLES"), (P3, "function BodyPhotoCrop(")]
photos = [
  "/* eslint-disable */",
  "// @ts-nocheck",
  "// Fichier GÉNÉRÉ par scripts/extraire-nexora.py — NE PAS MODIFIER À LA MAIN (retour du 03/10/2026).",
  f"// Comparaison des photos corporelles de Nexora (dernier commit du dossier source : {SHA}), reprise telle quelle.",
  'import React, { useEffect, useMemo, useRef, useState } from "react";',
  'import { useBodyPhotoUrl } from "./photos-adaptateur";',
  "",
  f"// — {P3}, ligne {src3.count(chr(10), 0, debut_pur) + 1}",
  src3[debut_pur:fin_pur],
]
for part, debut in ELEMENTS_PHOTOS:
    ligne, code = bloc(part, debut)
    photos.append(f"// — {part}, ligne {ligne}")
    photos.append(code)
photos.append("")
photos.append("export { BODY_PHOTO_CSS, bodyPhotoSpec, bodyPhotoSorted, bodyPhotoRightPhoto, bodyPhotoAlignment, bodyPhotoFormatDate, bodyPhotoDeltaLabel, bodyPhotoNormalizeCrop, BodyPhotoCompare, BodyPhotoCrop };")
cible3 = pathlib.Path(__file__).resolve().parents[1] / "src/nexora/photos-nexora.jsx"
cible3.write_text("\n".join(photos) + "\n", encoding="utf-8")
print("écrit", cible3)

# Pixel Tasks, « Tâches du jour » (retour du 03/10/2026) : module de Nexora
# repris tel quel — bloc pur NEXORA:PIXEL-TASKS (part-002), interface
# (part-003, de « Pixel des tâches » à WidgetHabitHeatmap exclu), utilitaires
# de dates, de statuts et du Pixel des habitudes dont il dépend, et ses styles
# (GlobalStyles de part-001), variables de thème résolues et limitées à
# .nx-ptx-scope. Modal et icônes : voir pixel-tasks-adaptateur.tsx.
P0, P1, P2 = "index.html.part-000", "index.html.part-001", "index.html.part-002"
for p in (P0,):
    SOURCES[p] = (RACINE / "apps/nexora/source" / p).read_text(encoding="utf-8")
def entre(part, debut, fin):
    s = SOURCES[part]; i = s.index(debut); j = s.index(fin, i) + len(fin)
    return s.count("\n", 0, i) + 1, s[i:j]
def jusqua(part, debut, avant):
    s = SOURCES[part]; i = s.index(debut); j = s.index(avant, i)
    return s.count("\n", 0, i) + 1, s[i:j].rstrip()
ptx = [
  "/* eslint-disable */",
  "// @ts-nocheck",
  "// Fichier GÉNÉRÉ par scripts/extraire-nexora.py — NE PAS MODIFIER À LA MAIN (retour du 03/10/2026).",
  f"// Module « Pixel Tasks » (Tâches du jour) de Nexora (dernier commit du dossier source : {SHA}), repris tel quel.",
  'import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";',
  'import { createPortal } from "react-dom";',
  'import { Check, CheckCircle2, ChevronLeft, ChevronRight, ChevronsDown, ChevronsUp, Eye, EyeOff, Filter, Plus, Search, X, Grid3x3 } from "lucide-react";',
  'import { Modal } from "./pixel-tasks-adaptateur";',
  "",
]
morceaux = [
  entre(P0, "// === NEXORA:DATE-UTILS:START ===", "// === NEXORA:DATE-UTILS:END ==="),
  bloc(P0, "const uid ="),
  jusqua(P0, "const isProtectedStatus =", "\nconst getStatusesForProject ="),
  jusqua(P0, "const getStatusesForProject =", "\nconst getDefaultStatusForProject ="),
  jusqua(P0, "const getDefaultStatusForProject =", "\n// ===="),
  bloc(P0, "const isLockedTaskType ="),
  jusqua(P0, "const getTaskTypesForProject =", "\nconst restrictedStatusForType ="),
  jusqua(P0, "const restrictedStatusForType =", "\nconst FIELD_DEFS"),
  bloc(P0, "function isTaskFocus("),
  bloc(P0, "function isTaskDoneGlobal("),
  bloc(P1, "function ViewToolbarPortal("),
  bloc(P2, "function habitPixelWirePath("),
  jusqua(P3, "const HPX_HEAD_H", "\nconst HPX_STATE_LABELS"),
  bloc(P3, "function hpxDayLabel("), bloc(P3, "function hpxLongDate("), bloc(P3, "function hpxSubDate("), bloc(P3, "function hpxWeekStart("),
  bloc(P3, "const HPX_VIEWS"), bloc(P3, "function hpxAddMonths("),
  entre(P2, "// === NEXORA:PIXEL-TASKS:START ===", "// === NEXORA:PIXEL-TASKS:END ==="),
]
s3 = SOURCES[P3]; d_ui = s3.index("\n", s3.rindex("\n", 0, s3.index("function ptxStatusColor(")) - 1)
d_ui = s3.rindex("\n/*", 0, s3.index("function ptxStatusColor(")) + 1
morceaux.append((s3.count("\n", 0, d_ui) + 1, s3[d_ui:s3.index("\nfunction WidgetHabitHeatmap(")].rstrip()))
for ligne, code in morceaux:
    ptx.append(f"// — ligne {ligne}")
    ptx.append(code)

# Styles : plages Pixel Tasks + règles génériques utilisées, variables résolues.
s1 = SOURCES[P1]; g = s1.index("function GlobalStyles()"); a = s1.index("<style>{`", g) + 9; b = s1.index("`}</style>", a)
css_glob = s1[a:b]
lignes1 = s1.split("\n")
def plage(debut, fin): return "\n".join(lignes1[debut - 1:fin])
i0 = next(k for k, l in enumerate(lignes1) if "/* Pixel des habitudes (#353)" in l) + 1
i1 = next(k for k, l in enumerate(lignes1) if k > i0 and "/* Glisser-peindre (#353)" in l)
morceau_ptx = plage(i0, i1)
entete = "\n".join(l for l in lignes1[g:g + 9000] if ":has(.lp-ptx-groupby)" in l)
def regles(texte):
    out, prof, debut = [], 0, 0
    for k, ch in enumerate(texte):
        if ch == "{":
            if prof == 0: debut_sel = debut
            prof += 1
        elif ch == "}":
            prof -= 1
            if prof == 0: out.append(texte[debut:k + 1].strip()); debut = k + 1
        elif ch == "\n" and prof == 0 and not texte[debut:k].strip(): debut = k + 1
    return out
GENERIQUES = re.compile(r"\.(lp-overlay|lp-modal[\w-]*|lp-btn[\w-]*|lp-input|lp-icon-btn|lp-tool-btn|lp-quick-context-menu[\w-]*|lp-empty|lp-density-btn|lp-density-row|lp-widget-head-toolbar)(?![\w-])")
gen = [r for r in regles(re.sub(r"/\*.*?\*/", "", css_glob, flags=re.S)) if not r.startswith("@") and GENERIQUES.search(r.split("{", 1)[0]) and "data-nexora-theme" not in r.split("{", 1)[0] and "data-theme" not in r.split("{", 1)[0]]
css_ptx = entete + "\n" + "\n".join(gen) + "\n" + morceau_ptx
jetons = {}
for m in re.finditer(r"(?<![\w-])(--[\w-]+)\s*:\s*([^;{}]+);", css_glob):
    jetons.setdefault(m.group(1), m.group(2).strip())
DYNAMIQUES = {"--c", "--tc", "--pc", "--bc", "--sc", "--hpx-rows", "--ptx-spark-delay", "--ptx-hue-delay", "--ptx-star-delay"}
a_definir, file = {}, set(re.findall(r"var\((--[\w-]+)", css_ptx)) - DYNAMIQUES
while file:
    v = file.pop()
    if v in a_definir or v not in jetons: continue
    a_definir[v] = jetons[v]; file |= set(re.findall(r"var\((--[\w-]+)", jetons[v])) - DYNAMIQUES
# Portée : le module et ses fenêtres ouvertes par portail dans <body> (menus, capacité, clôture).
scope = ".nx-ptx-scope,body>.lp-quick-context-menu,body>.lp-overlay{" + ";".join(f"{k}:{v}" for k, v in sorted(a_definir.items())) + "}"
ptx.append("// Styles de Nexora (GlobalStyles, part-001) utilisés par le module, et jetons de thème résolus.")
ptx.append("const PIXEL_TASKS_CSS = " + json.dumps(scope + "\n" + css_ptx) + ";")
ptx.append("")
ptx.append("export { WidgetPixelTasks, makePixelTaskUndoable, pixelTaskUpdateLabel, pixelTaskDoneLabel, makePixelTaskCreator, pixelTasksForDay, pixelTaskDate, isTaskDoneGlobal, PIXEL_TASKS_CSS };")
cible4 = pathlib.Path(__file__).resolve().parents[1] / "src/nexora/pixel-tasks-nexora.jsx"
cible4.write_text("\n".join(ptx) + "\n", encoding="utf-8")
print("écrit", cible4, len(a_definir), "jetons")
