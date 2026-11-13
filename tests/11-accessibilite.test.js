/**
 * TEST 11 — ACCESSIBILITÉ (clavier et lecteur d'écran)
 * ----------------------------------------------------
 *   - fenêtres : le focus y entre à l'ouverture, Tab y reste, Échap ferme, le focus revient d'où il venait ;
 *   - messages temporaires : aussi écrits dans la zone lue par les lecteurs d'écran ;
 *   - état des semaines : dit en toutes lettres, pas seulement par la couleur ;
 *   - tableaux : en-têtes de lignes et de colonnes déclarés.
 * Rien de tout cela ne se voit à l'écran (le test 3 vérifie que l'affichage n'a pas bougé).
 */
"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { preparer } = require("./outils/banc.js");
const jeu = require("./donnees/jeu-invente.js");

const clic = (page, selecteur) => page.locator(selecteur).locator("visible=true").first().click();
/** Vrai si le focus est dans une fenêtre ouverte. */
const focusDansFenetre = (page) => page.evaluate(() => { const f = document.querySelector('[role="dialog"]'); return !!f && f.contains(document.activeElement); });

let banc;
before(async () => { banc = await preparer(); });
after(async () => { await banc.fermer(); });

for (const ecran of ["iphone", "pc"]) {
  test(`détail d'un jour : focus, Tab, Échap, retour du focus (${ecran})`, async () => {
    const page = await banc.ouvrirApp({ donnees: jeu.donnees, ecran });
    await clic(page, '[data-act="fill"][data-id="m3"]');
    await clic(page, '[data-act="openday"][data-i="1"]');
    await page.locator('[role="dialog"]').waitFor();
    assert.equal(await focusDansFenetre(page), true, "à l'ouverture, le focus est dans la fenêtre");
    // Sur iPhone, le focus ne doit pas être dans un champ (le clavier s'ouvrirait).
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute("role")), "dialog");
    // Trente appuis sur Tab, puis autant en arrière : on ne sort jamais de la fenêtre.
    for (let i = 0; i < 30; i++) { await page.keyboard.press("Tab"); assert.equal(await focusDansFenetre(page), true, "Tab reste dans la fenêtre"); }
    for (let i = 0; i < 30; i++) { await page.keyboard.press("Shift+Tab"); assert.equal(await focusDansFenetre(page), true, "Maj+Tab reste dans la fenêtre"); }
    await page.keyboard.press("Escape");
    await page.locator('[role="dialog"]').waitFor({ state: "detached" });
    // Le focus revient sur le bouton qui avait ouvert la fenêtre.
    const retour = await page.evaluate(() => ({ act: document.activeElement.dataset.act, i: document.activeElement.dataset.i }));
    assert.deepStrictEqual(retour, { act: "openday", i: "1" });
    assert.deepStrictEqual(page.erreursFH, []);
    await page.context().close();
  });

  test(`vue année et écran d'envoi : Échap ferme (${ecran})`, async () => {
    const page = await banc.ouvrirApp({ donnees: jeu.donnees, ecran });
    await clic(page, '[data-act="year"]');
    await page.locator('[role="dialog"]').waitFor();
    assert.equal(await focusDansFenetre(page), true);
    await page.keyboard.press("Escape");
    await page.locator('[role="dialog"]').waitFor({ state: "detached" });
    await clic(page, '[data-act="sendopen"]');
    await page.locator(".sendov").waitFor();
    assert.equal(await focusDansFenetre(page), true);
    await page.keyboard.press("Escape");
    await page.locator(".sendov").waitFor({ state: "detached" });
    await page.context().close();
  });
}

test("un message temporaire est aussi annoncé aux lecteurs d'écran", async () => {
  const page = await banc.ouvrirApp({ donnees: jeu.donnees });
  await clic(page, '[data-act="fill"][data-id="m3"]');
  const zone = page.locator("#annonces");
  await zone.waitFor({ state: "attached" });
  assert.equal(await zone.getAttribute("aria-live"), "polite");
  assert.equal(await zone.innerText(), await page.locator("#toast").innerText());
  await page.context().close();
});

test("l'état des semaines est dit en toutes lettres", async () => {
  const page = await banc.ouvrirApp({ donnees: jeu.donnees });
  // Mini-calendrier du menu PC.
  assert.equal(await page.locator('.dwk[data-k="2026-W45"]').getAttribute("aria-label"), "Semaine 45, envoyée");
  assert.equal(await page.locator('.dwk[data-k="2026-W46"]').getAttribute("aria-label"), "Semaine 46, vide, semaine en cours");
  assert.equal(await page.locator('.dwk[data-k="2026-W48"]').getAttribute("aria-label"), "Semaine 48, vide");
  // Vue année.
  await clic(page, '[data-act="year"]');
  assert.equal(await page.locator('.yw[data-k="2026-W37"]').getAttribute("aria-label"), "Semaine 37, envoyée");
  assert.equal(await page.locator('.yw[data-k="2026-W44"]').getAttribute("aria-label"), "Semaine 44, brouillon");
  await page.context().close();
});

test("tableau du bilan : en-têtes de colonnes et de lignes déclarés", async () => {
  const page = await banc.ouvrirApp({ donnees: jeu.donnees, ecran: "iphone" });
  await clic(page, '[data-act="tab"][data-t="bilan"]');
  assert.equal(await page.locator('.btab thead th:not([scope="col"])').count(), 0);
  assert.equal(await page.locator('.btab tbody th:not([scope="row"])').count(), 0);
  await page.context().close();
});
