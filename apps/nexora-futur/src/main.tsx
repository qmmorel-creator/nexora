import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./theme/polices";
import { feuilleJetons } from "./theme/jetons";
import { appliquerApparence, lireApparence } from "./theme/apparence";
import { App } from "./App";
import "./style.css";
import "./cockpit/cockpit.css";
import "./cockpit/fil.css";
import "./cockpit/vues.css";
import "./cockpit/corps.css";
import "./cockpit/triage.css";
import "./cockpit/atlas.css";
import "./cockpit/phrase.css";
import "./cockpit/reglages.css";

// Jetons et préférences appliqués avant le premier rendu (pas de flash de thème).
const style = document.createElement("style");
style.id = "jetons";
style.textContent = feuilleJetons();
document.head.prepend(style);
appliquerApparence(lireApparence());

createRoot(document.getElementById("racine")!).render(<StrictMode><App /></StrictMode>);
