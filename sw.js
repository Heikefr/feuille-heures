/**
 * FEUILLE D'HEURES — fonctionnement hors connexion (service worker)
 * -----------------------------------------------------------------
 * Ce fichier tourne en arrière-plan dans le navigateur. Il garde une copie de tous les fichiers de
 * l'appli pour qu'elle démarre sans réseau, et il gère le passage d'une version à la suivante.
 *
 * Principe : une version = un bloc.
 *   - À l'installation, TOUS les fichiers de la version sont téléchargés dans un cache qui porte son
 *     numéro (BUILD). Si un seul téléchargement échoue, rien n'est installé et l'ancienne version reste
 *     en place : on ne peut jamais se retrouver avec un mélange d'ancien et de nouveau.
 *   - Ensuite l'appli est toujours servie depuis ce cache (rapide, et identique avec ou sans réseau).
 *   - Quand une nouvelle version est publiée, elle s'installe à côté et ATTEND. L'appli affiche alors
 *     le bandeau « Nouvelle version prête » ; elle ne bascule que sur « Recharger », ou au prochain
 *     démarrage de l'appli. Voir js/mise-a-jour.js.
 *
 * À CHAQUE PUBLICATION : changer BUILD ici ET dans js/etat.js (un test vérifie qu'ils sont égaux),
 * et tenir la liste FICHIERS à jour (un test vérifie qu'aucun fichier n'est oublié).
 */

/** Numéro de la version publiée. Doit être identique à BUILD dans js/etat.js. */
const BUILD = "1.0";

/** Cache de cette version (un par version : l'ancien est supprimé quand la nouvelle prend la main). */
const CACHE = "feuille-heures-" + BUILD;

/** Cache des ressources venues d'ailleurs (polices Google, module Excel). Conservé d'une version à l'autre. */
const CACHE_EXTERNE = "feuille-heures-externe";

/** Tous les fichiers de l'appli. "./" est la page elle-même. */
const FICHIERS = ["./", "./index.html", "./css/style.css",
  "./js/accessibilite.js", "./js/actions.js", "./js/app.js", "./js/appareil.js", "./js/calculs.js", "./js/compta.js", "./js/compteurs.js", "./js/ecran-bilan.js",
  "./js/ecran-compteurs.js", "./js/ecran-envoi.js", "./js/ecran-reglages.js", "./js/ecran-rendu.js", "./js/ecran-semaine.js",
  "./js/ecran-verification.js", "./js/etat.js", "./js/excel.js", "./js/fiche.js", "./js/mise-a-jour.js", "./js/outils.js",
  "./js/sauvegardes.js", "./js/secours.js", "./js/stockage.js", "./js/synchro.js",
  "./manifest.webmanifest", "./icon-180.png", "./icon-192.png", "./icon-512.png"];

/** Module Excel (version fixe), gardé hors ligne si possible. */
const EXCEL = "https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js";

/* Installation : télécharge tout le bloc. `cache: "reload"` oblige à reprendre les fichiers sur le serveur
   plutôt que dans le cache ordinaire du navigateur (GitHub Pages autorise 10 minutes de cache). */
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(FICHIERS.map((f) => new Request(f, { cache: "reload" }))))
      // Le module Excel est un plus : son absence n'empêche pas l'installation.
      .then(() => caches.open(CACHE_EXTERNE).then((c) => c.match(EXCEL).then((deja) => deja || c.add(EXCEL))).catch(() => {}))
  );
  // Pas de skipWaiting ici : la nouvelle version attend le feu vert de l'appli (message « activer »).
});

/* Activation : cette version prend la main ; les caches des versions précédentes sont supprimés. */
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((cles) => Promise.all(cles.filter((k) => k !== CACHE && k !== CACHE_EXTERNE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Messages venus de l'appli (js/mise-a-jour.js) :
     « build »   → répond avec le numéro de cette version ;
     « activer » → cette version, installée et en attente, prend la main tout de suite. */
self.addEventListener("message", (e) => {
  const type = e.data && e.data.type;
  if (type === "build" && e.ports[0]) e.ports[0].postMessage({ build: BUILD });
  if (type === "activer") self.skipWaiting();
});

/* Réponse aux demandes de fichiers. */
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return; // la synchro (POST vers Google) ne passe jamais par le cache
  const url = new URL(req.url);

  if (url.origin === location.origin) {
    // Fichiers de l'appli : toujours le bloc en cache. L'ouverture de la page (y compris par le lien de
    // connexion « ?api=…&cle=… ») reçoit index.html. Ce qui n'est pas dans le bloc est pris sur le réseau.
    e.respondWith(
      caches.open(CACHE).then((c) =>
        (req.mode === "navigate" ? c.match("./index.html") : c.match(req)).then((trouve) => trouve || fetch(req))
      )
    );
  } else if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname) || url.href === EXCEL) {
    // Polices et module Excel : cache d'abord, sinon réseau puis mise en cache.
    e.respondWith(
      caches.open(CACHE_EXTERNE).then((c) =>
        c.match(req).then((trouve) => trouve || fetch(req).then((res) => { c.put(req, res.clone()); return res; }))
      )
    );
  }
  // Tout le reste (script Google de synchro) : le navigateur fait comme d'habitude.
});
