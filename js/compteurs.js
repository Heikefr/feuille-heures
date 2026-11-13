/* COMPTEURS — heures à récupérer, congés (principal, 5e semaine, fractionnement, ancienneté, supplémentaires), CET.
 *
 * Principe commun à tous les compteurs : on part d'un RELEVÉ (les colonnes « Acquis » et « Pris » recopiées
 * du récapitulatif de la compta à une date donnée, dite date de référence), puis l'appli ajoute elle-même
 * tout ce qui se passe APRÈS cette date : journées posées, heures posées dans une journée, récup gagnée
 * par les semaines envoyées, placements au CET.
 *
 * Trois chiffres par compteur :
 *   acquis  ce qui a été gagné sur la période ;
 *   pris    ce qui a été posé jusqu'à aujourd'hui inclus ;
 *   prévu   ce qui est posé dans l'appli à une date à venir.
 *   → dispo = acquis − pris ;  reste = acquis − pris − prévu.
 *
 * Périodes :
 *   - récup : année civile (1er janvier – 31 décembre). Le compteur repart à zéro au 1er janvier.
 *   - congés : du 1er juin au 31 mai.
 *
 * Unités : minutes pour la récup, le congé principal, la 5e semaine et le fractionnement ;
 * JOURS pour l'ancienneté et les congés supplémentaires (1 jour = 7 h = 420 minutes).
 *
 * Les relevés sont enregistrés dans les réglages (settings.cpt). Résultats figés par tests/1-calculs.test.js.
 */
import { dayCalc, dayDate, keyOf, mondayOf, weekCalc, ymdStr } from "./calculs.js";

/** Plafond du CET court terme : 140 h (20 jours), en minutes. */
const CET_MAX = 8400;
/** Compteurs depuis lesquels on peut placer au CET (dans Pléiade). */
const CET_SRC = ["recup", "c5", "frac", "anc", "csup"];
/** Les six compteurs : n = nom affiché, u = unité (« h » : minutes, « j » : jours). */
const CPT_DEF = {
  recup: { n: "Heures à récupérer", u: "h" },
  cp: { n: "Congé principal (4 semaines)", u: "h" },
  c5: { n: "5e semaine", u: "h" },
  frac: { n: "Fractionnement", u: "h" },
  anc: { n: "Ancienneté", u: "j" },
  csup: { n: "Congés supplémentaires", u: "j" },
};

/**
 * Période de congés qui contient une date : du 1er juin au 31 mai.
 * @param {Date} today
 * @returns {{a:string, b:string, label:string}} Début et fin (AAAA-MM-JJ) et libellé affiché.
 */
function cpPeriod(today) {
  const annee = today.getMonth() >= 5 ? today.getFullYear() : today.getFullYear() - 1;
  return { a: annee + "-06-01", b: (annee + 1) + "-05-31", label: "01/06/" + annee + " – 31/05/" + (annee + 1) };
}

/* Les compteurs sont recalculés à chaque affichage : on garde les 4 derniers résultats.
   La clé couvre tout ce dont dépend le calcul (date, réglages utiles, semaines), donc le cache ne peut pas être périmé. */
const CPT_MEMO = [];

/**
 * État de tous les compteurs à une date.
 * @param {object} st       Réglages (cpt, regles, horaires, comptes).
 * @param {object} weeks    Toutes les semaines, par clé « AAAA-Wss ».
 * @param {Date} [today]    Date d'évaluation (aujourd'hui par défaut). La vérification des soldes l'appelle à la date du relevé.
 * @returns {object} { recup, cp, c5, frac, anc, csup, cet } — voir countersRaw.
 */
function counters(st, weeks, today) {
  today = today || new Date();
  const cle = ymdStr(today) + "|" + JSON.stringify([st.cpt, st.regles, st.horaires, st.comptes]) + "|" + JSON.stringify(weeks);
  for (let i = 0; i < CPT_MEMO.length; i++) if (CPT_MEMO[i].k === cle) return CPT_MEMO[i].v;
  const resultat = countersRaw(st, weeks, today);
  CPT_MEMO.unshift({ k: cle, v: resultat });
  if (CPT_MEMO.length > 4) CPT_MEMO.pop();
  return resultat;
}

