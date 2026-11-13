/* ACCESSIBILITÉ — usage au clavier et avec un lecteur d'écran (VoiceOver sur iPhone, par exemple).
 *
 * Trois choses, toutes invisibles à l'écran :
 *   1. Fenêtres (détail d'un jour, vue année, écran d'envoi) : à l'ouverture le focus entre dans la fenêtre,
 *      la touche Tab y reste enfermée, Échap la ferme, et à la fermeture le focus revient d'où il venait.
 *   2. Messages temporaires : ils sont aussi écrits dans une zone « annoncée » par les lecteurs d'écran.
 *   3. État d'une semaine : dit en toutes lettres (« Semaine 37, envoyée ») et non par la seule couleur.
 */
import { app } from "./etat.js";

/** Les fenêtres de l'appli portent toutes role="dialog". */
const FENETRE = '[role="dialog"]';
/** Ce qui peut recevoir le focus dans une fenêtre. */
const FOCUSABLES = 'button:not([disabled]), a[href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])';

/** Vrai si une fenêtre était ouverte au dernier affichage. */
let ouverte = false;
/** Sélecteur de l'élément qui avait le focus juste avant l'ouverture (pour le lui rendre). */
let origine = null;

/** Fenêtre actuellement ouverte (la dernière s'il y en a plusieurs), ou null. */
function fenetreOuverte() {
  const toutes = app.querySelectorAll(FENETRE);
  return toutes.length ? toutes[toutes.length - 1] : null;
}

/**
 * À appeler à la fin de chaque affichage (render).
 * @param {string|null} selecteurAvant Sélecteur de l'élément qui avait le focus avant le réaffichage.
 */
function soignerFocus(selecteurAvant) {
  const f = fenetreOuverte();
  if (f) {
    if (!ouverte) { ouverte = true; origine = selecteurAvant; }
    // Le focus va sur la fenêtre elle-même, pas sur son premier champ : sur iPhone, cela éviterait d'ouvrir le clavier.
    if (!f.contains(document.activeElement)) {
      f.setAttribute("tabindex", "-1");
      f.focus({ preventScroll: true });
    }
  } else if (ouverte) {
    ouverte = false;
    const retour = origine && [].slice.call(app.querySelectorAll(origine)).filter(function (x) { return x.offsetParent; })[0];
    origine = null;
    if (retour) retour.focus({ preventScroll: true });
  }
}

/* Clavier dans une fenêtre : Tab tourne en rond à l'intérieur, Échap ferme. */
document.addEventListener("keydown", function (e) {
  const f = fenetreOuverte();
  if (!f) return;
  if (e.key === "Escape") {
    // On passe par le même chemin qu'un clic sur le fond ou sur « Fermer ».
    const fermer = f.closest('[data-act="close"], [data-act="yclose"]') || f.querySelector('[data-act="sendclose"]');
    if (fermer) fermer.click();
    return;
  }
  if (e.key !== "Tab") return;
  const liste = [].slice.call(f.querySelectorAll(FOCUSABLES)).filter(function (x) { return x.offsetParent; });
  if (!liste.length) { e.preventDefault(); return; }
  const premier = liste[0], dernier = liste[liste.length - 1], actif = document.activeElement;
  if (e.shiftKey && (actif === premier || actif === f || !f.contains(actif))) { e.preventDefault(); dernier.focus(); }
  else if (!e.shiftKey && (actif === dernier || !f.contains(actif))) { e.preventDefault(); premier.focus(); }
});

/**
 * Fait lire un message par le lecteur d'écran, sans rien afficher.
 * La zone d'annonce est créée une fois pour toutes : un lecteur d'écran ne lit que les changements
 * d'une zone qu'il connaît déjà.
 */
function annoncer(message) {
  let zone = document.getElementById("annonces");
  if (!zone) {
    zone = document.createElement("div");
    zone.id = "annonces";
    zone.className = "lecteur";
    zone.setAttribute("role", "status");
    zone.setAttribute("aria-live", "polite");
    document.body.appendChild(zone);
  }
  zone.textContent = message || "";
}

/**
 * État d'une semaine en toutes lettres, pour l'attribut aria-label de sa case.
 * @param {number} numero Numéro de semaine. @param {string} etat "s" envoyée, "dr" brouillon, "" vide.
 * @param {boolean} [enCours] Vrai pour la semaine d'aujourd'hui.
 */
function libelleSemaine(numero, etat, enCours) {
  return "Semaine " + numero + ", " + (etat === "s" ? "envoyée" : etat === "dr" ? "brouillon" : "vide") + (enCours ? ", semaine en cours" : "");
}

export { soignerFocus, annoncer, libelleSemaine };
