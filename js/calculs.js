/* CALCULS — heures travaillées, heures supplémentaires, nuit, primes, samedi, jours fériés, semaines ISO.
 *
 * Fonctions « pures » : elles ne lisent ni l'écran ni le stockage, seulement leurs paramètres.
 * Toute l'appli (écrans, fiche, compteurs, vérification compta, exports) passe par ici.
 *
 * Unités : toutes les durées et toutes les heures de la journée sont en MINUTES
 * (7 h = 420 ; 5h30 du matin = 330 ; 20h15 = 1215).
 *
 * Sources des règles : accords d'établissement MHCS de 2010 et accord ARTT, tels que décrits par
 * l'utilisateur et contrôlés sur les relevés du logiciel de la compta (les numéros d'articles ne sont
 * pas repris ici). Les seuils et taux sont dans les réglages (regles) et modifiables dans l'appli ;
 * les valeurs par défaut ci-dessous sont celles des accords.
 *
 * IMPORTANT : les résultats de ce fichier sont figés par les tests (tests/1-calculs.test.js) :
 * ils doivent rester identiques à la version 0.10, à la minute près, y compris dans les cas limites.
 */

/* ============================================================================================
 *  Libellés
 * ========================================================================================== */

/** Jours de la semaine, abrégés (indice 0 = lundi … 6 = dimanche). */
const DAYN = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
/** Jours de la semaine, en entier. */
const DAYL = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

/** Types d'absence d'une journée entière : code enregistré → libellé affiché. */
const ABS = {
  cp: "Congé principal", c5: "5e semaine", frac: "Fractionnement", anc: "Ancienneté", csup: "Congé supplémentaire",
  recup: "Heures à récupérer", formation: "Formation", ferie: "Férié", maladie: "Maladie", greve: "Grève", absence: "Absence",
};
/** Libellés courts (cases de la fiche, grille PC). « conge » et « cjour » sont d'anciens codes d'avant la 0.6. */
const ABSC = {
  cp: "Congé", c5: "5e sem.", frac: "Fract.", anc: "Ancien.", csup: "C. supp.", recup: "Récup", formation: "Form.",
  ferie: "Férié", maladie: "Maladie", greve: "Grève", absence: "Abs.", conge: "Congé", cjour: "C. supp.",
};
/** Congés comptés en HEURES (congé principal, 5e semaine, fractionnement). */
const CONGE_H = { cp: 1, c5: 1, frac: 1, conge: 1 };
/** Congés comptés en JOURS (ancienneté, congés supplémentaires). */
const CONGE_J = { anc: 1, csup: 1, cjour: 1 };
/** Absences reliées à un compteur, dans l'ordre du menu de choix. */
const CPT_KEYS = ["cp", "c5", "frac", "anc", "csup", "recup"];
/**
 * « Autres heures » d'une journée : [code enregistré dans jour.x, libellé de saisie, libellé de la fiche].
 * La grève en heures est retirée du temps travaillé ; les autres lignes sont seulement reportées sur la fiche.
 */
const EXTRAS = [
  ["greve", "Grève (heures)", "Grève AN"],
  ["ga10", "Informations syndicales", "Informations syndicales (GA 10)"],
  ["elec", "Élection délégué personnel CE", "Election Délégué Personnel CE"],
  ["ga20", "Heure de réunion", "Heure de Réunion (GA 20)"],
  ["ga80", "Crédit d'heures", "Crédit d'heures (GA 80)"],
  ["g001", "Réunion info vœux", "Réunion Info vœux (G001)"],
];

/* ============================================================================================
 *  Réglages par défaut (valeurs des accords)
 * ========================================================================================== */

/**
 * Réglages d'une appli neuve.
 * @param {string} [curKey]  Semaine courante (« AAAA-Wss »), point de départ des anciens compteurs.
 * @returns {object} Réglages complets. Les réglages enregistrés viennent se poser par-dessus (voir stockage.js).
 */
