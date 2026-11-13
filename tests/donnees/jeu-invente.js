/**
 * JEU DE DONNÉES INVENTÉ
 * ----------------------
 * Semaines fictives, écrites à la main pour faire passer CHAQUE règle de calcul
 * au moins une fois. Aucune donnée réelle : ce fichier peut rester public.
 * (Les vraies semaines servent aussi aux tests, mais elles arrivent par un
 * « secret » GitHub et n'entrent jamais dans le dépôt — voir tests/README.md.)
 *
 * Toutes les heures sont en minutes depuis minuit (5h30 = 330), comme dans l'appli.
 * La date « du jour » des tests est fixée au vendredi 13/11/2026 (semaine 46).
 */
"use strict";

/* ---------- Petites fabriques de journées ---------- */

/** Horaires types de l'appli (mêmes valeurs que defaultSettings). `ven` = variante du vendredi. */
const HORAIRES = {
  m1: { team: "Matin", start: 300, end: 795, pause: 0, theo: 420 },   // 5h00 – 13h15
  m2: { team: "Matin", start: 360, end: 795, pause: 0, theo: 420 },   // 6h00 – 13h15
  m3: { team: "Matin", start: 330, end: 750, pause: 0, theo: 420 },   // 5h30 – 12h30
  s2: { team: "Soir", start: 730, end: 1165, pause: 0, theo: 435,     // 12h10 – 19h25
        ven: { start: 720, end: 1080, pause: 0, theo: 360 } },        //   vendredi 12h00 – 18h00
  s3: { team: "Soir", start: 765, end: 1215, pause: 0, theo: 420 },   // 12h45 – 20h15
  j:  { team: "Journée", start: 420, end: 930, pause: 60, theo: 450,  // 7h00 – 15h30, 1 h de pause
        ven: { start: 420, end: 720, pause: 0, theo: 300 } },         //   vendredi 7h00 – 12h00
};

/**
 * Journée sur un horaire type.
 * @param {string} id        Identifiant de l'horaire (m1, m2, m3, s2, s3, j).
 * @param {object} [plus]    Champs à remplacer ou ajouter (ex. { end: 810 }, { x: { recupH: 120 } }).
 * @param {boolean} [vendredi] Vrai pour appliquer la variante du vendredi.
 */
function h(id, plus = {}, vendredi = false) {
  const H = HORAIRES[id], v = vendredi && H.ven ? H.ven : H;
  return Object.assign({ type: "sch:" + id, label: "", team: H.team, start: v.start, end: v.end, pause: v.pause, theo: v.theo, x: {} }, plus);
}
/** Journée « Autre horaire ». */
function perso(team, start, end, plus = {}) {
  return Object.assign({ type: "perso", team, start, end, pause: 0, theo: 420, x: {} }, plus);
}
/** Journée d'absence (cp, c5, frac, anc, csup, recup, formation, ferie, maladie, greve, absence). */
function abs(type, plus = {}) { return Object.assign({ type, x: {} }, plus); }
/** Jour non renseigné / repos. */
const R = {};
/** Semaine complète. */
function sem(days, plus = {}) { return Object.assign({ days, obs: "", note: "", validated: true, sentAt: "01/01/2026 à 12:00" }, plus); }

/* ---------- Les semaines ---------- */

