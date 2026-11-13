/**
 * TEST 3 — ÉCRANS (iPhone, fenêtre PC étroite, PC plein écran · thèmes clair et sombre)
 * -------------------------------------------------------------------------------------
 * Garantie visée : la refonte ne change rien à l'affichage, sauf ce qui a été décidé.
 *
 * Chaque « scénario » rejoue les mêmes gestes (ouvrir une semaine, remplir, ouvrir l'envoi…)
 * sur la version 0.10 figée et sur la version en cours, puis photographie la page entière.
 * Les deux photos doivent être identiques (à l'arrondi du navigateur près, voir TOLERANCE).
 *
 * Quand un changement d'affichage est voulu (décisions validées pour la 1.0), le scénario concerné
 * est inscrit dans CHANGEMENTS_VOULUS avec la raison : il est alors photographié et rangé dans
 * tests/resultats pour relecture, mais ne fait plus échouer le test.
 *
 * Les gestes s'appuient sur les attributs `data-act` de l'appli (le nom de chaque action) :
 * ils font partie du contrat à conserver pendant la refonte.
 */
"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { preparer, garder, peutGarder } = require("./outils/banc.js");
const { jeux } = require("./outils/donnees.js");

/**
 * Scénarios dont l'affichage a volontairement changé depuis la 0.10.
 * Clé : nom du scénario (ou « * » pour tous) ; valeur : la raison, en clair.
 * Vide tant que la refonte est « à l'identique ».
 */
const CHANGEMENTS_VOULUS = {};

/* ---------- Gestes élémentaires ---------- */

/** Clique sur le premier élément VISIBLE correspondant (l'appli génère les grilles iPhone et PC en double). */
async function clic(page, selecteur) { await page.locator(selecteur).locator("visible=true").first().click(); }
/** Ouvre une semaine en passant par la vue année, comme un utilisateur. */
async function allerSemaine(page, cle) { await clic(page, '[data-act="year"]'); await clic(page, `.yw[data-k="${cle}"]`); }
/** Change d'onglet (week, bank, bilan, set). */
async function onglet(page, t) { await clic(page, `[data-act="tab"][data-t="${t}"]`); }
/** Remplit lundi→vendredi de la semaine courante avec l'horaire 5h30–12h30. */
async function remplir(page) { await clic(page, '[data-act="fill"][data-id="m3"]'); }
/** Colle un texte dans « Vérifier avec la compta » et lance la vérification. */
async function verifier(page, texte) { await page.locator("#vtxt").fill(texte); await clic(page, '[data-act="vrun"]'); }

/**
 * Liste des scénarios pour un jeu de données.
 * @param {object} jeu
 * @returns {{nom:string, gestes:(page:import("playwright").Page, ecran:string)=>Promise<void>}[]}
 */
function scenarios(jeu) {
  const releves = jeu.releves.map((r) => r.texte).join("\n");
  const communs = [
    { nom: "annee", gestes: (p) => clic(p, '[data-act="year"]') },
    { nom: "compteurs", gestes: (p) => onglet(p, "bank") },
    { nom: "bilan", gestes: (p) => onglet(p, "bilan") },
    { nom: "verification-semaines", gestes: async (p) => { await clic(p, '[data-act="verif"]'); await verifier(p, releves); } },
    { nom: "verification-soldes", gestes: async (p) => { await onglet(p, "bank"); await clic(p, '[data-act="sverif"]'); await verifier(p, jeu.recaps[0].texte); } },
  ];
  if (jeu.nom !== "inventé") {
    // Jeu réel : quelques écrans seulement, sur la première semaine qui a un relevé.
    return communs.concat([{ nom: "semaine-41", gestes: (p) => allerSemaine(p, "2026-W41") }]);
  }
  const semaine = (n, titre) => ({ nom: `semaine-${n}-${titre}`, gestes: (p) => allerSemaine(p, `2026-W${n}`) });
  const reglage = (page) => ({ nom: `reglages-${page}`, gestes: async (p) => { await onglet(p, "set"); await clic(p, `[data-act="setp"][data-p="${page}"]`); } });
  return communs.concat([
    { nom: "semaine-courante-vide", gestes: async () => {} },
    { nom: "semaine-courante-remplie", gestes: remplir },
    { nom: "detail-d-un-jour", gestes: async (p) => { await remplir(p); await clic(p, '[data-act="openday"][data-i="1"]'); } },
    { nom: "apercu-de-la-fiche", gestes: async (p, ecran) => { await remplir(p); await clic(p, ecran === "pc" ? '[data-act="dmode"][data-m="1"]' : '[data-act="preview"]'); } },
    { nom: "ecran-d-envoi", gestes: async (p) => { await remplir(p); await clic(p, '[data-act="sendopen"]'); } },
    semaine("37", "envoyee"), semaine("38", "samedi"), semaine("39", "alertes"), semaine("40", "recup-posee"),
    semaine("41", "conges"), semaine("42", "absences"), semaine("43", "autres-heures"), semaine("44", "cas-limites"), semaine("47", "conges-prevus"),
    { nom: "reglages", gestes: (p) => onglet(p, "set") },
    reglage("profil"), reglage("dest"), reglage("horaires"), reglage("regles"), reglage("aff"), reglage("sync"), reglage("save"), reglage("news"),
  ]);
}