function defaultSettings(curKey) {
  return {
    // Identité : vide dans le dépôt public, remplie par l'import du fichier profil ou dans Réglages.
    profil: { nom: "", matricule: "", poste: "", site: "" },
    mails: { paye: "", resp: "", ccResp: true },
    regles: {
      seuil: 2100,      // 35 h : seuil hebdomadaire des heures sup (accord ARTT)
      palier: 480,      // les 8 premières heures sup…
      taux1: 25,        // …sont majorées de 25 %
      taux2: 50,        // les suivantes de 50 %
      nuit: 100,        // majoration des heures de nuit (%)
      nuitDebut: 360,   // nuit AVANT 6 h…
      nuitFin: 1200,    // …et APRÈS 20 h
      panierMin: 360,   // primes panier + équipe à partir de 6 h de travail
      samTaux: 50,      // majoration du samedi (%)
      maxJour: 600,     // alerte au-delà de 10 h dans la journée
      maxSem: 2400,     // alerte au-delà de 40 h dans la semaine
      hsMode: "recup",  // heures sup « à récupérer » (compteur) ou « payer »
      hsCalc: "semaine",// calcul à la semaine (accord) ou « jour » par jour (ancien fichier Excel)
    },
    // Durée comptée pour une journée d'absence, par type (7 h, sauf grève et absence : 0).
    comptes: { cp: 420, c5: 420, frac: 420, anc: 420, csup: 420, recup: 420, formation: 420, ferie: 420, maladie: 420, greve: 0, absence: 0 },
    // Horaires types. theo = durée théorique ; fri = variante du vendredi (null s'il n'y en a pas).
    horaires: [
      { id: "m1", label: "", team: "Matin", start: 300, end: 795, pause: 0, theo: 420, fri: null },   // 5h00 – 13h15
      { id: "m2", label: "", team: "Matin", start: 360, end: 795, pause: 0, theo: 420, fri: null },   // 6h00 – 13h15
      { id: "m3", label: "", team: "Matin", start: 330, end: 750, pause: 0, theo: 420, fri: null },   // 5h30 – 12h30
      { id: "s2", label: "", team: "Soir", start: 730, end: 1165, pause: 0, theo: 435, fri: { start: 720, end: 1080, pause: 0, theo: 360 } }, // 12h10 – 19h25
      { id: "s3", label: "", team: "Soir", start: 765, end: 1215, pause: 0, theo: 420, fri: null },   // 12h45 – 20h15
      { id: "j", label: "", team: "Journée", start: 420, end: 930, pause: 60, theo: 450, fri: { start: 420, end: 720, pause: 0, theo: 300 } }, // 7h00 – 15h30
    ],
    // Anciens compteurs simples (avant la 0.6). Conservés pour relire les anciennes données ; plus utilisés par les calculs.
    solde: { min: 0, from: curKey || "" },
    conges: { h: 10500, j: 5, from: curKey || "" },
    theme: "auto",
  };
}

/* ============================================================================================
 *  Durées et heures
 * ========================================================================================== */

/**
 * Minutes → texte « h:mm » (ex. 150 → "2:30").
 * @param {number} m          Durée en minutes (peut être négative ou fractionnaire : arrondie à la minute).
 * @param {boolean} [signed]  Vrai pour afficher « + » devant une valeur positive.
 * @returns {string} "" si la valeur est absente ou invalide.
 */
function hm(m, signed) {
  if (m == null || isNaN(m)) return "";
  const signe = m < 0 ? "-" : (signed && m > 0 ? "+" : "");
  m = Math.round(Math.abs(m));
  return signe + Math.floor(m / 60) + ":" + String(m % 60).padStart(2, "0");
}

/**
 * Texte « hh:mm » (champ de saisie d'heure) → minutes.
 * @param {string} v
 * @returns {number|null} null si le champ est vide ou sans « : ».
 */
function toMin(v) {
  if (v == null || v === "") return null;
  const p = String(v).split(":");
  if (p.length < 2) return null;
  return (+p[0]) * 60 + (+p[1]);
}

