/* APPAREIL — préférences propres à CET appareil : thème et taille de la fiche dans le mail.
 *
 * Jusqu'à la 0.10, ces deux choix étaient rangés dans les réglages synchronisés. Or les réglages partent
 * d'un bloc : changer le thème sur le PC pouvait écraser un placement CET saisi sur l'iPhone et pas encore
 * synchronisé. Depuis la 1.0, ils sont enregistrés à part, sur l'appareil, et ne sont plus synchronisés.
 * Tant qu'un appareil n'a rien choisi, il garde ce qui était dans les réglages (reprise sans rien perdre).
 */

/** Clé de stockage des préférences de l'appareil : { theme, ficheT }. */
const CLE_APPAREIL = "feuille-heures-appareil";

/** Lit toutes les préférences de l'appareil ({} si aucune, ou si le stockage est inaccessible). */
function lirePrefs() {
  try { return JSON.parse(localStorage.getItem(CLE_APPAREIL)) || {}; } catch (e) { return {}; }
}

/**
 * Préférence de l'appareil.
 * @param {"theme"|"ficheT"} nom
 * @returns {string|undefined} undefined si l'appareil n'a encore rien choisi.
 */
function prefAppareil(nom) {
  return lirePrefs()[nom];
}

/**
 * Enregistre une préférence de l'appareil (sans toucher aux réglages synchronisés).
 * @param {"theme"|"ficheT"} nom
 * @param {string} valeur
 */
function definirPrefAppareil(nom, valeur) {
  const prefs = lirePrefs();
  prefs[nom] = valeur;
  try { localStorage.setItem(CLE_APPAREIL, JSON.stringify(prefs)); } catch (e) { /* stockage plein : le choix vaudra jusqu'à la fermeture */ }
}

export { prefAppareil, definirPrefAppareil };
