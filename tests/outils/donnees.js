/**
 * CHARGEMENT DES JEUX DE DONNÉES DE TEST
 * --------------------------------------
 * Deux jeux :
 *   1. « inventé »  : toujours présent, public (tests/donnees/jeu-invente.js).
 *   2. « réel »     : l'historique et les relevés de la vraie compta. Il n'est JAMAIS dans le dépôt.
 *                     Il arrive par l'une de ces deux variables d'environnement :
 *        - FH_DONNEES_PRIVEES : le paquet compressé (texte base64) — c'est le « secret » de GitHub Actions ;
 *        - FH_DOSSIER_PRIVE   : sur un PC, le dossier qui contient les fichiers d'origine.
 *                     Sans l'une des deux, les tests « réels » sont simplement sautés.
 */
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

/**
 * Transforme le dossier des fichiers personnels en jeu de données.
 * Fichiers reconnus par leur nom : *historique*.json, *profil*.json, *releve-compta*.txt, *recap-soldes*.txt.
 * @param {string} dossier
 * @returns {object} Jeu de données (même forme que jeu-invente.js).
 */
function lireDossierPrive(dossier) {
  const fichiers = fs.readdirSync(dossier);
  const lire = (f) => fs.readFileSync(path.join(dossier, f), "utf8");
  const trouver = (motif) => fichiers.filter((f) => f.includes(motif)).sort();
  const historique = JSON.parse(lire(trouver("historique")[0]));
  const profilF = trouver("profil")[0];
  const profil = profilF ? JSON.parse(lire(profilF)).settings || {} : {};
  return {
    nom: "réel",
    donnees: {
      app: "feuille-heures", format: 2,
      // Comme dans l'appli : profil importé, puis compteurs de l'historique.
      settings: { profil: profil.profil, mails: profil.mails, cpt: historique.cpt },
      weeks: historique.weeks,
    },
    releves: trouver("releve-compta").map((f) => ({ nom: f.replace(/^.*releve-compta-|\.txt$/g, ""), texte: lire(f) })),
    recaps: trouver("recap-soldes").map((f) => ({ nom: f.replace(/^.*recap-soldes-|\.txt$/g, ""), texte: lire(f) })),
  };
}

/** Compresse un jeu de données en texte base64 (pour le coller dans un secret GitHub). */
function emballer(jeu) { return zlib.gzipSync(Buffer.from(JSON.stringify(jeu), "utf8"), { level: 9 }).toString("base64"); }
/** Opération inverse de emballer(). */
function deballer(texte) { return JSON.parse(zlib.gunzipSync(Buffer.from(texte.trim(), "base64")).toString("utf8")); }

/**
 * Liste des jeux de données disponibles pour cette exécution.
 * @returns {object[]} Toujours le jeu inventé ; le jeu réel en plus s'il est fourni.
 */
function jeux() {
  const liste = [require("../donnees/jeu-invente.js")];
  if (process.env.FH_DONNEES_PRIVEES) liste.push(deballer(process.env.FH_DONNEES_PRIVEES));
  else if (process.env.FH_DOSSIER_PRIVE) liste.push(lireDossierPrive(process.env.FH_DOSSIER_PRIVE));
  return liste;
}

module.exports = { jeux, lireDossierPrive, emballer, deballer };

/* Utilisation en ligne de commande, pour fabriquer le secret :
     node tests/outils/donnees.js emballer <dossier des fichiers personnels>  > paquet.prive.txt            */
if (require.main === module && process.argv[2] === "emballer") {
  process.stdout.write(emballer(lireDossierPrive(process.argv[3])));
}
