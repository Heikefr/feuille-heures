/**
 * TEST 7 — QUALITÉ DU CODE
 * ------------------------
 * L'appli n'est pas compilée : sans ce test, une faute de frappe dans un nom de fonction ne se verrait
 * que le jour où l'on passe par la ligne fautive. L'analyse (tests/outils/analyse.js) lit tous les
 * modules et refuse :
 *   - un nom utilisé qui n'existe nulle part ;
 *   - un import inutile, ou d'un nom que le module visé n'exporte pas ;
 *   - un export que personne n'utilise (code mort) ;
 *   - la modification d'une variable appartenant à un autre module.
 * Il exige aussi que chaque fichier commence par un en-tête et que chaque fonction soit commentée.
 */
"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const acorn = require("acorn");
const { analyser } = require("./outils/analyse.js");
const { DEPOT } = require("./outils/serveur.js");

test("aucun nom inconnu, import inutile ou code mort dans js/", () => {
  const { problemes, modules } = analyser(path.join(path.resolve(process.env.FH_RACINE || DEPOT), "js"));
  assert.ok(Object.keys(modules).length >= 20, "les modules sont bien lus");
  assert.deepStrictEqual(problemes, []);
});

test("chaque module a un en-tête et chaque fonction un commentaire", () => {
  const dossier = path.join(path.resolve(process.env.FH_RACINE || DEPOT), "js");
  const oublis = [];
  for (const f of fs.readdirSync(dossier).filter((x) => x.endsWith(".js")).sort()) {
    const code = fs.readFileSync(path.join(dossier, f), "utf8");
    if (!code.startsWith("/*")) oublis.push(`${f} : pas d'en-tête`);
    const commentaires = [];
    const ast = acorn.parse(code, { ecmaVersion: 2022, sourceType: "module", onComment: commentaires });
    for (const n of ast.body) {
      if (n.type !== "FunctionDeclaration") continue;
      // Un commentaire doit se terminer juste au-dessus de la fonction (seuls des blancs entre les deux).
      const ok = commentaires.some((c) => c.end <= n.start && /^\s*$/.test(code.slice(c.end, n.start)));
      if (!ok) oublis.push(`${f} : fonction ${n.id.name} sans commentaire`);
    }
  }
  assert.deepStrictEqual(oublis, []);
});
