/* MISE À JOUR — installe le fonctionnement hors ligne (sw.js) et annonce les nouvelles versions.
 *
 * Déroulement d'une mise à jour :
 *   1. Le navigateur trouve un sw.js différent sur le serveur et installe la nouvelle version à côté
 *      de l'actuelle (tous les fichiers d'un coup, voir sw.js). L'appli ouverte ne change pas.
 *   2. Ce module demande à la version en attente son numéro (BUILD) :
 *        - même numéro que la page affichée → la page est déjà à jour (c'est le cas au premier passage
 *          de la 0.10 à la 1.0) : la nouvelle version prend la main sans rien montrer ni recharger ;
 *        - numéro différent → bandeau « Nouvelle version prête » avec le bouton « Recharger ».
 *   3. Sur « Recharger », la version en attente prend la main et la page se recharge.
 *      Sans clic, elle prend la main toute seule au prochain démarrage de l'appli.
 */
import { BUILD } from "./etat.js";

/** Version installée qui attend le feu vert (objet ServiceWorker), ou null. */
let enAttente = null;
/** Vrai une fois que l'utilisateur a cliqué « Recharger » : le changement de version doit alors recharger la page. */
let rechargementDemande = false;

/**
 * À appeler une fois au démarrage. Sans effet si le navigateur ne gère pas le hors-ligne
 * ou si la page n'est pas servie en http(s) (fichier ouvert directement).
 */
function surveillerMisesAJour() {
  if (!("serviceWorker" in navigator) || location.protocol.indexOf("http") !== 0) return;
  // updateViaCache "none" : le navigateur va toujours chercher sw.js sur le serveur, jamais dans son cache.
  navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then(function (reg) {
    // Une version peut déjà attendre depuis une ouverture précédente.
    if (reg.waiting && navigator.serviceWorker.controller) examiner(reg.waiting);
    reg.addEventListener("updatefound", function () {
      const sw = reg.installing;
      if (!sw) return;
      sw.addEventListener("statechange", function () {
        // « installed » avec une version déjà aux commandes = nouvelle version en attente.
        // (Sans version aux commandes, c'est la toute première installation : rien à annoncer.)
        if (sw.state === "installed" && navigator.serviceWorker.controller) examiner(sw);
      });
    });
    // L'appli reste souvent ouverte plusieurs jours sur l'iPhone : on revérifie à chaque retour au premier plan.
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) reg.update().catch(function () {});
    });
  }).catch(function () {});
  navigator.serviceWorker.addEventListener("controllerchange", function () {
    if (rechargementDemande) location.reload();
  });
}

/**
 * Compare la version en attente à la page affichée et décide : activation discrète ou bandeau.
 * @param {ServiceWorker} sw Version installée, en attente.
 */
function examiner(sw) {
  let repondu = false;
  const canal = new MessageChannel();
  canal.port1.onmessage = function (e) {
    repondu = true;
    if (e.data && e.data.build === BUILD) sw.postMessage({ type: "activer" });
    else { enAttente = sw; afficherBandeau(); }
  };
  sw.postMessage({ type: "build" }, [canal.port2]);
  // Pas de réponse au bout de 3 s : dans le doute, on propose de recharger.
  setTimeout(function () { if (!repondu) { enAttente = sw; afficherBandeau(); } }, 3000);
}

/** Affiche le bandeau en haut de page (une seule fois). Il est hors de #app : les réaffichages de l'appli ne l'effacent pas. */
function afficherBandeau() {
  if (document.getElementById("maj")) return;
  const b = document.createElement("div");
  b.id = "maj";
  b.className = "majbar";
  b.setAttribute("role", "status");
  const texte = document.createElement("span");
  texte.textContent = "Nouvelle version prête.";
  const bouton = document.createElement("button");
  bouton.type = "button";
  bouton.className = "btn small primary";
  bouton.textContent = "Recharger";
  bouton.addEventListener("click", recharger);
  b.appendChild(texte);
  b.appendChild(bouton);
  document.body.insertBefore(b, document.body.firstChild);
}

/** Bouton « Recharger » : la version en attente prend la main, puis la page se recharge (controllerchange). */
function recharger() {
  rechargementDemande = true;
  if (enAttente) enAttente.postMessage({ type: "activer" });
  // Filet : si le changement de version n'arrive pas, on recharge quand même.
  setTimeout(function () { location.reload(); }, 3000);
}

export { surveillerMisesAJour };