/**
 * Joue un scénario et photographie la page entière.
 * @returns {Promise<Buffer>} Image PNG.
 */
async function photographier(page, scenario, ecran) {
  await scenario.gestes(page, ecran);
  // Le petit message temporaire (« Lundi à vendredi remplis ») disparaît seul après 2,6 s : on l'enlève pour une photo stable.
  await page.evaluate(() => { const t = document.getElementById("toast"); if (t) t.remove(); });
  // Le navigateur de test dessine mal, au hasard, les cellules « collées » (position: sticky) d'un tableau qui défile :
  // la première colonne du Bilan perdait ou non ses bordures d'une page à l'autre. Sur une photo de la page entière,
  // « collé » ne veut rien dire : on le neutralise des deux côtés pour comparer ce qui compte.
  await page.addStyleTag({ content: ".btab th, .btab td { position: static !important; }" });
  // La souris est rangée dans le coin : sinon l'élément resté sous le pointeur peut s'afficher « survolé ».
  await page.mouse.move(0, 0);
  // On attend que l'affichage soit posé : deux photos de suite doivent être identiques
  // (une case qui finit de se cocher, une image qui finit de se décoder…).
  const photo = () => page.screenshot({ fullPage: true, animations: "disabled", caret: "hide" });
  let avant = await photo();
  for (let essai = 0; essai < 6; essai++) {
    await page.waitForTimeout(120);
    const apres = await photo();
    if (apres.equals(avant)) return apres;
    avant = apres;
  }
  return avant;
}

/**
 * Tolérance d'arrondi du navigateur.
 * Deux affichages strictement identiques peuvent différer d'un cran de couleur (1 sur 255) sur quelques
 * pixels de bord arrondi : c'est le moteur graphique, pas l'appli. On accepte donc au plus 2 crans d'écart
 * sur au plus 300 pixels (une page fait plus d'un million de pixels). Tout vrai changement — un texte,
 * une couleur, un décalage d'un pixel — dépasse très largement ces seuils.
 * La fiche envoyée, elle, est contrôlée sans aucune tolérance (test 2).
 */
const TOLERANCE = { ecartMax: 2, pixelsMax: 300 };

/**
 * Nombre de tentatives par écran.
 * Le navigateur de test dessine parfois mal, au hasard, les cellules « collées » d'un tableau qui défile
 * (première colonne du Bilan sur iPhone) : deux copies de la MÊME version peuvent alors donner deux photos
 * différentes, environ une fois sur quatre. Un écran n'est donc déclaré différent que s'il l'est à chaque
 * tentative. Un vrai changement de l'appli, lui, se voit à toutes les tentatives.
 */
const ESSAIS = 4;

let banc;
before(async () => { banc = await preparer(); });
after(async () => { await banc.fermer(); });

for (const jeu of jeux()) {
  // iPhone et PC dans les deux thèmes ; la fenêtre étroite en clair seulement (même code de couleurs).
  const vues = [["iphone", "light"], ["iphone", "dark"], ["pc", "light"], ["pc", "dark"], ["etroit", "light"]];
  for (const [ecran, theme] of vues) {
    test(`[${jeu.nom}] écrans identiques à la 0.10 — ${ecran}, thème ${theme === "dark" ? "sombre" : "clair"}`, async () => {
      const differences = [];
      for (const sc of scenarios(jeu)) {
        const o = { donnees: jeu.donnees, ecran, theme };
        const base = `ecran-${jeu.nom}-${ecran}-${theme}-${sc.nom}`;
        const voulu = CHANGEMENTS_VOULUS[sc.nom] || CHANGEMENTS_VOULUS["*"];
        let a, b, d;
        // Jusqu'à ESSAIS tentatives, chacune sur des pages neuves : voir le commentaire de ESSAIS.
        for (let essai = 1; essai <= ESSAIS; essai++) {
          const [ref, app] = await Promise.all([banc.ouvrirRef(o), banc.ouvrirApp(o)]);
          [a, b] = await Promise.all([photographier(ref, sc, ecran), photographier(app, sc, ecran)]);
          assert.deepStrictEqual(app.erreursFH, [], `erreur JavaScript pendant « ${sc.nom} »`);
          await Promise.all([ref.context().close(), app.context().close()]);
          d = await banc.comparer(a, b);
          if (d.memeTaille && d.max <= TOLERANCE.ecartMax && d.nb <= TOLERANCE.pixelsMax) { d = null; break; }
        }
        if (d) {
          if (peutGarder(jeu)) { garder(base + "-reference.png", a); garder(base + "-actuelle.png", b); }
          if (!voulu) differences.push(`${sc.nom} : ${d.memeTaille ? d.nb + " pixels différents " + d.zone + ", écart maximal " + d.max + "/255" : "taille de page " + d.zone}`);
        }
      }
      assert.deepStrictEqual(differences, [], "écrans qui ont changé sans que ce soit prévu (voir tests/resultats)");
    });
  }
}