/**
 * Minutes depuis minuit → texte « hh:mm » pour un champ d'heure (ex. 330 → "05:30").
 * La valeur est ramenée dans la journée (1500 → "01:00").
 */
function toTime(m) {
  if (m == null) return "";
  m = ((m % 1440) + 1440) % 1440;
  return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
}

/**
 * Durée entre une arrivée et une fin.
 * Si la fin n'est pas après l'arrivée, le poste est considéré à cheval sur minuit (+ 24 h).
 * Cas limite figé : arrivée = fin donne donc 24 h, et un champ vidé (enregistré 0 = minuit) aussi.
 * @returns {number} 0 si l'une des deux heures manque.
 */
function span(start, end) {
  if (start == null || end == null) return 0;
  let duree = end - start;
  if (duree <= 0) duree += 1440;
  return duree;
}

/** Longueur commune à deux intervalles [a, b] et [c, d]. */
function overlap(a, b, c, d) {
  return Math.max(0, Math.min(b, d) - Math.max(a, c));
}

/**
 * Minutes de nuit d'un poste.
 * RÈGLE (accords MHCS 2010) : est de nuit tout ce qui est travaillé avant 6 h ou après 20 h
 * (bornes : regles.nuitDebut et regles.nuitFin). La pause et la grève ne sont pas retirées.
 * Un poste à cheval sur minuit est déroulé sur deux jours (0 → 2880 minutes).
 */
function nightMin(start, end, regles) {
  if (start == null || end == null) return 0;
  const fin = end <= start ? end + 1440 : end;
  const plagesDeNuit = [
    [0, regles.nuitDebut], [regles.nuitFin, 1440],                 // le jour même
    [1440, 1440 + regles.nuitDebut], [1440 + regles.nuitFin, 2880], // le lendemain
  ];
  let total = 0;
  plagesDeNuit.forEach((p) => { total += overlap(start, fin, p[0], p[1]); });
  return total;
}

/* ============================================================================================
 *  Horaires types
 * ========================================================================================== */

/** Heure → « 5h30 » (libellé d'un horaire). */
function fmtH(m) {
  m = ((m % 1440) + 1440) % 1440;
  return Math.floor(m / 60) + "h" + String(m % 60).padStart(2, "0");
}
/** Libellé automatique d'un horaire : « 5h30 – 12h30 ». */
function autoLabel(start, end) { return fmtH(start) + " – " + fmtH(end); }
/** Nom affiché d'un horaire : son nom s'il en a un, sinon ses heures. */
function schedName(h) { return h.label || autoLabel(h.start, h.end); }

/**
 * Horaire type applicable un jour donné.
 * @param {object} st   Réglages.
 * @param {string} id   Identifiant de l'horaire (m1, s3…).
 * @param {number} idx  Jour (0 = lundi) : le vendredi (4) prend la variante `fri` si elle existe.
 * @returns {{label:string, team:string, start:number, end:number, pause:number, theo:number}|null} null si l'horaire a été supprimé.
 */
function schedFor(st, id, idx) {
  let h = null;
  st.horaires.forEach((x) => { if (x.id === id) h = x; });
  if (!h) return null;
  const theo = h.theo != null ? +h.theo : 420;
  if (idx === 4 && h.fri) {
    return { label: h.label || autoLabel(h.fri.start, h.fri.end), team: h.team, start: h.fri.start, end: h.fri.end, pause: h.fri.pause || 0, theo: h.fri.theo != null ? +h.fri.theo : theo };
  }
  return { label: h.label || autoLabel(h.start, h.end), team: h.team, start: h.start, end: h.end, pause: h.pause || 0, theo };
}

/* ============================================================================================
 *  Jours fériés (France métropolitaine)
 * ========================================================================================== */

/** Date du dimanche de Pâques d'une année (algorithme de Meeus/Butcher, calendrier grégorien). */
function paques(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4,
    f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30,
    i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
    mois = Math.floor((h + l - 7 * m + 114) / 31), jour = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, mois - 1, jour);
}

