/**
 * SONDES
 * ------
 * Fonctions exécutées DANS la page de l'appli pour lui faire recalculer tout ce qui compte,
 * et rapporter le résultat sous forme de données comparables.
 *
 * La même sonde est lancée sur la version de référence (0.10) et sur la version en cours :
 * les deux rapports doivent être strictement égaux.
 *
 * Accès aux fonctions de l'appli : en 0.10 ce sont des variables globales (window.weekCalc…).
 * Quand le code sera découpé en modules, l'appli exposera les mêmes fonctions dans `window.__fh`
 * (réservé aux tests) ; la ligne `const fh = window.__fh || window` gère les deux cas.
 *
 * ATTENTION : ces fonctions sont envoyées telles quelles au navigateur. Elles ne peuvent donc
 * utiliser que leur argument, pas les variables de ce fichier.
 */
"use strict";

/**
 * Calculs : chaque semaine, les compteurs à plusieurs dates, le solde de récup, le bilan annuel.
 * @param {{dates:string[], annees:number[]}} p  Dates (AAAA-MM-JJ) auxquelles évaluer les compteurs, années du bilan.
 * @returns {object} Rapport sérialisable.
 */
function sondeCalculs(p) {
  const fh = window.__fh || window, S = fh.S, r = { semaines: {}, compteurs: {}, bilans: {} };
  // JSON aller-retour : transforme NaN/undefined de façon identique des deux côtés.
  const net = (v) => JSON.parse(JSON.stringify(v));
  Object.keys(S.weeks).sort().forEach((k) => { r.semaines[k] = net(fh.weekCalc(S.weeks[k], S.settings)); });
  p.dates.forEach((d) => { const [y, m, j] = d.split("-").map(Number); r.compteurs[d] = net(fh.counters(S.settings, S.weeks, new Date(y, m - 1, j))); });
  r.solde = net(fh.soldeCalc(S.settings, S.weeks));
  p.annees.forEach((y) => { r.bilans[y] = net(fh.bilanData(y)); });
  return r;
}

/**
 * Vérification compta : analyse des textes collés et comparaison avec l'appli.
 * @param {{releves:{nom:string,texte:string}[], recaps:{nom:string,texte:string}[]}} p
 * @returns {object} Pour chaque relevé : ce que l'appli a compris (analyse) et le résultat de la comparaison.
 */
function sondeCompta(p) {
  const fh = window.__fh || window, S = fh.S, r = { releves: {}, recaps: {} };
  const net = (v) => JSON.parse(JSON.stringify(v));
  p.releves.forEach((x) => {
    const analyse = fh.parseCompta(x.texte);
    r.releves[x.nom] = analyse.map((P) => ({
      analyse: net(P),
      comparaison: S.weeks[P.key] ? net(fh.compareCompta(S.weeks[P.key], S.settings, P)) : "semaine absente",
    }));
  });
  p.recaps.forEach((x) => {
    const P = fh.parseSoldes(x.texte);
    r.recaps[x.nom] = P ? { analyse: net(P), comparaison: net(fh.compareSoldes(P)) } : "non reconnu";
  });
  return r;
}

/**
 * Fiche envoyée au service paye : contenu (texte de chaque case) et empreinte des pixels de l'image.
 * Deux images qui ont la même empreinte sont identiques pixel pour pixel.
 * @param {{echelles:number[]}} p  Échelles de dessin à contrôler (2 = aperçu ; 0.9, 1.2, 1.5, 2 = tailles d'envoi).
 * @returns {Promise<object>} Par semaine : { contenu, empreintes:{échelle:empreinte} }.
 */
async function sondeFiches(p) {
  const fh = window.__fh || window, S = fh.S, r = {};
  const empreinte = async (cv) => {
    const px = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
    const h = await crypto.subtle.digest("SHA-256", px);
    return cv.width + "x" + cv.height + ":" + Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join("");
  };
  for (const k of Object.keys(S.weeks).sort()) {
    S.cur = k; // la fiche se dessine pour la semaine affichée
    const w = S.weeks[k], c = fh.weekCalc(w, S.settings);
    const e = {};
    for (const sc of p.echelles) e[sc] = await empreinte(fh.ficheCanvas(w, c, S.settings, sc));
    r[k] = { contenu: JSON.parse(JSON.stringify(fh.ficheData(w, c, S.settings))), empreintes: e };
  }
  return r;
}

/**
 * Image d'une fiche, pour l'enregistrer quand un test échoue (afin de voir la différence).
 * @param {{semaine:string, echelle:number}} p
 * @returns {string} Image PNG en « data URL ».
 */
function imageFiche(p) {
  const fh = window.__fh || window, S = fh.S;
  S.cur = p.semaine;
  const w = S.weeks[p.semaine];
  return fh.ficheCanvas(w, fh.weekCalc(w, S.settings), S.settings, p.echelle).toDataURL("image/png");
}

module.exports = { sondeCalculs, sondeCompta, sondeFiches, imageFiche };
