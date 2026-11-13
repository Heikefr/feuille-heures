/* ÉTAT — version, journal des nouveautés et état en mémoire de l'appli.
 *
 * Ce module ne dépend que des calculs : tous les autres peuvent l'importer sans risque de boucle.
 * L'objet S est l'unique « mémoire vive » de l'appli : ce qui est affiché, la semaine ouverte,
 * les données chargées. Seules S.settings et S.weeks sont enregistrées (voir stockage.js).
 */
import { defaultSettings, keyOf, mondayOf } from "./calculs.js";

/** Numéro de version affiché à l'utilisateur (Réglages › Nouveautés, menu PC). */
var VERSION = "0.10";

/**
 * Numéro de publication. Doit être identique à BUILD dans sw.js (vérifié par les tests) :
 * c'est son changement qui déclenche le bandeau « Nouvelle version prête ».
 */
var BUILD = "2026-11-13.1";

/**
 * Journal des nouveautés, de la plus récente à la plus ancienne : [version, date, [lignes]].
 * Affiché dans Réglages › Nouveautés.
 */
var CHANGELOG = [["0.10", "13/11/2026", ["Nouvel onglet Bilan : l'année mois par mois (heures travaillées, heures sup, nuit, primes, samedis, récup, congés, absences) et export Excel", "Coupures réseau : les modifications restent sur l'appareil, l'appli réessaie toute seule et les envoie dès le retour du réseau. L'état est affiché (« Hors ligne · 2 modif. en attente »)", "Plus rapide : l'aperçu de la fiche n'est redessiné que s'il change", "Données plus sûres : format numéroté, fichiers importés contrôlés, semaines illisibles écartées au lieu de bloquer l'appli"]], ["0.9", "13/11/2026", ["Envoi simplifié : un écran avec la fiche, les destinataires et un seul bouton « Copier la fiche et ouvrir Outlook ». La semaine n'est verrouillée qu'à ce moment-là", "Nouvelle disposition sur PC (grand écran) : menu à gauche avec mini-calendrier des semaines et rappels, semaine au centre, résumé et compteurs à droite", "Bouton « Aperçu de la fiche » : la vraie fiche à droite, mise à jour pendant la saisie", "Horaires types sur une seule ligne, aux couleurs des équipes", "Raccourcis clavier sur PC : flèches pour changer de semaine, Ctrl+Entrée pour envoyer, Ctrl+P pour l'aperçu", "Sur iPhone, rien ne change"]], ["0.8", "10/11/2026", ["Compteur CET : solde, « 105:00 sur 140:00 max », placements faits dans Pléiade retirés tout de suite du compteur d'origine", "Vérification des soldes : colle le récapitulatif des soldes de la compta, l'appli compare chaque compteur à la date du relevé et peut se recaler dessus", "Heure de récup ou de congé posée dans une journée : compte dans la présence (I2) mais pas dans les heures sup majorées (R125), comme la compta", "Vérification d'une semaine : « Heures sup payées » (R125/R150) et « Présence au-delà de 35 h » (I2) séparées"]], ["0.7", "06/11/2026", ["Vérification avec la compta : colle la page du logiciel (une ou plusieurs semaines), l'appli compare jour par jour et prépare le message en cas d'écart", "Coche ✓ (ou !) dans la vue année pour les semaines vérifiées", "Codes reconnus : G000, I9, I2, CP, CGPP, CPSUP, RHT, REC, JF, PANIE, PEQUI, RMNUI, R125 ; INDTR affiché pour information", "Heures à récupérer et congés posés dans une journée : comptés en entier, comme la compta", "Bouton « Vérifier » à la place de « Sauver » (sauvegarde automatique à chaque envoi)"]], ["0.6", "06/11/2026", ["Compteurs détaillés en heures et en jours : récup (remise à zéro au 1er janvier), congé principal, 5e semaine, fractionnement, ancienneté, congés supplémentaires", "En posant un congé, choix du compteur ; congés et récup retirés dès que la date est passée (prévus s'ils sont à venir)", "Message de fractionnement pour 5 jours de congé principal entre novembre et mai", "Rappels discrets : formulaire CET (avril, novembre) et récup à poser avant le 31/12", "Import de l'historique de l'ancien fichier Excel", "Fiche : case des heures de la semaine retirée ; semaine vide sans statut ; « Vider » efface aussi la note"]], ["0.5", "05/11/2026", ["Correctif : heures sup affichées jour par jour sur la fiche, case des heures à récupérer de la semaine, récup posée décomptée seulement si elle complète la journée, Matin 3 en 5h30 – 12h30 (accord), bouton Copier retiré", "Synchronisation iPhone ↔ PC par ton Google Sheet, protégée par un code d'accès", "Fiche envoyée en image, à l'identique de la fiche papier, avec observations automatiques", "Absences : « Heures à récupérer » et « Congé payé », heures partielles dans la journée et durée modifiable", "Note par semaine, bouton « Poser la semaine en congé payé » et appui long dans la vue année", "Prochaines échéances dans Compteur, avec ajout au Calendrier de l'iPhone", "Vue année : congés en bleu, notes et formations en violet, centrée sur PC", "Cases d'heure plus larges sur PC, Matin 3 jusqu'à 12:00 le vendredi", "Choix du calcul des heures sup : jour par jour ou à la semaine"]], ["0.4", "05/11/2026", ["Nouvel écran Semaine sur fond de fiche papier : horaire, arrivée et fin modifiables directement", "Grande grille complète sur PC, comme la fenêtre de saisie de l'ancien fichier", "Vue année pour aller à n'importe quelle semaine, avec l'état de chaque semaine", "Glisser le doigt à gauche ou à droite pour changer de semaine", "Réglages rangés comme sur iPhone, avec bouton pour rétablir les valeurs des accords", "Corrections du compteur et des congés repliées"]], ["0.3", "05/11/2026", ["Thème automatique, clair ou sombre dans Réglages", "Jours fériés préremplis (les fériés du week-end sont affichés pour information)", "Fiche au format de l'ancien fichier, copiée dans le corps du mail et ouverture d'Outlook avec destinataires et objet", "Heures sup affichées jour par jour sur la fiche (total calculé sur la semaine) et horaire théorique par horaire", "Gestionnaire de sauvegardes : liste, restauration, export, sauvegarde automatique", "Boutons de remplissage raccourcis (Matin 1, Soir 2…)"]], ["0.2", "04/11/2026", ["Samedi selon l'accord maintenance : heures hors seuil de 35 h, toutes à récupérer avec 50 % de majoration", "Samedi : primes panier, équipe et indemnité 3006 ajoutées dès 6 h de travail", "Alertes au-delà de 10 h par jour et 40 h par semaine", "Compteur de congés payés (heures et jours maison) avec correction du solde", "Nouveau type de journée : Jour maison"]], ["0.1", "04/11/2026", ["Première version autonome : saisie de la semaine, heures sup, heures de nuit, primes panier et équipe", "Compteur de récupération avec correction du solde", "Fiche Excel envoyée par le menu de partage (Mail)", "Sauvegarde et import des données, fonctionne hors connexion"]]];

