/* POINT D'ENTRÉE — charge tous les modules puis démarre l'appli.
   L'ordre des imports n'a pas d'importance pour le fonctionnement : chaque module déclare ce dont il a besoin. */
import { weekCalc } from "./calculs.js";
import { counters, soldeCalc } from "./compteurs.js";
import { S, BUILD } from "./etat.js";
import { ficheData, ficheCanvas } from "./fiche.js";
import { parseCompta, compareCompta, parseSoldes, compareSoldes } from "./compta.js";
import { bilanData } from "./ecran-bilan.js";
import { boot } from "./ecran-rendu.js";
import "./actions.js";

/* Accès réservé aux tests automatiques (tests/outils/sondes.js) : ils rappellent ces fonctions
   pour comparer leurs résultats à ceux de la version 0.10. L'appli elle-même ne s'en sert pas. */
window.__fh = { S, BUILD, weekCalc, counters, soldeCalc, bilanData, parseCompta, compareCompta, parseSoldes, compareSoldes, ficheData, ficheCanvas };

boot();