/** Fériés déjà calculés, par année. */
const FER_CACHE = {};

/**
 * Les 11 jours fériés d'une année.
 * @returns {Object<string,string>} Clé « AAAA-M-J » (sans zéro devant) → nom du jour férié.
 */
function feries(y) {
  if (FER_CACHE[y]) return FER_CACHE[y];
  const liste = {}, dimancheDePaques = paques(y);
  const fixe = (date, nom) => { liste[date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate()] = nom; };
  const mobile = (joursApresPaques, nom) => { const d = new Date(dimancheDePaques); d.setDate(d.getDate() + joursApresPaques); fixe(d, nom); };
  fixe(new Date(y, 0, 1), "Jour de l'an");
  mobile(1, "Lundi de Pâques");
  fixe(new Date(y, 4, 1), "Fête du travail");
  fixe(new Date(y, 4, 8), "Victoire 1945");
  mobile(39, "Ascension");
  mobile(50, "Lundi de Pentecôte");
  fixe(new Date(y, 6, 14), "Fête nationale");
  fixe(new Date(y, 7, 15), "Assomption");
  fixe(new Date(y, 10, 1), "Toussaint");
  fixe(new Date(y, 10, 11), "Armistice");
  fixe(new Date(y, 11, 25), "Noël");
  return (FER_CACHE[y] = liste);
}

/** Nom du jour férié tombant à cette date, ou null. */
function ferieOf(d) {
  return feries(d.getFullYear())[d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate()] || null;
}

/* ============================================================================================
 *  Calcul d'une journée
 * ========================================================================================== */

/** Vrai si la journée est travaillée (horaire type « sch:<id> » ou « perso »), par opposition à une absence ou un repos. */
function isWork(d) {
  return d && (d.type === "perso" || /^sch:/.test(d.type || ""));
}

/**
 * Calcule une journée.
 *
 * @param {object} d    Journée enregistrée : { type, start, end, pause, team, label, theo, dur, x:{…} } ou vide.
 * @param {number} idx  Jour de la semaine (0 = lundi … 5 = samedi, 6 = dimanche).
 * @param {object} st   Réglages (regles, comptes, horaires).
 * @returns {object} Résultat, en minutes sauf mention :
 *   worked     temps travaillé (fin − arrivée − pause − grève en heures)
 *   counted    temps compté dans le total de la semaine (travail + récup/congé posés, ou durée de l'absence)
 *   night      minutes de nuit
 *   panier     1 si prime de panier (et prime d'équipe, toujours ensemble), sinon 0
 *   team, label  équipe et libellé
 *   abs        type d'absence, ou null
 *   x          « autres heures » par code (voir EXTRAS)
 *   greveJour  durée d'une journée de grève (ligne « Grève » de la fiche)
 *   formJour   durée d'une journée de formation
 *   theo       durée théorique de la journée
 *   hsJour     dépassement du théorique dans la journée
 *   recupH, congeH  récup et congé posés DANS une journée travaillée
 *   sam        1 si indemnité de samedi (code 3006)
 *   samedi     heures travaillées le samedi
 *   (journée travaillée seulement) recupP, congeP, congeK = récup/congé posés et compteur du congé ; alerte = plus de 10 h
 */
