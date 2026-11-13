/**
 * TEST 9 — SYNCHRONISATION AVEC LE GOOGLE SHEET
 * ---------------------------------------------
 * Garanties visées (sur un faux Sheet qui applique les règles de Code.gs, voir outils/faux-sheet.js) :
 *   - une saisie part vers le Sheet, et une modification faite sur un autre appareil arrive ici ;
 *   - pendant une coupure réseau rien n'est perdu : la saisie reste « en attente » et part au retour du réseau ;
 *   - quand une version d'ici est remplacée par une version plus récente d'un autre appareil, la version
 *     d'ici est gardée dans les sauvegardes et un bandeau le dit (nouveauté 1.0).
 */
"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { preparer } = require("./outils/banc.js");
const { MAINTENANT } = require("./outils/navigateur.js");
const { creerFauxSheet, API, CODE } = require("./outils/faux-sheet.js");
const jeu = require("./donnees/jeu-invente.js");

const CLE = "feuille-heures-v1", CLE_SYNCHRO = "feuille-heures-sync", CLE_SAUVEGARDES = "feuille-heures-snapshots";
const T0 = MAINTENANT.getTime();
/** État de synchro d'un appareil déjà connecté et à jour. */
const synchro = (plus = {}) => JSON.stringify(Object.assign({ api: API, cle: CODE, meta: {}, dirty: {}, last: T0 }, plus));
const lire = (page, cle) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), cle);
const clic = (page, selecteur) => page.locator(selecteur).locator("visible=true").first().click();
/** Déclenche un échange, comme quand l'appli revient au premier plan. */
const revenirAuPremierPlan = (page) => page.evaluate(() => { document.dispatchEvent(new Event("visibilitychange")); });

let banc;
before(async () => { banc = await preparer(); });
after(async () => { await banc.fermer(); });

test("une saisie est envoyée au Sheet", async () => {
  const sheet = creerFauxSheet(T0);
  const page = await banc.ouvrirApp({ donnees: jeu.donnees, brut: { [CLE_SYNCHRO]: synchro() }, avant: sheet.brancher });
  await clic(page, '[data-act="fill"][data-id="m3"]'); // remplit la semaine 46
  await page.waitForFunction(() => Object.keys(JSON.parse(localStorage.getItem("feuille-heures-sync")).dirty).length === 0 && JSON.parse(localStorage.getItem("feuille-heures-sync")).lastOk);
  await assert.doesNotReject(async () => { for (let i = 0; i < 50 && !sheet.lignes.has("w:2026-W46"); i++) await page.waitForTimeout(100); });
  assert.equal(sheet.lignes.get("w:2026-W46").d.days[0].type, "sch:m3");
  assert.equal((await lire(page, CLE_SYNCHRO)).err, "");
  await page.context().close();
});

test("une modification faite sur un autre appareil est reçue", async () => {
  const sheet = creerFauxSheet(T0);
  const page = await banc.ouvrirApp({ donnees: jeu.donnees, brut: { [CLE_SYNCHRO]: synchro() }, avant: sheet.brancher });
  await page.locator('[data-act="tab"]').first().waitFor();
  // Un autre appareil vient de poser la semaine 48 en congés.
  const conges = { days: [{ type: "cp", x: {} }, { type: "cp", x: {} }, { type: "cp", x: {} }, { type: "cp", x: {} }, { type: "cp", x: {} }, null, null], obs: "", note: "Posée sur le PC", validated: false };
  sheet.poser("w:2026-W48", T0 + 60000, conges);
  await revenirAuPremierPlan(page);
  await page.waitForFunction(() => { const w = JSON.parse(localStorage.getItem("feuille-heures-v1")).weeks["2026-W48"]; return w && w.note === "Posée sur le PC"; });
  assert.equal((await lire(page, CLE)).weeks["2026-W48"].days[4].type, "cp");
  assert.equal(await page.getByText("remplacée").count(), 0, "une simple réception n'est pas un remplacement : pas de bandeau");
  await page.context().close();
});

