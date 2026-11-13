/**
 * TEST 4 — SÛRETÉ DES DONNÉES (mode secours)
 * ------------------------------------------
 * Garantie visée : des données illisibles ne sont JAMAIS écrasées sans que l'utilisateur l'ait décidé.
 *
 * En 0.10, si la lecture du stockage échouait, l'appli démarrait vide et le premier enregistrement
 * remplaçait tout. Depuis la 1.0, elle s'arrête sur un écran de secours et n'écrit plus rien.
 * Ces tests ne concernent que la version en cours (la 0.10 n'a pas cet écran).
 */
"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { preparer } = require("./outils/banc.js");
const jeu = require("./donnees/jeu-invente.js");

const CLE = "feuille-heures-v1";
const CLE_SAUVEGARDES = "feuille-heures-snapshots";
const CLE_SYNCHRO = "feuille-heures-sync";
const CLE_MISE_DE_COTE = "feuille-heures-illisible";
/** Un texte qui n'est pas du JSON valide : simule un stockage abîmé. */
const ABIME = '{"app":"feuille-heures","weeks":{"2026-W41":{"days":[';

/** Lit une clé du stockage de la page. */
const lire = (page, cle) => page.evaluate((k) => localStorage.getItem(k), cle);
/** Une sauvegarde automatique contenant le jeu inventé. */
const sauvegarde = JSON.stringify([{ id: "s1", date: "2026-11-12T17:40:00.000Z", label: "Fiche S45 validée", auto: true, data: jeu.donnees }]);
/** Réglages de synchro pointant vers un faux script Google (les appels sont interceptés par le test). */
const synchro = JSON.stringify({ api: "https://script.google.com/macros/s/TEST/exec", cle: "CODEDETEST", meta: {}, dirty: {}, last: 5 });

/** Fait répondre le faux Google Sheet. `reponse` = fonction (action) → objet JSON, ou null pour simuler une panne réseau. */
async function fauxSheet(page, reponse) {
  await page.route("https://script.google.com/**", async (route) => {
    const req = route.request();
    const action = req.method() === "GET" ? new URL(req.url()).searchParams.get("action") : JSON.parse(req.postData() || "{}").action;
    const r = reponse && reponse(action);
    if (!r) return route.abort();
    return route.fulfill({ contentType: "application/json", body: JSON.stringify(r) });
  });
}

let banc;
before(async () => { banc = await preparer(); });
after(async () => { await banc.fermer(); });

test("données abîmées : écran de secours, et rien n'est écrasé", async () => {
  const page = await banc.ouvrirApp({ brut: { [CLE]: ABIME } });
  await page.getByText("Tes données n'ont pas pu être lues").waitFor();
  // Aucun onglet, aucune semaine : l'appli normale n'est pas affichée.
  assert.equal(await page.locator('[data-act="tab"]').count(), 0);
  // Sans sauvegarde ni synchro, ces deux boutons ne sont pas proposés.
  assert.equal(await page.locator('[data-act="rssnap"]').count(), 0);
  assert.equal(await page.locator('[data-act="rssheet"]').count(), 0);
  // On laisse passer les enregistrements automatiques (300 ms) et le passage en arrière-plan.
  await page.waitForTimeout(700);
  await page.evaluate(() => { window.dispatchEvent(new Event("pagehide")); });
  assert.equal(await lire(page, CLE), ABIME, "le texte d'origine est intact");
  assert.equal(await lire(page, CLE_SAUVEGARDES), null, "aucune sauvegarde vide n'a été créée");
  // Un rechargement ne change rien non plus.
  await page.reload();
  await page.getByText("Tes données n'ont pas pu être lues").waitFor();
  assert.equal(await lire(page, CLE), ABIME);
  assert.deepStrictEqual(page.erreursFH, []);
  await page.context().close();
});

test("données abîmées : exporter les données brutes rend le texte exact", async () => {
  const page = await banc.ouvrirApp({ brut: { [CLE]: ABIME } });
  const [fichier] = await Promise.all([page.waitForEvent("download"), page.locator('[data-act="rsexport"]').click()]);
  assert.match(fichier.suggestedFilename(), /^feuille-heures-donnees-brutes-2026-11-13\.txt$/);
  const flux = await fichier.createReadStream();
  let texte = ""; for await (const morceau of flux) texte += morceau;
  assert.equal(texte, ABIME);
  await page.context().close();
});

test("données abîmées : restaurer la dernière sauvegarde", async () => {
  const page = await banc.ouvrirApp({ brut: { [CLE]: ABIME, [CLE_SAUVEGARDES]: sauvegarde } });
  await page.locator('[data-act="rssnap"]').click();
  // L'appli normale revient, avec les semaines de la sauvegarde.
  await page.locator('[data-act="tab"]').first().waitFor();
  const donnees = JSON.parse(await lire(page, CLE));
  assert.equal(Object.keys(donnees.weeks).length >= Object.keys(jeu.donnees.weeks).length, true);
  assert.equal(donnees.settings.profil.nom, "Durand Camille");
  // Le texte illisible est gardé de côté, et proposé dans Réglages › Sauvegardes.
  assert.equal(JSON.parse(await lire(page, CLE_MISE_DE_COTE)).raw, ABIME);
  await page.locator('[data-act="tab"][data-t="set"]').locator("visible=true").first().click();
  await page.locator('[data-act="setp"][data-p="save"]').click();
  await page.getByText("sont gardées de côté").waitFor();
  assert.deepStrictEqual(page.erreursFH, []);
  await page.context().close();
});