function dayCalc(d, idx, st) {
  const regles = st.regles;
  const r = { worked: 0, counted: 0, night: 0, panier: 0, team: "", label: "", abs: null, x: {}, greveJour: 0, formJour: 0, theo: 0, hsJour: 0, recupH: 0, congeH: 0, sam: 0, samedi: 0 };
  d = d || {};
  const autres = d.x || {};
  EXTRAS.forEach((e) => { r.x[e[0]] = +autres[e[0]] || 0; });

  if (isWork(d)) {
    /* ----- Journée travaillée ----- */
    r.team = d.team || "";
    r.label = d.type === "perso" ? "Perso" : (d.label || "");
    r.recupP = +autres.recupH || 0;
    r.congeP = +autres.congeH || 0;
    r.congeK = autres.congeK || "cp";

    // Temps travaillé : la pause et la grève « en heures » sont retirées.
    r.worked = Math.max(0, span(d.start, d.end) - (+d.pause || 0) - r.x.greve);
    r.night = nightMin(d.start, d.end, regles);

    // RÈGLE (accords MHCS 2010) : primes de panier (3001) et d'équipe (3008), toujours ensemble,
    // pour au moins 6 h de travail en équipe du Matin ou du Soir. Pas en Journée.
    r.panier = (r.team === "Matin" || r.team === "Soir") && r.worked >= regles.panierMin ? 1 : 0;

    // Durée théorique : celle saisie sur la journée, sinon celle de l'horaire type, sinon 7 h.
    if (d.theo != null) r.theo = +d.theo;
    else {
      const horaire = /^sch:/.test(d.type) ? schedFor(st, d.type.slice(4), idx) : null;
      r.theo = horaire ? horaire.theo : 420;
    }
    if (idx >= 5) r.theo = 0; // samedi et dimanche : pas d'horaire théorique

    // RÈGLE (contrôlée sur les relevés compta) : une récup ou un congé posé dans la journée compte
    // dans le total de la journée (présence, indicateur I2)… mais sera exclu des heures sup dans weekCalc.
    r.recupH = r.recupP;
    r.congeH = r.congeP;
    r.counted = r.worked + r.recupH + r.congeH;
    r.hsJour = Math.max(0, r.worked - r.theo);

    // RÈGLE (accord samedi maintenance) : le samedi est hors du seuil des 35 h. Ses heures sont suivies
    // à part (samedi) ; dès 6 h de travail : panier, équipe et indemnité de samedi (3006), quelle que soit l'équipe.
    if (idx === 5) {
      r.samedi = r.worked;
      r.counted = 0;
      r.hsJour = 0;
      if (r.worked >= regles.panierMin) { r.panier = 1; r.sam = 1; }
    }
    // Alerte : plus de 10 h de travail dans la journée.
    r.alerte = r.worked > regles.maxJour;
  } else if (d.type && (ABS[d.type] || d.type === "conge" || d.type === "cjour")) {
    /* ----- Journée d'absence ----- */
    r.abs = d.type;
    r.label = ABS[d.type];
    // Durée comptée : celle saisie (demi-journée…), sinon la durée réglée pour ce type, sinon 7 h.
    r.counted = d.dur != null ? +d.dur : (st.comptes[d.type] != null ? +st.comptes[d.type] : 420);
    // Cas figé : une journée de grève compte 0 dans le total (réglage) mais 7 h sur la ligne « Grève » de la fiche.
    if (d.type === "greve") r.greveJour = d.dur != null ? +d.dur : 420;
    if (d.type === "formation") r.formJour = r.counted;
  }
  return r;
}

/* ============================================================================================
 *  Calcul d'une semaine
 * ========================================================================================== */

/**
 * Calcule une semaine entière.
 *
 * @param {object} w   Semaine enregistrée : { days:[7 journées], … }.
 * @param {object} st  Réglages.
 * @returns {object} Résultat, en minutes sauf mention :
 *   days        les 7 résultats de dayCalc
 *   worked      total travaillé (samedi compris)       counted   total compté dans le seuil (samedi exclu)
 *   night       total de nuit                           panier    nombre de primes panier/équipe
 *   sam         nombre d'indemnités de samedi           samedi    heures du samedi
 *   hs          heures sup de la semaine (hors samedi)  hs1, hs2  part à 25 % et part à 50 %
 *   pres        présence au-delà de 35 h, récup et congés posés compris (indicateur compta I2)
 *   hsDay       heures sup réparties jour par jour (pour la fiche)
 *   majHs, majNuit, majSam   majorations (heures sup, nuit, samedi)
 *   gain        récup gagnée cette semaine              debit     récup posée cette semaine
 *   net         gain − debit
 *   recupDays, recupAbs   journées de récup : nombre et durée   recupH, congeH  récup/congé posés dans des journées travaillées
 *   conge, maladie, ferie, formation, greve  durées par type    absence, cjour  nombres de jours
 *   x           « autres heures » par code              alertJours, alertSem   alertes 10 h/jour et 40 h/semaine
 *   recupMode   vrai si les heures sup vont au compteur de récup
 */