test("coupure réseau : la saisie reste en attente, puis part au retour du réseau", async () => {
  const sheet = creerFauxSheet(T0);
  const page = await banc.ouvrirApp({ donnees: jeu.donnees, brut: { [CLE_SYNCHRO]: synchro() }, avant: sheet.brancher });
  await page.locator('[data-act="tab"]').first().waitFor();
  sheet.couper(true);
  await clic(page, '[data-act="fill"][data-id="m3"]');
  // L'envoi échoue : erreur notée, modification toujours en attente, et rien n'est arrivé au Sheet.
  await page.waitForFunction(() => !!JSON.parse(localStorage.getItem("feuille-heures-sync")).err);
  assert.ok((await lire(page, CLE_SYNCHRO)).dirty["w:2026-W46"], "la semaine reste marquée « à envoyer »");
  // (Le Sheet connaît déjà la semaine 46 — son férié prérempli au démarrage — mais pas la saisie faite pendant la coupure.)
  const avant = sheet.lignes.get("w:2026-W46");
  assert.ok(!avant || !avant.d.days[0] || avant.d.days[0].type !== "sch:m3", "la saisie n'est pas arrivée au Sheet");
  // La saisie, elle, est bien enregistrée sur l'appareil.
  assert.equal((await lire(page, CLE)).weeks["2026-W46"].days[0].type, "sch:m3");
  // Même après un rechargement de la page pendant la coupure, elle est toujours en attente.
  await page.reload();
  await page.locator('[data-act="tab"]').first().waitFor();
  assert.ok((await lire(page, CLE_SYNCHRO)).dirty["w:2026-W46"]);

  sheet.couper(false);
  await page.evaluate(() => { window.dispatchEvent(new Event("online")); });
  await page.waitForFunction(() => { const s = JSON.parse(localStorage.getItem("feuille-heures-sync")); return !s.err && !Object.keys(s.dirty).length; });
  assert.equal(sheet.lignes.get("w:2026-W46").d.days[0].type, "sch:m3");
  await page.context().close();
});

test("version d'ici remplacée par un autre appareil : gardée dans les sauvegardes, et signalée", async () => {
  const sheet = creerFauxSheet(T0);
  // Le Sheet a une semaine 37 plus récente (heure T0+5000) que la modification en attente ici (T0+1000).
  const autre = { days: [{ type: "cp", x: {} }, null, null, null, null, null, null], obs: "", note: "Version du PC", validated: false };
  sheet.poser("w:2026-W37", T0 + 5000, autre);
  const brut = { [CLE_SYNCHRO]: synchro({ meta: { "w:2026-W37": T0 + 1000 }, dirty: { "w:2026-W37": 1 } }) };
  const page = await banc.ouvrirApp({ donnees: jeu.donnees, brut, avant: sheet.brancher });
  await page.getByText("Semaine 37 remplacée.").waitFor();
  // La version du Sheet est en place…
  assert.equal((await lire(page, CLE)).weeks["2026-W37"].note, "Version du PC");
  // …et celle d'ici est dans une sauvegarde.
  const sauvegardes = await lire(page, CLE_SAUVEGARDES);
  const s = sauvegardes.find((x) => x.label === "Avant remplacement par un autre appareil");
  assert.ok(s, "une sauvegarde a été créée avant le remplacement");
  assert.equal(s.data.weeks["2026-W37"].days[0].type, "sch:s3", "elle contient bien la version d'ici");
  // « Voir les sauvegardes » y mène et ferme le bandeau.
  await clic(page, '[data-act="remplvoir"]');
  await page.getByText("Avant remplacement par un autre appareil").first().waitFor();
  assert.equal(await page.getByText("Semaine 37 remplacée.").count(), 0);
  assert.deepStrictEqual(page.erreursFH, []);
  await page.context().close();
});

test("mauvais code d'accès : erreur affichée, rien n'est perdu", async () => {
  const sheet = creerFauxSheet(T0);
  const brut = { [CLE_SYNCHRO]: JSON.stringify({ api: API, cle: "MAUVAISCODE", meta: {}, dirty: {}, last: T0 }) };
  const page = await banc.ouvrirApp({ donnees: jeu.donnees, brut, avant: sheet.brancher });
  await page.waitForFunction(() => /Code d'accès incorrect/.test(JSON.parse(localStorage.getItem("feuille-heures-sync")).err || ""));
  assert.equal(Object.keys((await lire(page, CLE)).weeks).length >= Object.keys(jeu.donnees.weeks).length, true);
  await page.context().close();
});
