/**
 * TEST 6 — HORS LIGNE ET MISES À JOUR
 * -----------------------------------
 * Garanties visées :
 *   - l'appli installée démarre sans réseau, avec ses données ;
 *   - une nouvelle version ne remplace jamais l'ancienne à moitié : elle attend, s'annonce par le
 *     bandeau « Nouvelle version prête », et ne bascule que sur « Recharger » ;
 *   - le passage réel de la 0.10 (ancien cache hors ligne) à la version en cours se fait tout seul,
 *     sans bandeau, sans perte de données, et l'appli marche ensuite hors ligne.
 *
 * Chaque test travaille sur une copie de l'appli dans un dossier temporaire, servie par son propre
 * serveur : on peut ainsi « publier » une nouvelle version (modifier la copie) ou « couper le réseau »
 * (arrêter le serveur) sans toucher au dépôt.
 */
"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { demarrer, DEPOT } = require("./outils/serveur.js");
const { lancer, ouvrir } = require("./outils/navigateur.js");
const jeu = require("./donnees/jeu-invente.js");

const RACINE = path.resolve(process.env.FH_RACINE || DEPOT);
const REFERENCE = path.join(DEPOT, "tests", "reference", "0.10");
/** Fichiers communs à toutes les versions (inchangés depuis la 0.10). */
const COMMUNS = ["manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png", "icon-512-maskable.png"];

/** Crée un dossier temporaire vide. */
function dossierTemporaire() { return fs.mkdtempSync(path.join(os.tmpdir(), "fh-test-")); }
/** « Publie » la version en cours dans un dossier (remplace ce qui s'y trouve). */
function publierVersionEnCours(dossier) {
  for (const f of ["index.html", "sw.js", ...COMMUNS]) fs.copyFileSync(path.join(RACINE, f), path.join(dossier, f));
  for (const d of ["js", "css"]) fs.cpSync(path.join(RACINE, d), path.join(dossier, d), { recursive: true });
}
/** « Publie » la 0.10 d'origine dans un dossier. */
function publierVersion010(dossier) {
  for (const f of ["index.html", "sw.js"]) fs.copyFileSync(path.join(REFERENCE, f), path.join(dossier, f));
  for (const f of COMMUNS) fs.copyFileSync(path.join(RACINE, f), path.join(dossier, f));
}
/** Remplace le numéro de publication dans une copie (simule la publication d'une version suivante). */
function changerBuild(dossier, numero) {
  const sw = path.join(dossier, "sw.js"), etat = path.join(dossier, "js", "etat.js");
  fs.writeFileSync(sw, fs.readFileSync(sw, "utf8").replace(/const BUILD = "[^"]+"/, `const BUILD = "${numero}"`));
  fs.writeFileSync(etat, fs.readFileSync(etat, "utf8").replace(/var BUILD\s*=\s*"[^"]+"/, `var BUILD = "${numero}"`));
}
/** Attend que le fonctionnement hors ligne soit installé ET aux commandes de la page. */
const attendreHorsLignePret = (page) => page.waitForFunction(() => navigator.serviceWorker.controller && navigator.serviceWorker.ready.then(() => true));
/** Numéro de publication de la page affichée. */
const buildDeLaPage = (page) => page.evaluate(() => window.__fh && window.__fh.BUILD);
/** Noms des caches présents. */
const caches_ = (page) => page.evaluate(() => caches.keys());
/** Nom affiché dans le profil enregistré (preuve que les données sont toujours là). */
const nomEnregistre = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("feuille-heures-v1")).settings.profil.nom);

let navigateur;
before(async () => { navigateur = await lancer(); });
after(async () => { await navigateur.close(); });

test("hors ligne : l'appli installée redémarre sans réseau, avec ses données", async () => {
  const dossier = dossierTemporaire(); publierVersionEnCours(dossier);
  const serveur = await demarrer({ app: dossier });
  const page = await ouvrir(navigateur, serveur.url + "/app/", { donnees: jeu.donnees, horsLigne: true });
  await attendreHorsLignePret(page);
  await serveur.fermer(); // plus de réseau du tout
  await page.reload();
  await page.locator('[data-act="tab"]').first().waitFor();
  assert.equal(await nomEnregistre(page), "Durand Camille");
  assert.equal(await page.locator("#maj").count(), 0, "pas de bandeau de mise à jour");
  // Le lien de connexion d'un autre appareil (« ?api=…&cle=… ») doit aussi s'ouvrir hors ligne.
  await page.goto(serveur.url + "/app/?essai=1");
  await page.locator('[data-act="tab"]').first().waitFor();
  await page.context().close();
});

