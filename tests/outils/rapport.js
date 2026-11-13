/**
 * RAPPORT D'ÉCHEC POUR GITHUB
 * ---------------------------
 * Lit la sortie des tests (fichier donné en argument) et, pour chaque test échoué, écrit une « annotation »
 * GitHub : elle apparaît sur la page de l'exécution, sans avoir à ouvrir le journal complet.
 * Un résumé est aussi ajouté à la page (GITHUB_STEP_SUMMARY).
 *
 * Rien de personnel n'est recopié : pour les vraies données, les tests n'écrivent que l'emplacement
 * des écarts, jamais les valeurs (voir banc.js › ecarts).
 *
 * Utilisation : node tests/outils/rapport.js sortie-des-tests.txt
 */
"use strict";
const fs = require("node:fs");

const lignes = fs.readFileSync(process.argv[2], "utf8").split("\n");
const echecs = [];
let courant = null;
for (const l of lignes) {
  const debut = l.match(/^(not ok|ok) \d+ - (.*)$/);
  if (debut) {
    courant = debut[1] === "not ok" ? { nom: debut[2], detail: [] } : null;
    if (courant) echecs.push(courant);
    continue;
  }
  // On garde le message d'erreur et la comparaison, pas la pile d'appels ni les durées.
  if (courant && l.trim() && !/^\s+(duration_ms|type|location|failureType|code|name|operator|stack|\.\.\.|---)\b/.test(l) && !/^\s+at /.test(l) && !/node:internal/.test(l)) {
    courant.detail.push(l.replace(/^\s{2,6}/, ""));
  }
}

/** Échappe un texte pour une commande d'annotation GitHub (une seule ligne). */
const echapper = (t) => t.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");

let resume = echecs.length ? `### ${echecs.length} test(s) échoué(s)\n` : "### Tous les tests passent\n";
for (const e of echecs.slice(0, 10)) {
  const detail = e.detail.join("\n").slice(0, 1800);
  console.log(`::error title=${echapper("Test échoué : " + e.nom).replace(/,/g, "%2C").replace(/::/g, ": :")}::${echapper(detail || "(pas de détail)")}`);
  resume += `\n**${e.nom}**\n\n\`\`\`\n${detail}\n\`\`\`\n`;
}
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, resume);