function weekCalc(w, st) {
  const regles = st.regles;
  const days = (w && w.days) || [];
  const t = { days: [], worked: 0, counted: 0, night: 0, panier: 0, recupDays: 0, recupAbs: 0, recupH: 0, congeH: 0, x: {}, sam: 0, samedi: 0, cjour: 0, alertJours: 0, greve: 0, formation: 0, conge: 0, maladie: 0, ferie: 0, absence: 0, hsDay: [] };
  EXTRAS.forEach((e) => { t.x[e[0]] = 0; });

  /* ----- 1. Totaux des sept jours ----- */
  for (let i = 0; i < 7; i++) {
    const c = dayCalc(days[i], i, st);
    t.days.push(c);
    t.worked += c.worked; t.counted += c.counted; t.night += c.night; t.panier += c.panier; t.sam += c.sam; t.samedi += c.samedi;
    if (c.alerte) t.alertJours++;
    if (CONGE_J[c.abs]) t.cjour++;
    EXTRAS.forEach((e) => { t.x[e[0]] += c.x[e[0]]; });
    t.recupH += c.recupH; t.congeH += c.congeH;
    if (c.abs === "recup") { t.recupDays++; t.recupAbs += c.counted; }
    if (CONGE_H[c.abs]) t.conge += c.counted;
    if (c.abs === "maladie") t.maladie += c.counted;
    if (c.abs === "ferie") t.ferie += c.counted;
    if (c.abs === "absence") t.absence++;
    t.greve += c.greveJour + c.x.greve;
    t.formation += c.formJour;
  }
  t.conge += t.congeH;

  /* ----- 2. Heures supplémentaires -----
     RÈGLE (accord ARTT) : les heures sup se comptent à la semaine, au-delà de 35 h (regles.seuil).
     Les absences comptées (congé, férié, formation…) entrent dans les 35 h ; le samedi n'y entre pas.
     RÈGLE (contrôlée sur les relevés : R125/R150 contre I2) : la récup et le congé posés dans une journée
     sont retirés avant de comparer au seuil — ils ne créent jamais d'heure sup majorée.
     Ancien mode « jour par jour » (fichier Excel d'origine) : somme des dépassements du théorique, samedi exclu. */
  t.hs = 0;
  for (let i = 0; i < 7; i++) if (i !== 5) t.hs += t.days[i].hsJour;
  if (regles.hsCalc !== "jour") t.hs = Math.max(0, t.counted - t.recupH - t.congeH - regles.seuil);
  // Présence au-delà de 35 h, récup et congés posés compris : c'est ce que la compta appelle I2.
  t.pres = Math.max(0, t.counted - regles.seuil);

  /* ----- 3. Répartition des heures sup jour par jour (ligne « Heures suppl. » de la fiche) -----
     On part du dépassement de chaque journée travaillée, puis on ajuste pour que la somme soit exactement
     le total de la semaine : le surplus est retiré en remontant depuis le dimanche ; un manque est ajouté
     au dernier jour travaillé (hors samedi). */
  const parJour = t.days.map((jour, k) => (k === 5 || !isWork(days[k] || {}) ? 0 : jour.hsJour));
  const somme = parJour.reduce((a, b) => a + b, 0);
  if (somme > t.hs) {
    let surplus = somme - t.hs;
    for (let i = 6; i >= 0 && surplus > 0; i--) { const retire = Math.min(parJour[i], surplus); parJour[i] -= retire; surplus -= retire; }
  } else if (somme < t.hs) {
    for (let i = 6; i >= 0; i--) if (i !== 5 && isWork(days[i] || {})) { parJour[i] += t.hs - somme; break; }
  }
  t.hsDay = parJour;

  /* ----- 4. Majorations -----
     RÈGLE (accord ARTT) : les 8 premières heures sup (regles.palier) à 25 %, les suivantes à 50 %.
     RÈGLE (accords MHCS 2010) : heures de nuit majorées à 100 %.
     RÈGLE (accord samedi maintenance) : heures du samedi majorées à 50 %. */
  t.hs1 = Math.min(t.hs, regles.palier);
  t.hs2 = t.hs - t.hs1;
  t.majHs = t.hs1 * regles.taux1 / 100 + t.hs2 * regles.taux2 / 100;
  t.majNuit = t.night * regles.nuit / 100;
  t.majSam = t.samedi * (+regles.samTaux || 0) / 100;
  // Alerte : plus de 40 h travaillées dans la semaine (samedi compris).
  t.alertSem = t.worked > regles.maxSem;

  /* ----- 5. Effet sur le compteur de récup -----
     En mode « à récupérer » : heures sup + leur majoration + heures du samedi + leur majoration.
     La majoration de nuit va toujours au compteur. La récup posée (journées et heures) en est retirée. */
  t.recupMode = regles.hsMode === "recup";
  t.gain = (t.recupMode ? t.hs + t.majHs + t.samedi + t.majSam : 0) + t.majNuit;
  t.debit = t.recupAbs + t.recupH;
  t.net = t.gain - t.debit;
  return t;
}

