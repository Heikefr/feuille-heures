/**
 * TEST 1 — CALCULS, COMPTEURS ET VÉRIFICATION COMPTA
 * --------------------------------------------------
 * Garantie visée : « les résultats des calculs ne changent pas d'une minute ».
 *
 * Deux sortes de contrôles :
 *
 *  A. Comparaison avec la référence. La version 0.10 figée (tests/reference/0.10) et la version
 *     en cours reçoivent les mêmes données ; tout ce qu'elles calculent doit être strictement égal :
 *     chaque semaine (heures, heures sup, nuit, primes, samedi, récup…), les compteurs à dix dates
 *     (dont les changements de période au 1er janvier et au 1er juin), le solde de récup, le bilan
 *     annuel, l'analyse des relevés compta et la comparaison avec l'appli.
 *     Ce contrôle tourne sur le jeu inventé, et sur les vraies données quand elles sont fournies.
 *
 *  B. Valeurs attendues écrites à la main, sur le jeu inventé. Elles documentent les règles
 *     (accord MHCS 2010 et accord ARTT) et protègent aussi d'une erreur dans la référence elle-même.
 */
"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { preparer, ecarts } = require("./outils/banc.js");
const { jeux } = require("./outils/donnees.js");
const { sondeCalculs, sondeCompta } = require("./outils/sondes.js");

/** Dates où les compteurs sont évalués (veille et jour des changements de période compris). */
const DATES = ["2026-01-15", "2026-05-31", "2026-06-01", "2026-08-31", "2026-09-01", "2026-11-02", "2026-11-13", "2026-12-31", "2027-01-04", "2027-06-01"];
const ANNEES = [2025, 2026, 2027];

/**
 * Exige que deux rapports soient égaux.
 * Jeu inventé : la différence est affichée en détail. Vraies données : seulement l'emplacement des écarts
 * (le journal de GitHub Actions est public).
 */
function memeRapport(jeu, obtenu, attendu) {
  if (jeu.nom === "inventé") assert.deepStrictEqual(obtenu, attendu);
  else assert.deepStrictEqual(ecarts(attendu, obtenu), [], "écarts avec la 0.10 (valeurs masquées)");
}

let banc;
before(async () => { banc = await preparer(); });
after(async () => { await banc.fermer(); });

/* ---------- A. Comparaison avec la référence ---------- */

for (const jeu of jeux()) {
  test(`[${jeu.nom}] calculs identiques à la 0.10 (semaines, compteurs, solde, bilan)`, async () => {
    const [ref, app] = await Promise.all([banc.ouvrirRef({ donnees: jeu.donnees }), banc.ouvrirApp({ donnees: jeu.donnees })]);
    const p = { dates: DATES, annees: ANNEES };
    const [a, b] = await Promise.all([ref.evaluate(sondeCalculs, p), app.evaluate(sondeCalculs, p)]);
    assert.ok(Object.keys(a.semaines).length >= Object.keys(jeu.donnees.weeks).length, "toutes les semaines sont calculées");
    memeRapport(jeu, b, a);
    assert.deepStrictEqual(app.erreursFH, [], "aucune erreur JavaScript dans la version en cours");
    await Promise.all([ref.context().close(), app.context().close()]);
  });

  test(`[${jeu.nom}] vérification compta identique à la 0.10 (relevés et soldes)`, async () => {
    const [ref, app] = await Promise.all([banc.ouvrirRef({ donnees: jeu.donnees }), banc.ouvrirApp({ donnees: jeu.donnees })]);
    const p = { releves: jeu.releves, recaps: jeu.recaps };
    const [a, b] = await Promise.all([ref.evaluate(sondeCompta, p), app.evaluate(sondeCompta, p)]);
    for (const r of jeu.releves) assert.ok(a.releves[r.nom].length >= 1, `le relevé « ${r.nom} » est reconnu`);
    for (const r of jeu.recaps) assert.notEqual(a.recaps[r.nom], "non reconnu", `le récapitulatif « ${r.nom} » est reconnu`);
    memeRapport(jeu, b, a);
    await Promise.all([ref.context().close(), app.context().close()]);
  });
}

/* ---------- B. Valeurs attendues, écrites à la main (jeu inventé) ---------- */

