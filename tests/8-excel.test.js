/**
 * TEST 8 — EXPORTS EXCEL
 * ----------------------
 * Garantie visée : les fichiers Excel (semaine et bilan annuel) restent identiques à ceux de la 0.10,
 * alors que la bibliothèque ExcelJS n'est plus chargée au démarrage mais à la demande.
 *
 * Les deux versions exportent le même contenu ; chaque fichier est relu case par case (valeur, format
 * de nombre, gras) et les deux relectures doivent être égales.
 *
 * Ce test a besoin de la bibliothèque ExcelJS installée par « npm install » (elle est servie aux pages à la
 * place du CDN, et sert aussi à relire les fichiers). Si elle n'est pas installée, le test est sauté.
 */
"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { preparer, ecarts } = require("./outils/banc.js");
const { jeux } = require("./outils/donnees.js");
const { EXCEL_LOCAL } = require("./outils/navigateur.js");

const SAUTE = EXCEL_LOCAL ? false : "bibliothèque ExcelJS non installée (npm install)";

/** Clique sur le premier élément visible correspondant. */
const clic = (page, selecteur) => page.locator(selecteur).locator("visible=true").first().click();

/**
 * Déclenche un export et relit le fichier produit.
 * @param {import("playwright").Page} page
 * @param {() => Promise<void>} declencher  Geste qui lance l'export.
 * @returns {Promise<{nom:string, feuilles:object[]}>} Nom du fichier et, par feuille, la liste des cases remplies.
 */
async function exporter(page, declencher) {
  const ExcelJS = require("exceljs");
  const [fichier] = await Promise.all([page.waitForEvent("download"), declencher()]);
  const classeur = new ExcelJS.Workbook();
  await classeur.xlsx.load(fs.readFileSync(await fichier.path()));
  const feuilles = [];
  classeur.eachSheet((feuille) => {
    const cases = [];
    feuille.eachRow({ includeEmpty: false }, (ligne) => {
      ligne.eachCell({ includeEmpty: false }, (c) => {
        cases.push([c.address, c.value == null ? null : JSON.parse(JSON.stringify(c.value)), c.numFmt || "", !!(c.font && c.font.bold)]);
      });
    });
    feuilles.push({ nom: feuille.name, cases });
  });
  return { nom: fichier.suggestedFilename(), feuilles };
}

let banc;
before(async () => { banc = await preparer(); });
after(async () => { await banc.fermer(); });

for (const jeu of jeux()) {
  /** Exige l'égalité ; pour les vraies données, n'affiche que l'emplacement des écarts. */
  const memeFichier = (obtenu, attendu) => {
    if (jeu.nom === "inventé") assert.deepStrictEqual(obtenu, attendu);
    else assert.deepStrictEqual(ecarts(attendu, obtenu), [], "écarts avec la 0.10 (valeurs masquées)");
  };

  test(`[${jeu.nom}] export Excel de la semaine identique à la 0.10`, { skip: SAUTE }, async () => {
    const o = { donnees: jeu.donnees, ecran: "pc" };
    const [ref, app] = await Promise.all([banc.ouvrirRef(o), banc.ouvrirApp(o)]);
    const semaine = Object.keys(jeu.donnees.weeks).includes("2026-W41") ? "2026-W41" : Object.keys(jeu.donnees.weeks)[0];
    const resultats = [];
    for (const page of [ref, app]) {
      // Ouverture de la semaine par la vue année, comme un utilisateur.
      await clic(page, '[data-act="year"]');
      await clic(page, `.yw[data-k="${semaine}"]`);
      resultats.push(await exporter(page, () => clic(page, '[data-act="export"]')));
    }
    assert.ok(resultats[0].feuilles[0].cases.length > 40, "le fichier de référence est bien rempli");
    memeFichier(resultats[1], resultats[0]);
    assert.deepStrictEqual(app.erreursFH, []);
    await Promise.all([ref.context().close(), app.context().close()]);
  });

  test(`[${jeu.nom}] export Excel du bilan identique à la 0.10`, { skip: SAUTE }, async () => {
    const o = { donnees: jeu.donnees, ecran: "pc" };
    const [ref, app] = await Promise.all([banc.ouvrirRef(o), banc.ouvrirApp(o)]);
    const resultats = [];
    for (const page of [ref, app]) {
      await clic(page, '[data-act="tab"][data-t="bilan"]');
      resultats.push(await exporter(page, () => clic(page, '[data-act="bexport"]')));
    }
    assert.match(resultats[0].nom, /^bilan-heures-2026\.xlsx$/);
    memeFichier(resultats[1], resultats[0]);
    await Promise.all([ref.context().close(), app.context().close()]);
  });
}

test("au démarrage, la bibliothèque Excel ne bloque plus l'affichage", async () => {
  const jeu = jeux()[0];
  const app = await banc.ouvrirApp({ donnees: jeu.donnees });
  // L'appli est affichée, et la bibliothèque n'est pas encore là (elle arrive en tâche de fond 4 s plus tard).
  await app.locator('[data-act="tab"]').first().waitFor();
  assert.equal(await app.evaluate(() => typeof ExcelJS), "undefined");
  assert.equal(await app.locator('script[src*="exceljs"]').count(), 0, "plus de balise ExcelJS dans la page au démarrage");
  await app.context().close();
});