/**
 * Le calcul lui-même (sans cache).
 * Chaque compteur renvoyé contient : k (code), n (nom), u (unité), period {a, b, label}, ref (date de référence
 * du relevé), acq, pris, prevu, gain (récup gagnée par les semaines envoyées), dispo, reste, set (vrai si un relevé
 * a été saisi pour la période), cet (part de « pris » partie au CET) et, pour la récup, from (première semaine comptée).
 * Le CET contient : solde, ref, refT, max, moves (placements, du plus récent au plus ancien).
 */
function countersRaw(st, weeks, today) {
  const aujourdhui = ymdStr(today);
  const releves = st.cpt || {};
  const out = {};
  const periodeConges = cpPeriod(today);
  const annee = today.getFullYear();

  /* ----- 1. Point de départ : le relevé de chaque compteur, s'il concerne la période en cours ----- */
  Object.keys(CPT_DEF).forEach((k) => {
    const releve = releves[k] || {};
    const o = { k, n: CPT_DEF[k].n, u: CPT_DEF[k].u, acq: 0, pris: 0, prevu: 0, gain: 0 };
    if (k === "recup") {
      // Récup : année civile. Un relevé d'une autre année est ignoré (remise à zéro au 1er janvier).
      o.period = { a: annee + "-01-01", b: annee + "-12-31", label: "01/01 – 31/12/" + annee };
      if (+releve.year === annee) {
        o.acq = +releve.acq || 0;
        o.pris = +releve.pris || 0;
        o.ref = releve.ref || (annee - 1) + "-12-31";
        // Première semaine dont la récup gagnée s'ajoute au relevé (les précédentes y sont déjà).
        o.from = releve.from || keyOf(mondayOf(new Date(annee, 0, 4)));
        o.set = true;
      } else {
        o.ref = (annee - 1) + "-12-31";
        o.from = keyOf(mondayOf(new Date(annee, 0, 4)));
      }
    } else {
      // Congés : période du 1er juin au 31 mai. Un relevé d'une autre période est ignoré.
      o.period = periodeConges;
      if (releve.per === periodeConges.a) {
        o.acq = +releve.acq || 0;
        o.pris = +releve.pris || 0;
        o.ref = releve.ref || periodeConges.a;
        o.set = true;
      } else {
        // Sans relevé : référence au 31 mai, veille du début de période (tout ce qui est posé dans la période compte).
        const veille = new Date(+periodeConges.a.slice(0, 4), 5, 0);
        o.ref = ymdStr(veille);
      }
    }
    // Fractionnement : les jours crédités par l'appli (5 jours de congé principal pris entre novembre et mai → 2 jours)
    // s'ajoutent à l'acquis du relevé.
    if (k === "frac") (releve.adds || []).forEach((ajout) => { if (ajout.per === periodeConges.a) o.acq += +ajout.min || 0; });
    out[k] = o;
  });

  /* ----- 2. Ce qui est posé dans les semaines ----- */
  Object.keys(weeks).forEach((cleSemaine) => {
    const w = weeks[cleSemaine];
    if (!w) return;
    const days = w.days || [];
    for (let i = 0; i < 7; i++) {
      const d = days[i];
      if (!d || !d.type) continue;
      const date = ymdStr(dayDate(cleSemaine, i));
      const dc = dayCalc(d, i, st);
      /* Retire `valeur` du compteur `code`, si la date est après la référence du relevé et dans la période :
         en « pris » jusqu'à aujourd'hui inclus, en « prévu » au-delà. */
      const poser = (code, valeur) => {
        const o = out[code];
        if (!o || !valeur || !o.period) return;
        if (date <= o.ref || date < o.period.a || date > o.period.b) return;
        if (date <= aujourdhui) o.pris += valeur; else o.prevu += valeur;
      };
      if (dc.abs) {
        // Journée d'absence. (« conge » et « cjour » : anciens codes du congé principal et du congé supplémentaire.)
        const code = dc.abs === "conge" ? "cp" : dc.abs === "cjour" ? "csup" : dc.abs;
        // Compteur en jours : la durée est convertie en jours, arrondie à la demi-journée (1 jour si l'arrondi donne 0).
        if (out[code]) poser(code, out[code].u === "j" ? (Math.round(dc.counted / 420 * 2) / 2 || 1) : dc.counted);
      }
      // RÈGLE (contrôlée sur les relevés compta) : récup et congé posés dans une journée travaillée sont retirés en entier.
      if (dc.recupH) poser("recup", dc.recupH);
      if (dc.congeH) poser(dc.congeK, dc.congeH);
    }
    /* Récup gagnée : seulement par les semaines ENVOYÉES (validées), à partir de la semaine de départ du relevé,
       et rangée dans l'année de leur jeudi (règle des semaines ISO). */
    const recup = out.recup;
    if (w.validated && cleSemaine >= recup.from && dayDate(cleSemaine, 3).getFullYear() === annee) {
      const gain = weekCalc(w, st).gain;
      recup.acq += gain;
      recup.gain += gain;
    }
  });

  /* ----- 3. CET : solde relevé + placements faits ensuite dans Pléiade -----
     Un placement est appliqué tout de suite : ajouté au CET et retiré (« pris ») du compteur d'origine,
     à condition d'avoir été saisi APRÈS le relevé du compteur concerné (sinon le relevé le contient déjà). */
  const releveCet = releves.cet || {};
  const cet = { k: "cet", n: "CET court terme", solde: +releveCet.solde || 0, ref: releveCet.ref || "", refT: +releveCet.refT || 0, max: CET_MAX, moves: [] };
  (releveCet.moves || []).forEach((placement) => {
    const saisiLe = +placement.t || 0, date = placement.date, origine = out[placement.src];
    if (saisiLe > cet.refT && date <= aujourdhui) cet.solde += +placement.min || 0;
    if (origine && date <= aujourdhui && date >= origine.period.a && date <= origine.period.b && saisiLe > refT(releves[placement.src], origine)) {
      const quantite = origine.u === "j" ? (+placement.qty || 0) : (+placement.min || 0);
      origine.pris += quantite;
      origine.cet = (origine.cet || 0) + quantite;
    }
    cet.moves.push(placement);
  });
  cet.moves.sort((a, b) => (+b.t || 0) - (+a.t || 0));
  out.cet = cet;

  /* ----- 4. Soldes ----- */
  Object.keys(out).forEach((k) => {
    const o = out[k];
    if (k === "cet") return;
    o.dispo = o.acq - o.pris;
    o.reste = o.acq - o.pris - o.prevu;
  });
  return out;
}

