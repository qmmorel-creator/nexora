# Extrait TEL QUEL de nexora-project (apps/nexora/source) les fonctions et
# composants des graphiques financiers (Sankey mensuel, Sankey patrimoine,
# Budget cumulé par mois) vers src/nexora/finance-nexora.jsx — Ref #690.
# Décision de Quentin : ces graphiques gardent exactement l'esthétique de
# Nexora. Relancer ce script pour resynchroniser ; ne jamais modifier le
# fichier généré à la main.
#   python3 scripts/extraire-nexora.py   (depuis apps/nexora-future-optim)
import pathlib, subprocess
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
