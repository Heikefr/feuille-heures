/**
 * BANC D'ESSAI
 * ------------
 * Mise en place commune à tous les fichiers de test : un serveur local, un navigateur,
 * et de quoi ouvrir « la référence » et « la version en cours » avec les mêmes données.
 */
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { demarrer, DEPOT } = require("./serveur.js");
const { lancer, ouvrir } = require("./navigateur.js");

/** Dossier où sont rangées les images et rapports quand un test échoue (non publié). */
const RESULTATS = path.join(DEPOT, "tests", "resultats");

/**
 * Prépare le banc.
 * @returns {Promise<{ouvrirRef:Function, ouvrirApp:Function, fermer:Function}>}
 *   ouvrirRef(options) / ouvrirApp(options) : ouvrent la version 0.10 figée / la version en cours
 *   (mêmes options que navigateur.ouvrir) ; fermer() : arrête tout.
 */
async function preparer() {
  const serveur = await demarrer();
  const navigateur = await lancer();
  let atelier = null; // page vide servant uniquement à comparer des images
  return {
    ouvrirRef: (o) => ouvrir(navigateur, serveur.url + "/ref/", o),
    ouvrirApp: (o) => ouvrir(navigateur, serveur.url + "/app/", o),
    /**
     * Compare deux photos d'écran pixel par pixel.
     * @param {Buffer} a  Image PNG de référence.
     * @param {Buffer} b  Image PNG à contrôler.
     * @returns {Promise<{memeTaille:boolean, nb:number, max:number, zone:string}>}
     *   nb = nombre de pixels différents ; max = plus grand écart sur une couleur (0 à 255) ; zone = rectangle concerné.
     */
    comparer: async (a, b) => {
      if (a.equals(b)) return { memeTaille: true, nb: 0, max: 0, zone: "" };
      if (!atelier) atelier = await navigateur.newPage();
      const url = (x) => "data:image/png;base64," + x.toString("base64");
      return atelier.evaluate(async ([ua, ub]) => {
        const lire = async (u) => { const i = new Image(); i.src = u; await i.decode(); const c = document.createElement("canvas"); c.width = i.width; c.height = i.height; const x = c.getContext("2d"); x.drawImage(i, 0, 0); return x.getImageData(0, 0, i.width, i.height); };
        const A = await lire(ua), B = await lire(ub);
        if (A.width !== B.width || A.height !== B.height) return { memeTaille: false, nb: -1, max: 255, zone: A.width + "x" + A.height + " contre " + B.width + "x" + B.height };
        let nb = 0, max = 0, x0 = 1e9, y0 = 1e9, x1 = 0, y1 = 0;
        for (let i = 0; i < A.data.length; i += 4) {
          const d = Math.max(Math.abs(A.data[i] - B.data[i]), Math.abs(A.data[i + 1] - B.data[i + 1]), Math.abs(A.data[i + 2] - B.data[i + 2]));
          if (!d) continue;
          nb++; if (d > max) max = d;
          const px = (i / 4) % A.width, py = Math.floor(i / 4 / A.width);
          if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py;
        }
        return { memeTaille: true, nb, max, zone: nb ? `de (${x0},${y0}) à (${x1},${y1})` : "" };
      }, [url(a), url(b)]);
    },
    fermer: async () => { await navigateur.close(); await serveur.fermer(); },
  };
}

/**
 * Enregistre un fichier dans tests/resultats (créé au besoin).
 * @param {string} nom      Nom du fichier.
 * @param {Buffer|string} contenu
 * @returns {string} Chemin complet.
 */
function garder(nom, contenu) {
  fs.mkdirSync(RESULTATS, { recursive: true });
  const f = path.join(RESULTATS, nom.replace(/[^\w.\-]+/g, "_"));
  fs.writeFileSync(f, contenu);
  return f;
}

/**
 * Liste les endroits où deux résultats diffèrent, SANS afficher les valeurs.
 * Sert pour les vraies données : le journal des tests de GitHub est public, on n'y écrit donc
 * que l'emplacement de l'écart (ex. « semaines.2026-W41.hs »), jamais un nom, un matricule ou une heure.
 * @param {*} a        Résultat de référence.
 * @param {*} b        Résultat à contrôler.
 * @param {string} [chemin]
 * @returns {string[]} Emplacements différents (30 au plus).
 */
function ecarts(a, b, chemin = "") {
  const out = [];
  (function voir(x, y, c) {
    if (out.length >= 30) return;
    const objet = (v) => v !== null && typeof v === "object";
    if (objet(x) && objet(y)) { for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) voir(x[k], y[k], c ? c + "." + k : k); return; }
    if (x !== y) out.push(c || "(racine)");
  })(a, b, chemin);
  return out;
}

/** Vrai si l'on peut enregistrer des images de ce jeu de données (les vraies données ne le sont que sur demande, avec FH_GARDER_PRIVE=1). */
function peutGarder(jeu) { return jeu.nom === "inventé" || process.env.FH_GARDER_PRIVE === "1"; }

/** Convertit une image « data URL » en fichier binaire. */
function dataUrlVersBuffer(u) { return Buffer.from(u.split(",")[1], "base64"); }

module.exports = { preparer, garder, ecarts, peutGarder, dataUrlVersBuffer, RESULTATS };
