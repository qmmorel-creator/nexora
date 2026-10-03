import { ecouterCle } from "./firebase";
import { modifierCle } from "./ecriture-firebase";
import type { Source } from "./source";

export const sourceFirebase: Source = { ecouter: ecouterCle, modifier: modifierCle };