/**
 * Instant (en millisecondes) à partir duquel une saisie est « après le relevé » d'un compteur.
 * C'est l'instant enregistré avec le relevé (refT) ; à défaut, le lendemain à minuit de sa date de référence.
 * @param {object} releve    Relevé enregistré du compteur (peut être absent).
 * @param {object} compteur  Compteur calculé (fournit la date de référence par défaut).
 */
function refT(releve, compteur) {
  if (releve && releve.refT) return +releve.refT;
  const date = (releve && releve.ref) || compteur.ref;
  if (!date) return 0;
  const lendemain = new Date(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10) + 1);
  return lendemain.getTime();
}

/**
 * Compteur de récup aujourd'hui, avec le détail semaine par semaine (historique des fiches envoyées).
 * @returns {{solde:number, reste:number, rows:{k:string, c:object, after:number}[]}}
 *   solde = dispo ; reste = dispo moins le prévu ; rows = pour chaque semaine envoyée de l'année, son calcul (c)
 *   et le cumul après elle (after).
 */
function soldeCalc(st, weeks) {
  const recup = counters(st, weeks).recup;
  const rows = [];
  // Cumul de départ : le relevé seul (acquis sans les gains de l'appli, moins le pris).
  let cumul = recup.acq - recup.gain - recup.pris;
  Object.keys(weeks).sort().forEach((k) => {
    const w = weeks[k];
    if (!w || !w.validated || k < recup.from || dayDate(k, 3).getFullYear() !== new Date().getFullYear()) return;
    const calcul = weekCalc(w, st);
    cumul += calcul.gain;
    rows.push({ k, c: calcul, after: cumul });
  });
  return { solde: recup.dispo, reste: recup.reste, rows };
}

export { CET_MAX, CET_SRC, CPT_DEF, cpPeriod, counters, soldeCalc };
