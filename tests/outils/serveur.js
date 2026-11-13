/**
 * SERVEUR DE TEST
 * ---------------
 * Petit serveur web local, sans dépendance, utilisé uniquement par les tests.
 * Il sert deux versions de l'appli côte à côte sur la même adresse :
 *
 *   /ref/…  → la version de référence figée (tests/reference/0.10)
 *   /app/…  → la version en cours de travail (racine du dépôt, ou FH_RACINE)
 *
 * Les tests ouvrent les deux, leur donnent exactement les mêmes données,
 * et vérifient qu'elles répondent exactement la même chose.
 */
"use strict";
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

/** Racine du dépôt. */
const DEPOT = path.resolve(__dirname, "..", "..");

/** Type MIME selon l'extension (uniquement ce que l'appli utilise). */
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

/**
 * Démarre le serveur sur un port libre.
 * @param {object} [options]
 * @param {string} [options.app]  Dossier de la version testée (défaut : variable FH_RACINE, sinon racine du dépôt).
 * @param {string} [options.ref]  Dossier de la version de référence.
 * @returns {Promise<{url:string, fermer:()=>Promise<void>}>} Adresse de base (sans « / » final) et fonction d'arrêt.
 */
function demarrer(options = {}) {
  const racines = {
    app: path.resolve(options.app || process.env.FH_RACINE || DEPOT),
    ref: path.resolve(options.ref || path.join(DEPOT, "tests", "reference", "0.10")),
  };
  const serveur = http.createServer((req, res) => {
    const chemin = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const m = chemin.match(/^\/(app|ref)(\/.*)?$/);
    if (!m) { res.writeHead(404).end("Inconnu"); return; }
    const racine = racines[m[1]];
    let fichier = path.join(racine, m[2] && m[2] !== "/" ? m[2] : "index.html");
    // Sécurité : on ne sort jamais du dossier servi.
    if (!fichier.startsWith(racine)) { res.writeHead(403).end("Interdit"); return; }
    fs.readFile(fichier, (err, contenu) => {
      if (err) { res.writeHead(404).end("Introuvable"); return; }
      res.writeHead(200, {
        "Content-Type": TYPES[path.extname(fichier)] || "application/octet-stream",
        "Cache-Control": "no-store",
      }).end(contenu);
    });
  });
  return new Promise((resolve) => {
    serveur.listen(0, "127.0.0.1", () => {
      resolve({
        url: "http://127.0.0.1:" + serveur.address().port,
        fermer: () => new Promise((r) => serveur.close(() => r())),
      });
    });
  });
}

module.exports = { demarrer, DEPOT };