const weeks = {
  // Semaine à cheval sur 2025/2026 : lun–mer en 2025, jeudi 1er janvier férié, vendredi travaillé.
  "2026-W01": sem([h("s3"), h("s3"), h("s3"), abs("ferie", { auto: true }), h("s3"), R, R]),

  // Lundi de Pentecôte (25/05/2026) férié + 4 matins : 28 h travaillées + 7 h de férié = 35 h, aucune heure sup.
  "2026-W22": sem([abs("ferie", { auto: true }), h("m3"), h("m3"), h("m3"), h("m3"), R, R]),

  // Changement de période de congés au 1er juin : deux jours de congé principal sur la nouvelle période.
  "2026-W23": sem([abs("cp"), abs("cp"), h("m3"), h("m3"), h("m3"), R, R]),

  // Semaine pile à 35 h : 5 matins 5h30–12h30. Nuit avant 6 h = 0:30 par jour. Panier + équipe chaque jour.
  "2026-W36": sem([h("m3"), h("m3"), h("m3"), h("m3"), h("m3"), R, R]),

  // 5 soirs 12h45–20h15 = 37:30 → 2:30 d'heures sup à 25 %. Nuit après 20 h = 0:15 par jour.
  "2026-W37": sem([h("s3"), h("s3"), h("s3"), h("s3"), h("s3"), R, R]),

  // 5 matins 5h00–13h15 = 41:15 → 6:15 d'heures sup. Samedi 6h00–12h00 : hors seuil, majoré, indemnité 3006 (≥ 6 h).
  "2026-W38": sem([h("m1"), h("m1"), h("m1"), h("m1"), h("m1"), perso("Matin", 360, 720), R]),

  // Grosse semaine : lundi 11 h (alerte > 10 h/jour), puis 4 × 10 h = 51 h (alerte > 40 h).
  // 16 h d'heures sup : 8 h à 25 % puis 8 h à 50 %. Nuit 20h–22h chaque jour.
  "2026-W39": sem([perso("Soir", 660, 1320), perso("Soir", 720, 1320), perso("Soir", 720, 1320), perso("Soir", 720, 1320), perso("Soir", 720, 1320), R, R]),

  // Journée 7h00–15h30 avec pause. Lundi et jeudi : fin à 17h30 (2 h de plus chacun).
  // Mardi : départ à 13h30 + 2 h de récup posée. Mercredi : départ à 14h30 + 1 h de 5e semaine.
  // Règle importante : récup et congé posés comptent dans la présence (I2) mais PAS dans les heures sup majorées.
  //   travaillé 36:00 + 3:00 posées = 39:00 comptées → présence au-delà de 35 h = 4:00, heures sup majorées = 1:00 seulement.
  "2026-W40": sem([h("j", { end: 1050 }), h("j", { end: 810, x: { recupH: 120 } }), h("j", { end: 870, x: { congeH: 60, congeK: "c5" } }), h("j", { end: 1050 }), h("j", {}, true), R, R]),

  // Une absence de chaque compteur : congé principal, 5e semaine, fractionnement, ancienneté, congé supplémentaire.
  "2026-W41": sem([abs("cp"), abs("c5"), abs("frac"), abs("anc"), abs("csup"), R, R]),

  // Les autres absences : récup, formation, maladie, grève (journée), absence. Samedi court (3 h) : pas d'indemnité.
  "2026-W42": sem([abs("recup"), abs("formation"), abs("maladie"), abs("greve"), abs("absence"), perso("Matin", 480, 660), R]),

  // « Autres heures » de la fiche : grève en heures (retirée du travail), GA 10, élection, GA 20, GA 80, G001.
  // Observation de 8 lignes : la fiche n'en affiche que 6.
  "2026-W43": sem(
    [h("m2", { x: { greve: 60 } }), h("m2", { x: { ga10: 30 } }), h("m2", { x: { elec: 45 } }), h("m2", { x: { ga20: 60 } }), h("m2", { x: { ga80: 120, g001: 30 } }), R, R],
    { note: "Semaine chargée", obs: "Ligne 1\nLigne 2\nLigne 3\nLigne 4\nLigne 5\nLigne 6\nLigne 7\nLigne 8" }
  ),

  // Cas limites, FIGÉS tels qu'ils sont en 0.10 (décision : comportement strictement identique) :
  // arrivée = fin → 24 h ; champs vidés (0 et 0) → 24 h ; fin vidée ; poste à cheval sur minuit ;
  // demi-journée de congé (durée 3:30) ; dimanche travaillé (compte comme un jour de semaine).
  // Semaine laissée en brouillon.
  "2026-W44": sem(
    [perso("Matin", 360, 360), perso("Matin", 0, 0), h("m3", { end: 0 }), perso("Soir", 1200, 240), abs("cp", { dur: 210 }), R, perso("Matin", 360, 780)],
    { validated: false, sentAt: undefined }
  ),

  // Soir 12h10–19h25 (théorique 7h15) avec variante du vendredi 12h00–18h00.
  "2026-W45": sem([h("s2"), h("s2"), h("s2"), h("s2"), h("s2", {}, true), R, R]),

  // (La semaine 46, semaine « courante » des tests, est volontairement absente : l'appli doit la créer
  //  et préremplir le férié du mercredi 11 novembre.)

  // Congés à venir : comptés en « prévu », pas en « pris ».
  "2026-W47": sem([abs("cp"), abs("cp"), abs("cp"), abs("cp"), abs("cp"), R, R], { validated: false, sentAt: undefined, note: "Vacances" }),

  // Formation à venir (échéances, vue année en violet).
  "2026-W50": sem([h("m3"), abs("formation"), abs("formation"), h("m3"), h("m3"), R, R], { validated: false, sentAt: undefined, note: "Formation habilitation" }),

  // Dernière semaine ISO de 2026 (S53) : son jeudi est le 31/12/2026, le vendredi 1er janvier 2027 est férié.
  "2026-W53": sem([h("m3"), h("m3"), h("m3"), h("m3"), abs("ferie", { auto: true }), R, R]),
};

