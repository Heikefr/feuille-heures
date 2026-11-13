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
 */
"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { analyser } = require("./outils/analyse.js");
const { DEPOT } = require("./outils/serveur.js");

test("aucun nom inconnu, import inutile ou code mort dans js/", () => {
  const { problemes, modules } = analyser(path.join(path.resolve(process.env.FH_RACINE || DEPOT), "js"));
  assert.ok(Object.keys(modules).length >= 20, "les modules sont bien lus");
  assert.deepStrictEqual(problemes, []);
});