test("mise à jour : la nouvelle version attend, s'annonce, puis bascule sur « Recharger »", async () => {
  const dossier = dossierTemporaire(); publierVersionEnCours(dossier);
  const serveur = await demarrer({ app: dossier });
  const page = await ouvrir(navigateur, serveur.url + "/app/", { donnees: jeu.donnees, horsLigne: true });
  await attendreHorsLignePret(page);
  const avant = await buildDeLaPage(page);

  changerBuild(dossier, "essai-suivant"); // une nouvelle version est publiée
  await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r.update()));
  await page.locator("#maj").waitFor();
  assert.match(await page.locator("#maj").innerText(), /Nouvelle version prête/);
  // Tant qu'on n'a pas cliqué, la page est toujours l'ancienne version, entière.
  assert.equal(await buildDeLaPage(page), avant);
  await page.reload();
  assert.equal(await buildDeLaPage(page), avant, "un simple rechargement reste sur l'ancienne version, sans mélange");
  await page.locator("#maj").waitFor();

  await Promise.all([page.waitForEvent("load"), page.locator("#maj button").click()]);
  await page.waitForFunction(() => window.__fh && window.__fh.BUILD === "essai-suivant");
  assert.equal(await page.locator("#maj").count(), 0);
  assert.equal(await nomEnregistre(page), "Durand Camille", "les données sont conservées");
  const noms = await caches_(page);
  assert.ok(noms.includes("feuille-heures-essai-suivant"));
  assert.ok(!noms.includes("feuille-heures-" + avant), "le cache de l'ancienne version est supprimé");
  await page.context().close(); await serveur.fermer();
});

test("passage de la 0.10 à la version en cours : automatique, sans bandeau ni perte, puis hors ligne", async () => {
  const dossier = dossierTemporaire(); publierVersion010(dossier);
  const serveur = await demarrer({ app: dossier });
  const page = await ouvrir(navigateur, serveur.url + "/app/", { donnees: jeu.donnees, horsLigne: true });
  await attendreHorsLignePret(page); // l'ancien cache hors ligne de la 0.10 est en place
  assert.ok((await caches_(page)).includes("feuille-heures-v16"));
  // L'utilisateur travaille en 0.10 : il remplit la semaine courante.
  await page.locator('[data-act="fill"][data-id="m3"]').locator("visible=true").first().click();
  await page.waitForTimeout(500);
  const semaineSaisie = await page.evaluate(() => JSON.parse(localStorage.getItem("feuille-heures-v1")).weeks["2026-W46"].days[0]);
  assert.equal(semaineSaisie.type, "sch:m3");

  publierVersionEnCours(dossier); // la nouvelle version est publiée
  await page.reload();            // prochaine ouverture de l'appli
  await page.locator('[data-act="tab"]').first().waitFor();
  const build = await buildDeLaPage(page);
  assert.ok(build, "la page affichée est bien la nouvelle version");
  // Le nouveau cache s'installe et remplace l'ancien, sans rien demander.
  await page.waitForFunction((b) => caches.keys().then((k) => k.includes("feuille-heures-" + b) && !k.includes("feuille-heures-v16")), build);
  assert.equal(await page.locator("#maj").count(), 0, "pas de bandeau : la page est déjà à jour");
  assert.equal(await nomEnregistre(page), "Durand Camille");
  assert.deepStrictEqual(await page.evaluate(() => JSON.parse(localStorage.getItem("feuille-heures-v1")).weeks["2026-W46"].days[0]), semaineSaisie, "la saisie faite en 0.10 est intacte");
  assert.deepStrictEqual(page.erreursFH.filter((e) => !/exceljs/i.test(e)), []);

  await serveur.fermer(); // et maintenant sans réseau
  await page.reload();
  await page.locator('[data-act="tab"]').first().waitFor();
  assert.equal(await buildDeLaPage(page), build);
  await page.context().close();
});