/* ---------- Réglages : profil fictif + compteurs de départ ---------- */

/** Instant (millisecondes) du lendemain minuit d'une date AAAA-MM-JJ, heure de Paris : même convention que l'appli (refT). */
function lendemain(ymd) { const [y, m, d] = ymd.split("-").map(Number); return new Date(y, m - 1, d + 1).getTime(); }

const settings = {
  profil: { nom: "Durand Camille", matricule: "00000000", poste: "Technicien", site: "Site d'essai" },
  mails: { paye: "paye1@example.com;paye2@example.com", resp: "responsable@example.com", ccResp: true },
  cpt: {
    // Relevé fictif au 31/08/2026 : les semaines validées à partir de la S36 s'ajoutent à la récup acquise.
    recup: { year: 2026, acq: 3000, pris: 600, ref: "2026-08-31", from: "2026-W36" },
    cp: { per: "2026-06-01", acq: 8400, pris: 2100, ref: "2026-08-31" },
    c5: { per: "2026-06-01", acq: 2100, pris: 0, ref: "2026-08-31" },
    // Fractionnement : 2 jours déjà crédités par l'appli (adds) pour la période en cours.
    frac: { per: "2026-06-01", acq: 0, pris: 0, ref: "2026-08-31", adds: [{ id: "2026-01-05", per: "2026-06-01", min: 840 }], done: ["2026-01-05"] },
    anc: { per: "2026-06-01", acq: 1, pris: 0, ref: "2026-08-31" },
    csup: { per: "2026-06-01", acq: 3, pris: 0, ref: "2026-08-31" },
    cpacq: 4375,
    // CET : solde relevé au 31/08, puis deux placements « Pléiade » (un en heures, un en jours).
    cet: {
      solde: 2100, ref: "2026-08-31", refT: lendemain("2026-08-31"),
      moves: [
        { id: "mv1", t: new Date(2026, 9, 15, 9, 0).getTime(), date: "2026-10-15", src: "recup", qty: 420, min: 420 },
        { id: "mv2", t: new Date(2026, 10, 5, 9, 0).getTime(), date: "2026-11-05", src: "anc", qty: 0.5, min: 210 },
      ],
    },
  },
};

/* ---------- Textes « compta » inventés (même mise en page que le vrai logiciel) ---------- */

/** Bloc d'une journée de relevé. */
function jourCompta(lignes) { return ["MMD01", "13:00 − 20:00", " ", ...lignes, " "].join("\n"); }

/** Relevé de la semaine 37 (5 soirs 12h45–20h15) : doit correspondre à l'appli sans aucun écart. */
const releveS37 = [
  " ", "07/09/2026", "Du\t07/09/2026\tau\t13/09/2026", "",
  "Type\tLun. 07/09\tMar. 08/09\tMer. 09/09\tJeu. 10/09\tVen. 11/09\tSam. 12/09\tDim. 13/09",
  "Théorique", "Activités", "Présences", "Absences", "Indicateurs",
  jourCompta(["G000 07:30", " ", "I9 00:15"]), jourCompta(["G000 07:30", " ", "I9 00:15"]), jourCompta(["G000 07:30", " ", "I9 00:15"]),
  jourCompta(["G000 07:30", " ", "I9 00:15"]), jourCompta(["G000 07:30", " ", "I9 00:15"]),
  "RH", " ", "RH", " ", "I2 02:30", " ",
  "Jours\tLun. 07/09\tMar. 08/09\tMer. 09/09\tJeu. 10/09\tVen. 11/09\tSam. 12/09\tDim. 13/09\t",
  "Théorique", "35:00\t07:00\t07:00\t07:00\t07:00\t07:00\t00:00\t00:00\t",
  "Réalisé", "37:30\t07:30\t07:30\t07:30\t07:30\t07:30\t00:00\t00:00\t",
  "Ecart", "02:30\t00:30\t00:30\t00:30\t00:30\t00:30\t00:00\t00:00\t",
  "EVP\t",
  "PANIE 1.00", "PEQUI 1.00", "RMNUI 00:15", "PANIE 1.00", "PEQUI 1.00", "RMNUI 00:15", "PANIE 1.00", "PEQUI 1.00", "RMNUI 00:15",
  "PANIE 1.00", "PEQUI 1.00", "RMNUI 00:15", "PANIE 1.00", "PEQUI 1.00", "RMNUI 00:15", " ", "R125 03:07", "",
].join("\n");

