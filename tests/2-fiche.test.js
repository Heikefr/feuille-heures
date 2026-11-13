/**
 * TEST 2 — FICHE ENVOYÉE AU SERVICE PAYE
 * --------------------------------------
 * Garantie visée : « la fiche envoyée reste identique pixel pour pixel ».
 *
 * Pour chaque semaine de chaque jeu de données, la fiche est dessinée par la version 0.10 figée
 * et par la version en cours, dans le même navigateur, aux quatre tailles d'envoi
 * (Petite 0,9 · Moyenne 1,2 · Grande 1,5 · Très grande 2, qui est aussi la taille de l'aperçu).
 * On compare le texte de chaque case, puis l'empreinte de tous les pixels de l'image.
 *
 * Pourquoi comparer à la 0.10 dans le même navigateur plutôt qu'à des images enregistrées :
 * la fiche utilise les polices de l'appareil (Times New Roman, Arial). Une image enregistrée
 * sur une machine ne serait jamais identique sur une autre ; deux dessins faits côte à côte, si.
 *
 * En cas d'échec, les deux images sont rangées dans tests/resultats pour voir la différence.
 */
"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { preparer, garder, ecarts, peutGarder, dataUrlVersBuffer } = require("./outils/banc.js");
const { jeux } = require("./outils/donnees.js");
const { sondeFiches, imageFiche } = require("./outils/sondes.js");

/** Échelles de dessin contrôlées (voir FT dans l'appli). */
const ECHELLES = [0.9, 1.2, 1.5, 2];

let banc;
before(async () => { banc = await preparer(); });
after(async () => { await banc.fermer(); });

for (const jeu of jeux()) {
  test(`[${jeu.nom}] fiches identiques à la 0.10, pixel pour pixel`, async () => {
    const [ref, app] = await Promise.all([banc.ouvrirRef({ donnees: jeu.donnees }), banc.ouvrirApp({ donnees: jeu.donnees })]);
    const [a, b] = await Promise.all([ref.evaluate(sondeFiches, { echelles: ECHELLES }), app.evaluate(sondeFiches, { echelles: ECHELLES })]);
    const differences = [];
    for (const k of Object.keys(a)) {
      // 1. Le contenu des cases.
      // (vraies données : on n'affiche que l'emplacement de l'écart, jamais le nom ni le matricule)
      if (jeu.nom === "inventé") assert.deepStrictEqual(b[k] && b[k].contenu, a[k].contenu, `contenu de la fiche ${k}`);
      else assert.deepStrictEqual(ecarts(a[k].contenu, b[k] && b[k].contenu), [], `contenu de la fiche ${k} (valeurs masquées)`);
      // 2. Les pixels.
      for (const sc of ECHELLES) {
        if (b[k].empreintes[sc] === a[k].empreintes[sc]) continue;
        differences.push(`${k} à l'échelle ${sc}`);
        if (!peutGarder(jeu)) continue;
        const p = { semaine: k, echelle: sc };
        garder(`fiche-${jeu.nom}-${k}-x${sc}-reference.png`, dataUrlVersBuffer(await ref.evaluate(imageFiche, p)));
        garder(`fiche-${jeu.nom}-${k}-x${sc}-actuelle.png`, dataUrlVersBuffer(await app.evaluate(imageFiche, p)));
      }
    }
    assert.deepStrictEqual(differences, [], "fiches dont l'image a changé (voir tests/resultats)");
    await Promise.all([ref.context().close(), app.context().close()]);
  });
}
