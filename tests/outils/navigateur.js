/**
 * NAVIGATEUR DE TEST
 * ------------------
 * Ouvre l'appli dans un vrai navigateur (Chromium, piloté par Playwright) dans des conditions
 * toujours identiques, pour que deux exécutions donnent exactement le même résultat :
 *   - date et heure figées (vendredi 13/11/2026 à 10h00, heure de Paris) ;
 *   - langue française, format 24 h ;
 *   - aucun accès à Internet (polices Google et module Excel bloqués) : même rendu partout ;
 *   - pas de cache hors ligne (service worker bloqué), pas d'animation ;
 *   - stockage rempli à l'avance avec le jeu de données voulu.
 */
"use strict";
const { chromium } = require("playwright");

/** « Aujourd'hui » pour tous les tests. */
const MAINTENANT = new Date("2026-11-13T10:00:00+01:00");

/** Clés de stockage de l'appli (identiques en 0.10 et en 1.0 : contrainte « reprise sans perte »). */
const CLE_DONNEES = "feuille-heures-v1";

/**
 * Tailles d'écran testées.
 *  - iphone : iPhone récent en portrait, écran tactile ;
 *  - etroit : fenêtre PC non agrandie (entre 900 et 1 279 px : grille complète sans menu de gauche) ;
 *  - pc     : PC plein écran (≥ 1 280 px : menu de gauche et panneau de droite).
 */
const ECRANS = {
  iphone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  etroit: { viewport: { width: 1100, height: 820 }, deviceScaleFactor: 1 },
  pc: { viewport: { width: 1366, height: 820 }, deviceScaleFactor: 1 },
};

/**
 * Lance le navigateur. Sur GitHub Actions, c'est le Chromium installé par Playwright ;
 * ailleurs on peut désigner un Chrome déjà présent avec la variable FH_CHROME.
 * @returns {Promise<import("playwright").Browser>}
 */
function lancer() {
  return chromium.launch({
    executablePath: process.env.FH_CHROME || undefined,
    // Les options après --lang rendent le dessin reproductible d'une page à l'autre :
    // pas de carte graphique, un seul fil de dessin, pas de placement des lettres au sous-pixel.
    args: ["--no-sandbox", "--lang=fr-FR", "--font-render-hinting=none", "--disable-lcd-text", "--disable-gpu", "--num-raster-threads=1",
      "--disable-font-subpixel-positioning", "--disable-skia-runtime-opts", "--disable-partial-raster", "--force-color-profile=srgb"],
    env: { ...process.env, LANG: "fr_FR.UTF-8", LANGUAGE: "fr", LC_ALL: "fr_FR.UTF-8", TZ: "Europe/Paris" },
  });
}

/**
 * Ouvre une version de l'appli avec des données déjà en place.
 * @param {import("playwright").Browser} navigateur
 * @param {string} adresse           Adresse complète de la version (ex. http://127.0.0.1:1234/ref/).
 * @param {object} options
 * @param {object} options.donnees   Contenu du stockage (format d'une sauvegarde).
 * @param {"iphone"|"etroit"|"pc"} [options.ecran="pc"]
 * @param {"light"|"dark"} [options.theme="light"]  Thème forcé dans les réglages.
 * @param {Object<string,string>} [options.brut]   Clés de stockage à écrire telles quelles, en plus ou à la place des données
 *                                                (sert à simuler des données abîmées, des sauvegardes, une synchro configurée).
 * @returns {Promise<import("playwright").Page>} Page prête, appli affichée.
 */
async function ouvrir(navigateur, adresse, { donnees, ecran = "pc", theme = "light", brut = {} }) {
  const contexte = await navigateur.newContext({
    ...ECRANS[ecran],
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    colorScheme: theme,
    reducedMotion: "reduce",
    serviceWorkers: "block",
  });
  const page = await contexte.newPage();
  // Tout ce qui n'est pas notre serveur local est coupé (polices, CDN, synchro).
  await page.route("**/*", (route) => (route.request().url().startsWith(new URL(adresse).origin) ? route.continue() : route.abort()));
  await page.clock.setFixedTime(MAINTENANT);
  const stockage = {};
  if (donnees) {
    const contenu = JSON.parse(JSON.stringify(donnees));
    contenu.settings = Object.assign({}, contenu.settings, { theme });
    stockage[CLE_DONNEES] = JSON.stringify(contenu);
  }
  Object.assign(stockage, brut);
  // Le stockage n'est rempli qu'à la première ouverture : un rechargement de page garde ce que l'appli a écrit.
  await page.addInitScript(
    (st) => { if (!sessionStorage.getItem("fh-test-pret")) { localStorage.clear(); for (const k in st) localStorage.setItem(k, st[k]); sessionStorage.setItem("fh-test-pret", "1"); } },
    stockage
  );
  const erreurs = [];
  page.on("pageerror", (e) => erreurs.push(String(e)));
  page.erreursFH = erreurs;
  await page.goto(adresse);
  await page.waitForSelector("#app > *");
  return page;
}

module.exports = { lancer, ouvrir, MAINTENANT, ECRANS, CLE_DONNEES };