/** Relevé de la semaine 41 (5 absences) avec un écart voulu : la compta dit « récup » le lundi, l'appli « congé ». */
const releveS41 = [
  " ", "05/10/2026", "Du\t05/10/2026\tau\t11/10/2026", "",
  "Type\tLun. 05/10\tMar. 06/10\tMer. 07/10\tJeu. 08/10\tVen. 09/10\tSam. 10/10\tDim. 11/10",
  "Théorique", "Activités", "Présences", "Absences", "Indicateurs",
  "MM700\n07:00 − 11:30\n13:30 − 16:00\n \nRHT 07:00\n ", "MM700\n07:00 − 11:30\n13:30 − 16:00\n \nCP 07:00\n ",
  "MM700\n07:00 − 11:30\n13:30 − 16:00\n \nCP 07:00\n ", "MM700\n07:00 − 11:30\n13:30 − 16:00\n \nANC 07:00\n ",
  "MM700\n07:00 − 11:30\n13:30 − 16:00\n \nCPSUP 07:00\n ", "RH", " ", "RH", " ",
  "Jours\tLun. 05/10\tMar. 06/10\tMer. 07/10\tJeu. 08/10\tVen. 09/10\tSam. 10/10\tDim. 11/10\t",
  "Théorique", "35:00\t07:00\t07:00\t07:00\t07:00\t07:00\t00:00\t00:00\t",
  "Réalisé", "35:00\t07:00\t07:00\t07:00\t07:00\t07:00\t00:00\t00:00\t",
  "Ecart", "00:00\t00:00\t00:00\t00:00\t00:00\t00:00\t00:00\t00:00\t",
  "EVP\t", "INDTR 0.25", "",
].join("\n");

/** Récapitulatif des soldes fictif au 13/11/2026 (chiffres arbitraires : certains correspondent, d'autres non). */
const recapSoldes = [
  "13/11/2026", "Du\t13/11/2026\tau\t13/11/2026", "Récapitulatif des soldes\t", " \t",
  " \tAcquis\tPris\tPrévu\tSolde",
  "Congés payés acquis du 01/06/2026 au 31/05/2027\t140:00\t45:30\t35:00\t59:30",
  "Congés payés 5ème semaine du 01/06/2026 au 31/05/2027\t35:00\t8:00\t \t27:00",
  "TOTAL CP ACQUIS\t175:00\t53:30\t35:00\t86:30",
  "Congés ancienneté du 01/06/2026 au 31/05/2027\t1,00\t1,50\t \t-0,50",
  "TOTAL Autres CP\t1,00\t1,50\t\t-0,50",
  "Congés supplémentaires du 01/06/2026 au 31/05/2027\t3,00\t1,00\t \t2,00",
  "TOT. AUTRES DROITS JOURS\t3,00\t1,00\t\t2,00",
  "CP en cours acquisition\t72:55\t \t \t72:55",
  "Heures à récupérer du 01/01/2026 au 31/12/2026\t120:00\t30:00\t \t90:00",
  "",
].join("\n");

module.exports = {
  nom: "inventé",
  /** Contenu à placer dans le stockage de l'appli (même format qu'une sauvegarde). */
  donnees: { app: "feuille-heures", format: 2, settings, weeks },
  /** Relevés de semaines à coller dans « Vérifier ». */
  releves: [{ nom: "S37 sans écart", texte: releveS37 }, { nom: "S41 avec écart", texte: releveS41 }],
  /** Récapitulatifs des soldes à coller dans « Vérifier ». */
  recaps: [{ nom: "soldes au 13/11", texte: recapSoldes }],
};