test("données abîmées : récupérer depuis le Google Sheet", async () => {
  const page = await banc.ouvrirApp({ brut: { [CLE]: ABIME, [CLE_SYNCHRO]: synchro } });
  const semaine = jeu.donnees.weeks["2026-W37"];
  await fauxSheet(page, (action) => action === "pull"
    ? { ok: true, now: 1000000, items: [{ k: "settings", t: 10, d: jeu.donnees.settings }, { k: "w:2026-W37", t: 20, d: semaine }] }
    : { ok: true, now: 1000000, accepted: 0, rejected: [] });
  await page.locator('[data-act="rssheet"]').click();
  await page.locator('[data-act="tab"]').first().waitFor();
  const donnees = JSON.parse(await lire(page, CLE));
  assert.deepStrictEqual(donnees.weeks["2026-W37"].days[0], JSON.parse(JSON.stringify(semaine.days[0])));
  assert.equal(donnees.settings.profil.matricule, "00000000");
  assert.equal(JSON.parse(await lire(page, CLE_MISE_DE_COTE)).raw, ABIME);
  await page.context().close();
});

test("données abîmées : si le Google Sheet ne répond pas, on reste en secours sans rien perdre", async () => {
  const page = await banc.ouvrirApp({ brut: { [CLE]: ABIME, [CLE_SYNCHRO]: synchro } });
  await fauxSheet(page, null);
  await page.locator('[data-act="rssheet"]').click();
  await page.getByText("Récupération impossible").waitFor();
  await page.getByText("Tes données n'ont pas pu être lues").waitFor();
  assert.equal(await lire(page, CLE), ABIME);
  assert.equal(await lire(page, CLE_MISE_DE_COTE), null);
  await page.context().close();
});

test("données d'une version plus récente : on propose de recharger, sans rien écraser", async () => {
  const futur = JSON.stringify(Object.assign({}, jeu.donnees, { format: 99 }));
  const page = await banc.ouvrirApp({ brut: { [CLE]: futur } });
  await page.getByText("Ces données viennent d'une version plus récente").waitFor();
  assert.equal(await page.locator('[data-act="rsreload"]').count(), 1);
  await page.waitForTimeout(700);
  assert.equal(await lire(page, CLE), futur);
  await page.context().close();
});

test("données abîmées : repartir d'une appli vide demande une confirmation et garde le texte de côté", async () => {
  const page = await banc.ouvrirApp({ brut: { [CLE]: ABIME } });
  await page.locator('[data-act="rszero"]').click();
  // Premier clic : simple demande de confirmation, rien n'a bougé.
  await page.getByText("Confirmer : repartir d'une appli vide ?").waitFor();
  assert.equal(await lire(page, CLE), ABIME);
  await page.locator('[data-act="rszero"]').click();
  await page.locator('[data-act="tab"]').first().waitFor();
  assert.equal(JSON.parse(await lire(page, CLE_MISE_DE_COTE)).raw, ABIME);
  const semaines = Object.keys(JSON.parse(await lire(page, CLE)).weeks).filter((k) => k !== "2026-W46");
  assert.deepStrictEqual(semaines, [], "appli vide : au plus la semaine courante (créée à l'affichage)");
  await page.context().close();
});

test("données abîmées : importer un fichier de sauvegarde ; un mauvais fichier laisse en secours", async () => {
  const page = await banc.ouvrirApp({ brut: { [CLE]: ABIME } });
  // Mauvais fichier : message, et on reste sur l'écran de secours, texte intact.
  await page.locator("#imp").setInputFiles({ name: "nimporte.json", mimeType: "application/json", buffer: Buffer.from("pas du json") });
  await page.getByText("n'est pas une sauvegarde").waitFor();
  await page.getByText("Tes données n'ont pas pu être lues").waitFor();
  assert.equal(await lire(page, CLE), ABIME);
  // Bon fichier : l'appli revient avec les données du fichier.
  await page.locator("#imp").setInputFiles({ name: "sauvegarde.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(jeu.donnees)) });
  await page.locator('[data-act="tab"]').first().waitFor();
  assert.equal(JSON.parse(await lire(page, CLE)).settings.profil.nom, "Durand Camille");
  assert.equal(JSON.parse(await lire(page, CLE_MISE_DE_COTE)).raw, ABIME);
  assert.deepStrictEqual(page.erreursFH, []);
  await page.context().close();
});

test("données saines : aucun écran de secours, rien n'est mis de côté", async () => {
  const page = await banc.ouvrirApp({ donnees: jeu.donnees });
  await page.locator('[data-act="tab"]').first().waitFor();
  assert.equal(await page.getByText("n'ont pas pu être lues").count(), 0);
  assert.equal(await lire(page, CLE_MISE_DE_COTE), null);
  await page.context().close();
});