/** Date du jour au démarrage de l'appli. (Figée tant que la page n'est pas rechargée.) */
var TODAY = /* @__PURE__ */ new Date();

/** Détecteur de grand écran : à partir de 1 280 px de large, disposition PC (menu à gauche, panneau à droite). */
var DMQ = window.matchMedia ? window.matchMedia("(min-width:1280px)") : { matches: false };

/**
 * État en mémoire.
 *   desk            vrai en disposition PC
 *   settings, weeks réglages et semaines (les seules données enregistrées)
 *   cur             semaine affichée (« AAAA-Wss »)
 *   tab             onglet : week, bank, bilan, set
 *   sheet           jour dont le détail est ouvert (0–6) ou null
 *   ready           vrai une fois le démarrage terminé
 *   toast           message temporaire affiché, ou null
 * D'autres champs s'ajoutent en cours de route : year (vue année), send (écran d'envoi), verif, fix,
 * setPage, confirm (bouton à confirmer), readErr (mode secours), etc.
 */
var S = { desk: DMQ.matches, settings: defaultSettings(keyOf(mondayOf(TODAY))), weeks: {}, cur: keyOf(mondayOf(TODAY)), tab: "week", sheet: null, db: null, ready: false, offline: false, lastExport: null, toast: null };

/** Élément de la page dans lequel toute l'appli est dessinée. */
var app = document.getElementById("app");

/**
 * Semaine demandée (par défaut la semaine affichée), créée vide si elle n'existe pas encore.
 * @param {string} [k] Clé « AAAA-Wss ».
 * @returns {{days:object[], obs:string, validated:boolean}}
 */
function week(k) {
  k = k || S.cur;
  if (!S.weeks[k]) S.weeks[k] = { days: [{}, {}, {}, {}, {}, {}, {}], obs: "", validated: false };
  return S.weeks[k];
}
export { BUILD, CHANGELOG, DMQ, S, TODAY, VERSION, app, week };
