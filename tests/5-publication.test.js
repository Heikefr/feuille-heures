/**
 * TEST 5 — COHÉRENCE DES FICHIERS PUBLIÉS
 * ---------------------------------------
 * L'appli est servie telle quelle par GitHub Pages, sans étape de compilation : rien ne signale donc
 * tout seul un fichier oublié. Ce test vérifie, sans navigateur, que :
 *   - chaque module importé par un autre existe bien ;
 *   - index.html ne pointe que vers des fichiers présents ;
 *   - la liste des fichiers gardés hors ligne (sw.js) contient TOUS les fichiers de l'appli,
 *     sinon l'appli installée sur l'iPhone ne démarrerait plus sans réseau.
 */
"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { DEPOT } = require("./outils/serveur.js");

/** Racine de la version testée (la même que celle servie sous /app/). */
const RACINE = path.resolve(process.env.FH_RACINE || DEPOT);
const lire = (f) => fs.readFileSync(path.join(RACINE, f), "utf8");
const existe = (f) => fs.existsSync(path.join(RACINE, f));
const lister = (dossier, ext) => (existe(dossier) ? fs.readdirSync(path.join(RACINE, dossier)).filter((f) => f.endsWith(ext)).map((f) => dossier + "/" + f) : []);

test("chaque module importé existe", () => {
  for (const f of lister("js", ".js")) {
    for (const m of lire(f).matchAll(/^import\s+(?:[^"']*from\s+)?["'](\.\/[^"']+)["']/gm)) {
      assert.ok(existe(path.posix.join("js", m[1])), `${f} importe ${m[1]}, qui n'existe pas`);
    }
  }
});

test("index.html ne pointe que vers des fichiers présents", () => {
  const html = lire("index.html");
  for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    if (/^https?:/.test(m[1])) continue; // bibliothèques et polices venues d'un CDN
    assert.ok(existe(m[1]), `index.html pointe vers ${m[1]}, qui n'existe pas`);
  }
});

test("le cache hors ligne (sw.js) contient tous les fichiers de l'appli", () => {
  const sw = lire("sw.js");
  const attendus = ["index.html", "manifest.webmanifest", ...lister("js", ".js"), ...lister("css", ".css")];
  const manquants = attendus.filter((f) => !sw.includes('"./' + f + '"'));
  assert.deepStrictEqual(manquants, [], "fichiers absents de la liste hors ligne de sw.js");
  // Et rien d'inexistant dans la liste.
  for (const m of sw.matchAll(/"\.\/([^"]+)"/g)) assert.ok(existe(m[1]), `sw.js cite ${m[1]}, qui n'existe pas`);
});

test("le numéro de publication est le même dans sw.js et dans js/etat.js", () => {
  const dansSw = (lire("sw.js").match(/const BUILD = "([^"]+)"/) || [])[1];
  const dansAppli = (lire("js/etat.js").match(/var BUILD\s*=\s*"([^"]+)"/) || [])[1];
  assert.ok(dansSw, "BUILD introuvable dans sw.js");
  assert.equal(dansAppli, dansSw, "BUILD doit être changé aux deux endroits à chaque publication");
});
