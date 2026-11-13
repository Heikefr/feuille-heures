/**
 * TEST 10 — AJOUTS DE LA 1.0 (hors mode secours, mise à jour et synchro, testés ailleurs)
 * ---------------------------------------------------------------------------------------
 *   - alerte quand les observations ne tiennent pas sur la fiche (6 lignes) ;
 *   - thème et taille de la fiche propres à chaque appareil : ils ne touchent plus aux réglages synchronisés.
 */
"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { preparer } = require("./outils/banc.js");
const jeu = require("./donnees/jeu-invente.js");

const CLE = "feuille-heures-v1", CLE_APPAREIL = "feuille-heures-appareil", CLE_SYNCHRO = "feuille-heures-sync";
const lire = (page, cle) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), cle);
const clic = (page, selecteur) => page.locator(selecteur).locator("visible=true").first().click();
const allerSemaine = async (page, cle) => { await clic(page, '[data-act="year"]'); await clic(page, `.yw[data-k="${cle}"]`); };

let banc;
before(async () => { banc = await preparer(); });
after(async () => { await banc.fermer(); });

for (const ecran of ["iphone", "pc"]) {
  test(`observations trop longues : alerte sur l'écran d'envoi (${ecran})`, async () => {
    // Semaine 43 : 8 lignes d'observation saisies, la fiche n'en montre que 6. Elle est remise en brouillon pour ce test.
    const donnees = JSON.parse(JSON.stringify(jeu.donnees));
    donnees.weeks["2026-W43"].validated = false;
    const page = await banc.ouvrirApp({ donnees, ecran });
    await allerSemaine(page, "2026-W43");
    await clic(page, '[data-act="sendopen"]');
    await page.getByText("2 lignes d'observation ne tiennent pas sur la fiche").waitFor();
    // « Raccourcir » ramène à la saisie, curseur dans l'observation.
    await clic(page, '[data-act="obsfix"]');
    assert.equal(await page.locator(".sendov").count(), 0, "l'écran d'envoi est fermé");
    assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.dataset.act), "obs");
    // Semaine 37 : pas d'observation, pas d'alerte.
    await allerSemaine(page, "2026-W37");
    await clic(page, '[data-act="sendopen"]');
    await page.locator(".sendov").waitFor();
    assert.equal(await page.getByText("ne tiennent pas sur la fiche").count(), 0);
    assert.deepStrictEqual(page.erreursFH, []);
    await page.context().close();
  });
}

test("observations trop longues sur une semaine déjà envoyée : alerte sans bouton « Raccourcir »", async () => {
  const page = await banc.ouvrirApp({ donnees: jeu.donnees });
  await allerSemaine(page, "2026-W43");
  await clic(page, '[data-act="sendopen"]');
  await page.getByText("2 lignes d'observation ne tiennent pas sur la fiche").waitFor();
  assert.equal(await page.locator('[data-act="obsfix"]').count(), 0, "une semaine envoyée ne se modifie plus");
  await page.context().close();
});

test("thème : propre à l'appareil, sans toucher aux réglages synchronisés", async () => {
  // L'appareil arrive de la 0.10 avec le thème sombre dans ses réglages.
  const page = await banc.ouvrirApp({ donnees: jeu.donnees, theme: "dark" });
  const theme = () => page.evaluate(() => document.documentElement.getAttribute("data-theme"));
  assert.equal(await theme(), "dark", "l'ancien réglage est repris tant que l'appareil n'a rien choisi");
  await clic(page, '[data-act="tab"][data-t="set"]');
  await clic(page, '[data-act="setp"][data-p="aff"]');
  await page.locator("#s-theme").selectOption("light");
  assert.equal(await theme(), "light");
  await page.waitForTimeout(500);
  assert.equal((await lire(page, CLE_APPAREIL)).theme, "light");
  assert.equal((await lire(page, CLE)).settings.theme, "dark", "les réglages synchronisés ne sont pas modifiés");
  const synchro = await lire(page, CLE_SYNCHRO);
  assert.ok(!synchro || !synchro.dirty || !synchro.dirty.settings, "rien n'est marqué « à envoyer »");
  // Le choix tient après rechargement, dès le premier affichage.
  await page.reload();
  assert.equal(await theme(), "light");
  await page.context().close();
});

test("taille de la fiche : propre à l'appareil, et une valeur inconnue ne casse pas l'écran d'envoi", async () => {
  const donnees = JSON.parse(JSON.stringify(jeu.donnees));
  donnees.settings.ficheT = "inconnue"; // valeur invalide venue d'ailleurs : en 0.10, l'écran d'envoi plantait
  const page = await banc.ouvrirApp({ donnees });
  await clic(page, '[data-act="sendopen"]');
  await page.locator(".sendov").waitFor();
  assert.equal(await page.locator('.ftaille button.on').getAttribute("data-v"), "l", "retour à « Grande »");
  await clic(page, '[data-act="ftaille"][data-v="s"]');
  assert.equal(await page.locator('.ftaille button.on').getAttribute("data-v"), "s");
  await page.waitForTimeout(500);
  assert.equal((await lire(page, CLE_APPAREIL)).ficheT, "s");
  assert.equal((await lire(page, CLE)).settings.ficheT, "inconnue", "les réglages synchronisés ne sont pas modifiés");
  assert.deepStrictEqual(page.erreursFH, []);
  await page.context().close();
});