/* ============================================================================================
 *  Semaines ISO et dates
 *  Une semaine est désignée par sa clé « AAAA-Wss » (ex. « 2026-W46 »). Semaine ISO : elle commence le
 *  lundi et appartient à l'année de son jeudi ; la semaine 1 est celle qui contient le 4 janvier.
 * ========================================================================================== */

/** Lundi (à minuit) de la semaine qui contient cette date. */
function mondayOf(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

/** Clé « AAAA-Wss » de la semaine qui commence ce lundi. (Math.round absorbe l'heure d'écart des changements d'heure.) */
function keyOf(lundi) {
  const jeudi = new Date(lundi);
  jeudi.setDate(jeudi.getDate() + 3);
  const annee = jeudi.getFullYear();
  const lundiSemaine1 = mondayOf(new Date(annee, 0, 4));
  const numero = 1 + Math.round((lundi - lundiSemaine1) / (7 * 864e5));
  return annee + "-W" + String(numero).padStart(2, "0");
}

/** Lundi d'une semaine désignée par sa clé. */
function monOfKey(k) {
  const annee = +k.slice(0, 4), numero = +k.slice(6);
  const d = mondayOf(new Date(annee, 0, 4));
  d.setDate(d.getDate() + (numero - 1) * 7);
  return d;
}

/** Clé de la semaine située n semaines plus tard (ou plus tôt si n est négatif). */
function shiftKey(k, n) {
  const d = monOfKey(k);
  d.setDate(d.getDate() + 7 * n);
  return keyOf(d);
}

/** Date → « JJ/MM ». */
function fmtD(d) {
  return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0");
}

/** Date → « AAAA-MM-JJ » (heure locale). Ce format se compare et se trie comme du texte. */
function ymdStr(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

/** Date du jour n° i (0 = lundi) de la semaine k. */
function dayDate(k, i) {
  const d = monOfKey(k);
  d.setDate(d.getDate() + i);
  return d;
}

export { DAYN, DAYL, ABS, ABSC, CONGE_H, CONGE_J, CPT_KEYS, EXTRAS, defaultSettings, hm, toMin, toTime, schedFor, autoLabel, schedName, ferieOf, isWork, dayCalc, weekCalc, mondayOf, keyOf, monOfKey, shiftKey, fmtD, ymdStr, dayDate };