test("règles de calcul : valeurs attendues sur le jeu inventé", async () => {
  const jeu = jeux()[0];
  const app = await banc.ouvrirApp({ donnees: jeu.donnees });
  const r = await app.evaluate(sondeCalculs, { dates: ["2026-11-13"], annees: [] });
  const S = r.semaines, C = r.compteurs["2026-11-13"];
  const H = (h, m = 0) => h * 60 + m; // heures:minutes → minutes

  // S36 — 5 matins 5h30–12h30 : pile 35 h, donc aucune heure sup (seuil hebdomadaire de 35 h, accord ARTT).
  assert.equal(S["2026-W36"].worked, H(35));
  assert.equal(S["2026-W36"].hs, 0);
  // Nuit avant 6 h : 0:30 par jour, majorée à 100 % → 2:30 de récup gagnée. Panier + équipe : 5 (≥ 6 h en Matin).
  assert.equal(S["2026-W36"].night, H(2, 30));
  assert.equal(S["2026-W36"].gain, H(2, 30));
  assert.equal(S["2026-W36"].panier, 5);

  // S37 — 5 soirs 12h45–20h15 : 37:30 → 2:30 d'heures sup à 25 % = 0:37,5 de majoration.
  assert.equal(S["2026-W37"].hs, H(2, 30));
  assert.equal(S["2026-W37"].majHs, 37.5);
  // Nuit après 20 h : 0:15 par jour. Récup gagnée = 2:30 + 0:37,5 + 1:15.
  assert.equal(S["2026-W37"].night, H(1, 15));
  assert.equal(S["2026-W37"].gain, 150 + 37.5 + 75);

  // S38 — samedi 6 h : hors seuil des 35 h, majoré à 50 %, indemnité 3006 dès 6 h (accord samedi maintenance).
  assert.equal(S["2026-W38"].hs, H(6, 15), "les heures du samedi n'entrent pas dans les heures sup de la semaine");
  assert.equal(S["2026-W38"].samedi, H(6));
  assert.equal(S["2026-W38"].majSam, H(3));
  assert.equal(S["2026-W38"].sam, 1);
  assert.equal(S["2026-W38"].panier, 6);

  // S39 — 16 h d'heures sup : les 8 premières à 25 %, les suivantes à 50 %. Alertes > 10 h/jour et > 40 h/semaine.
  assert.equal(S["2026-W39"].hs1, H(8));
  assert.equal(S["2026-W39"].hs2, H(8));
  assert.equal(S["2026-W39"].majHs, H(8) * 0.25 + H(8) * 0.5);
  assert.equal(S["2026-W39"].alertSem, true);
  assert.equal(S["2026-W39"].alertJours, 1);

  // S40 — récup (2 h) et congé (1 h) posés dans une journée : comptés dans la présence (indicateur compta I2),
  // PAS dans les heures sup majorées (R125/R150), et la récup est retirée en entier du compteur.
  assert.equal(S["2026-W40"].worked, H(36));
  assert.equal(S["2026-W40"].counted, H(39));
  assert.equal(S["2026-W40"].pres, H(4), "présence au-delà de 35 h");
  assert.equal(S["2026-W40"].hs, H(1), "heures sup majorées");
  assert.equal(S["2026-W40"].debit, H(2));

  // S22 — un jour férié compte 7 h : 28 h travaillées + 7 h = 35 h, pas d'heure sup.
  assert.equal(S["2026-W22"].counted, H(35));
  assert.equal(S["2026-W22"].hs, 0);

  // S42 — samedi de 3 h : majoré mais sans indemnité (moins de 6 h). Journée de récup : 7 h retirées du compteur.
  assert.equal(S["2026-W42"].sam, 0);
  assert.equal(S["2026-W42"].majSam, H(1, 30));
  assert.equal(S["2026-W42"].debit, H(7));

  // Compteurs au 13/11/2026.
  // Récup prise = 10:00 du relevé + 7:00 (journée du 12/10) + 2:00 (posées le 29/09) + 7:00 placées au CET.
  assert.equal(C.recup.pris, H(10) + H(7) + H(2) + H(7));
  // Congé principal : 35:00 du relevé + 7:00 (05/10) + 3:30 (demi-journée du 30/10) ; la semaine 47 à venir est « prévue ».
  assert.equal(C.cp.pris, H(35) + H(7) + H(3, 30));
  assert.equal(C.cp.prevu, H(35));
  // 5e semaine : une journée + 1 h posée dans une journée.
  assert.equal(C.c5.pris, H(8));
  // Fractionnement : 2 jours crédités par l'appli, 1 jour pris.
  assert.equal(C.frac.acq, H(14));
  assert.equal(C.frac.pris, H(7));
  // Ancienneté (en jours) : 1 jour posé + 0,5 jour placé au CET.
  assert.equal(C.anc.pris, 1.5);
  assert.equal(C.csup.pris, 1);
  // CET : 35:00 au relevé + 7:00 + 3:30 placés ensuite ; plafond 140 h.
  assert.equal(C.cet.solde, H(45, 30));
  assert.equal(C.cet.max, H(140));

  // Vérification compta : la S37 correspond en tout point ; la S41 a exactement l'écart glissé exprès (lundi).
  const v = await app.evaluate(sondeCompta, { releves: jeu.releves, recaps: [] });
  assert.equal(v.releves["S37 sans écart"][0].comparaison.bad, 0);
  assert.equal(v.releves["S41 avec écart"][0].comparaison.bad, 2);
  await app.context().close();
});
