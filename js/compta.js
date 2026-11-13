/* COMPTA — vérification avec le logiciel de la compta, par copier-coller.
 *
 * L'utilisateur copie la page d'une semaine (ou le récapitulatif des soldes) et la colle dans l'appli.
 * Ce module lit ce texte, puis compare ligne par ligne avec ce que l'appli a calculé.
 *
 * Codes du logiciel reconnus :
 *   G000 (et G…)     heures travaillées de la journée
 *   I2               présence au-delà de 35 h, récup comprise ; autres I… (I9) : heures de nuit
 *   CP, CGPP         congé · CPSUP, ANC : congé supplémentaire · RHT, REC, RC : récup
 *   JF               férié · MAL : maladie · FOR, FORM : formation
 *   EVP (éléments variables de paye) : PANIE, PEQUI (primes), RMNUI (majoration de nuit),
 *                    R125, R150 (heures sup majorées, exprimées majoration comprise)
 * Résultats figés par tests/1-calculs.test.js.
 */
import { CONGE_H, CONGE_J, DAYN, dayDate, fmtD, hm, keyOf, mondayOf, toMin, weekCalc, ymdStr } from "./calculs.js";
import { counters, cpPeriod } from "./compteurs.js";
import { S } from "./etat.js";
import { fmtJ, toast } from "./outils.js";
import { saveSettings } from "./stockage.js";
import { addSnap } from "./sauvegardes.js";
import { render } from "./ecran-rendu.js";

/** Code d'absence du logiciel → catégorie comparée à l'appli. */
var COMPTA = { CP: "Congé", CGPP: "Congé", CPSUP: "Congé supp.", ANC: "Congé supp.", RHT: "Récup", REC: "Récup",
    RC: "Récup", JF: "Férié", MAL: "Maladie", FOR: "Formation", FORM: "Formation" };

/** Codes affichés pour information seulement (non comparés). */
var COMPTA_INFO = { INDTR: "Pénalisation indemnité transport" };

/** Type d'absence de l'appli → même catégorie que COMPTA. */
function appCat(t) {
  return CONGE_H[t] ? "Congé" : CONGE_J[t] ? "Congé supp." : t === "recup" ? "Récup" : t === "ferie" ? "Férié"
      : t === "maladie" ? "Maladie" : t === "formation" ? "Formation" : t === "greve" ? "Grève" : t === "absence" ? "Absence"
      : "";
}

/**
 * Lit le texte collé d'une ou plusieurs semaines.
 * @returns {object[]} Par semaine : key (« AAAA-Wss »), days (7 jours : act = travaillé, abs = absences par code,
 *   ind = indicateurs), re / ec (lignes Réalisé et Écart), evp (éléments variables de paye).
 */
function parseCompta(txt) {
  txt = String(txt).replace(/\r/g, "").replace(/[−–—]/g, "-").replace(/ /g, " ");
  var parts = txt.split(/Du\s+(\d{2}\/\d{2}\/\d{4})\s+au\s+\d{2}\/\d{2}\/\d{4}/), out = [];
  for (var p = 1; p < parts.length; p += 2) {
    var dm = parts[p].split("/"), mon = new Date(+dm[2], +dm[1] - 1, +dm[0]), body = parts[p + 1] || "";
    var j = body.search(/\n\s*Jours\b/), top = j >= 0 ? body.slice(0, j) : body, bot = j >= 0 ? body.slice(j) : "";
    var ix = top.indexOf("Indicateurs"), lines = top.slice(ix >= 0 ? ix + 11 : 0).split("\n").map(function(s) {
      return s.trim();
    }).filter(Boolean), days = [], cur = null;
    lines.forEach(function(l) {
      if (/^[A-Z][A-Z0-9]{1,7}$/.test(l)) {
        cur = { code: l, act: 0, abs: {}, ind: {} };
        days.push(cur);
        return;
      }
      if (!cur) return;
      var t2 = l.match(/^([A-Z][A-Z0-9]*)\s+(\d{1,3}:\d{2})$/);
      if (!t2) return;
      var c = t2[1], v = toMin(t2[2]);
      if (/^G\d+$/.test(c)) cur.act += v;
      else if (/^I\d+$/.test(c)) cur.ind[c] = (cur.ind[c] || 0) + v;
      else if (v) cur.abs[c] = (cur.abs[c] || 0) + v;
    });
    var rowv = function(name) {
      var m = bot.match(new RegExp(name + "\\s*\\n\\s*([^\\n]*)"));
      if (!m) return null;
      var v = m[1].trim().split(/\s+/).map(toMin);
      return { tot: v[0], d: v.slice(1, 8) };
    };
    var evp = {};
    ((bot.split(/\bEVP\b/)[1] || "").match(/[A-Z][A-Z0-9]+\s+\d+[.:]\d+/g) || []).forEach(function(s) {
      var q = s.split(/\s+/), v = q[1].indexOf(":") > 0 ? toMin(q[1]) : parseFloat(q[1]);
      evp[q[0]] = (evp[q[0]] || 0) + v;
    });
    out.push({ key: keyOf(mondayOf(mon)), days, re: rowv("Réalisé"), ec: rowv("Ecart"), evp });
  }
  return out;
}

/**
 * Compare une semaine de l'appli à son relevé.
 * @param {object} w Semaine. @param {object} st Réglages. @param {object} P Relevé lu par parseCompta.
 * @returns {{at:string, bad:number, items:object[], info:string[]}} items : une ligne par élément comparé
 *   (l libellé, a appli, b compta, ok, fav : +1 en faveur du salarié, −1 en sa défaveur) ; info : codes non vérifiés.
 */
function compareCompta(w, st, P) {
  var c = weekCalc(w, st), items = [], info = [];
  function eq(a, b, tol) {
    return Math.abs((a || 0) - (b || 0)) <= (tol == null ? 1 : tol);
  }
  for (var i = 0; i < 7; i++) {
    var dc = c.days[i], pd = P.days[i] || { act: 0, abs: {}, ind: {} }, dn = DAYN[i] + " " + fmtD(dayDate(P.key, i));
    if (dc.worked || pd.act) items.push({ l: dn + " · travail", a: hm(dc.worked), b: hm(pd.act), ok: eq(dc.worked,
        pd.act), an: dc.worked, bn: pd.act, s: 1 });
    var cn = 0;
    Object.keys(pd.ind).forEach(function(k) {
      if (k !== "I2") cn += pd.ind[k];
    });
    if (dc.night || cn) items.push({ l: dn + " · nuit", a: hm(dc.night), b: hm(cn), ok: eq(dc.night, cn), an: dc.night, bn: cn, s: 1 });
    var aA = {}, aB = {};
    if (dc.abs) aA[appCat(dc.abs)] = (aA[appCat(dc.abs)] || 0) + dc.counted;
    if (dc.recupH) aA["Récup"] = (aA["Récup"] || 0) + dc.recupH;
    if (dc.congeH) {
      var ck = appCat(dc.congeK);
      aA[ck] = (aA[ck] || 0) + dc.congeH;
    }
    Object.keys(pd.abs).forEach(function(k) {
      var cat = COMPTA[k] || k;
      aB[cat] = (aB[cat] || 0) + pd.abs[k];
    });
    Object.keys(Object.assign({}, aA, aB)).forEach(function(cat) {
      items.push({ l: dn + " · " + cat.toLowerCase(), a: aA[cat] ? hm(aA[cat]) : "—", b: aB[cat] ? hm(aB[cat])
          : "—", ok: eq(aA[cat], aB[cat]), an: aA[cat] || 0, bn: aB[cat] || 0, s: cat === "Férié" ? 1 : -1 });
    });
  }
  // Heures sup : la compta les exprime de deux façons, on compare à celle qui est présente.
  //   I2        = présence au-delà de 35 h, récup et congés posés COMPRIS ;
  //   R125/R150 = heures sup PAYÉES, majoration comprise (R125 = heures × 1,25 ; R150 = heures × 1,5).
  var hs = c.hs + c.samedi, ev = P.evp, i2 = 0, hasI2 = false;
  P.days.forEach(function(d) {
    if (d.ind.I2 != null) {
      hasI2 = true;
      i2 += d.ind.I2;
    }
  });
  // On retrouve les heures payées en retirant la majoration. part = récup + congé posés dans des journées travaillées :
  // s'il y en a, I2 (qui les contient) se compare à la présence, et R125/R150 aux heures sup majorées.
  var paid = ev.R125 != null || ev.R150 != null ? Math.round((ev.R125 || 0) / 1.25 + (ev.R150 || 0) / 1.5) : null, part = c.recupH
      + c.congeH, pres = c.pres + c.samedi;
  if (paid != null) items.push({ l: "Heures sup payées", a: hm(hs), b: hm(paid), ok: eq(hs, paid, 2), an: hs, bn: paid, s: 1, w: 1 });
  if (hasI2 && (paid == null || part)) items.push({ l: part ? "Présence au-delà de 35 h, récup comprise" : "Heures sup de la semaine",
      a: hm(part ? pres : hs), b: hm(i2), ok: eq(part ? pres : hs, i2, 1), an: part ? pres : hs, bn: i2, s: 1, w: 1 });
  if (paid == null && !hasI2 && P.ec) items.push({ l: "Heures sup de la semaine", a: hm(hs), b: hm(P.ec.tot),
      ok: eq(hs, P.ec.tot, 2), an: hs, bn: P.ec.tot, s: 1, w: 1 });
  items.push({ l: "Heures sup majorées 125 %", a: hm(Math.floor(c.hs1 * 1.25)), b: hm(ev.R125 || 0), ok: eq(c.hs1 * 1.25,
      ev.R125 || 0, 1), an: c.hs1 * 1.25, bn: ev.R125 || 0, s: 1, w: 1 });
  if (c.hs2 || ev.R150) items.push({ l: "Heures sup majorées 150 %", a: hm(Math.floor(c.hs2 * 1.5)), b: hm(ev.R150
      || 0), ok: eq(c.hs2 * 1.5, ev.R150 || 0, 1), an: c.hs2 * 1.5, bn: ev.R150 || 0, s: 1, w: 1 });
  items.push({ l: "Primes de panier", a: String(c.panier), b: String(ev.PANIE || 0), ok: c.panier === (ev.PANIE
      || 0), an: c.panier, bn: ev.PANIE || 0, s: 1, w: 1 });
  items.push({ l: "Primes d'équipe", a: String(c.panier), b: String(ev.PEQUI || 0), ok: c.panier === (ev.PEQUI
      || 0), an: c.panier, bn: ev.PEQUI || 0, s: 1, w: 1 });
  items.push({ l: "Majoration de nuit", a: hm(c.majNuit), b: hm(ev.RMNUI || 0), ok: eq(c.majNuit, ev.RMNUI
      || 0), an: c.majNuit, bn: ev.RMNUI || 0, s: 1, w: 1 });
  items.forEach(function(x) {
    if (!x.ok) x.fav = (x.bn - x.an) * x.s > 0 ? 1 : -1;
  });
  Object.keys(ev).forEach(function(k) {
    if (["R125", "R150", "PANIE", "PEQUI", "RMNUI"].indexOf(k) < 0) info.push(k + " " + ev[k] + (COMPTA_INFO[k] ? " (" + COMPTA_INFO[k] + ")" : ""));
  });
  P.days.forEach(function(d) {
    Object.keys(d.abs).forEach(function(k) {
      if (!COMPTA[k] && info.indexOf(k) < 0) info.push(k + " (code d'absence inconnu)");
    });
  });
  var now = /* @__PURE__ */ new Date();
  return { at: fmtD(now) + "/" + now.getFullYear() + " à " + String(now.getHours()).padStart(2, "0") + ":"
      + String(now.getMinutes()).padStart(2, "0"), bad: items.filter(function(x) {
    return !x.ok;
  }).length, items, info };
}

/** Libellé d'une ligne du récapitulatif des soldes → compteur de l'appli (null : ligne de total, ignorée). */
var SOLDE_MAP = [[/^TOT/i, null], [/cours d.?acquisition/i, "cpacq"], [/5.{0,4}me semaine/i, "c5"], [/fractionn/i,
    "frac"], [/anciennet/i, "anc"], [/suppl/i, "csup"], [/^Cong.s pay.s acquis/i, "cp"], [/r.cup.rer/i, "recup"],
    [/\bCET\b|.pargne/i, "cet"]];

/**
 * Lit le texte collé du « Récapitulatif des soldes ».
 * @returns {{date:Date, rows:object}|null} Par compteur : acq, pris, prevu, solde. null si ce n'est pas un récapitulatif.
 */
function parseSoldes(txt) {
  txt = String(txt).replace(/\r/g, "").replace(/\u00a0/g, " ");
  if (!/R.capitulatif des soldes/i.test(txt)) return null;
  var dm = txt.match(/Du\s+\d{2}\/\d{2}\/\d{4}\s+au\s+(\d{2})\/(\d{2})\/(\d{4})/) || txt.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!dm) return null;
  var out = { date: new Date(+dm[3], +dm[2] - 1, +dm[1]), rows: {} };
  txt.split("\n").forEach(function(l) {
    var c = l.indexOf("	") >= 0 ? l.split("	") : l.split(/\s{2,}/);
    var lab = (c[0] || "").trim();
    if (!lab || c.length < 2) return;
    var k = null;
    for (var i = 0; i < SOLDE_MAP.length; i++) if (SOLDE_MAP[i][0].test(lab)) {
      k = SOLDE_MAP[i][1];
      break;
    }
    if (!k || out.rows[k]) return;
    var v = c.slice(1, 5).map(function(x) {
      x = String(x || "").trim();
      if (!x) return null;
      if (x.indexOf(":") > 0) return toMin(x);
      var f = parseFloat(x.replace(",", "."));
      return isNaN(f) ? null : f;
    });
    if (v.every(function(x) {
      return x == null;
    })) return;
    out.rows[k] = { lab, acq: v[0], pris: v[1], prevu: v[2], solde: v[3] };
  });
  return Object.keys(out.rows).length ? out : null;
}

/**
 * Compare les compteurs de l'appli, évalués à la date du relevé, au récapitulatif.
 * Acquis, pris et prévu ne sont listés qu'en cas d'écart ; le solde l'est toujours.
 */
function compareSoldes(P) {
  var st = S.settings, cn = counters(st, S.weeks, P.date), items = [], info = [], td = ymdStr(P.date), late = [];
  ["recup", "cp", "c5", "frac", "anc", "csup"].forEach(function(k) {
    var r2 = P.rows[k], o = cn[k];
    if (!r2) {
      if (o.acq || o.pris || o.prevu) info.push(o.n);
      return;
    }
    if (o.ref > td) late.push(o.n);
    var H = o.u === "h", f = function(v) {
      return H ? hm(v) : fmtJ(v) + " j";
    }, tol = H ? 1 : 0.01, isR = k === "recup", n = o.n.replace(/ \(4 semaines\)/, "");
    var rs = [["acquis", o.acq, r2.acq || 0, 1], ["pris", o.pris, r2.pris || 0, -1]];
    if (!isR || r2.prevu != null) rs.push(["prévu", o.prevu, r2.prevu || 0, -1]);
    var sa = isR && r2.prevu == null ? o.dispo : o.reste, sb = r2.solde != null ? r2.solde : (r2.acq || 0) - (r2.pris || 0) - (r2.prevu || 0);
    var onlyPrev = true;
    rs.forEach(function(x) {
      var ok = Math.abs(x[1] - x[2]) <= tol;
      if (ok) return;
      var it = { l: n + " · " + x[0], a: f(x[1]), b: f(x[2]), ok: false, an: x[1], bn: x[2], s: x[3] };
      if (x[0] === "prévu") it.hint = x[2] > x[1] ? "pas encore posé dans l'appli" : "posé dans l'appli, pas à la compta";
      else onlyPrev = false;
      items.push(it);
    });
    var so = { l: n + " · solde", a: f(sa), b: f(sb), ok: Math.abs(sa - sb) <= tol, an: sa, bn: sb, s: 1 };
    if (!so.ok && onlyPrev && rs.length > 2 && Math.abs(o.prevu - (r2.prevu || 0)) > tol) so.hint = "vient du prévu";
    items.push(so);
  });
  if (P.rows.cpacq) {
    var a = st.cpt && st.cpt.cpacq, b = P.rows.cpacq.acq || P.rows.cpacq.solde || 0;
    items.push({ l: "CP en cours d'acquisition", a: a != null ? hm(a) : "—", b: hm(b), ok: a != null && Math.abs(a - b) <= 1,
        an: a || 0, bn: b, s: 1 });
  }
  if (P.rows.cet) {
    var r = P.rows.cet, b2 = r.solde != null ? r.solde : (r.acq || 0) - (r.pris || 0);
    items.push({ l: "CET · solde", a: hm(cn.cet.solde), b: hm(b2), ok: Math.abs(cn.cet.solde - b2) <= 1, an: cn.cet.solde, bn: b2, s: 1 });
  } else if (cn.cet.solde) info.push("CET");
  items.forEach(function(x) {
    if (!x.ok && !x.hint) x.fav = (x.bn - x.an) * x.s > 0 ? 1 : -1;
  });
  return { date: td, items, bad: items.filter(function(x) {
    return !x.ok;
  }).length, info, late };
}

/** Recale les compteurs sur les chiffres de la compta (après sauvegarde) : le relevé devient le nouveau point de départ. */
function recalSoldes() {
  var P = S.sres && S.sres.P;
  if (!P) return;
  addSnap("Avant recalage sur la compta", true);
  var cp = S.settings.cpt = S.settings.cpt || {}, d = P.date, ds = ymdStr(d), T = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
  Object.keys(P.rows).forEach(function(k) {
    var r = P.rows[k], old = cp[k] || {};
    if (k === "cpacq") {
      cp.cpacq = r.acq != null ? r.acq : r.solde;
      return;
    }
    if (k === "cet") {
      var ce = cp.cet = cp.cet || { moves: [] };
      ce.solde = r.solde != null ? r.solde : (r.acq || 0) - (r.pris || 0);
      ce.ref = ds;
      ce.refT = T;
      return;
    }
    if (k === "recup") {
      cp.recup = { year: d.getFullYear(), acq: r.acq || 0, pris: r.pris || 0, ref: ds, refT: T, from: keyOf(mondayOf(d)) };
      return;
    }
    var per = cpPeriod(d).a, adds = (old.adds || []).filter(function(x) {
      return x.per === per;
    }), acq = r.acq || 0;
    if (k === "frac") acq -= adds.reduce(function(s, x) {
      return s + (+x.min || 0);
    }, 0);
    cp[k] = { per, acq, pris: r.pris || 0, ref: ds, refT: T, adds: old.adds, done: old.done };
  });
  saveSettings();
  S.sres.res = compareSoldes(P);
  render();
  toast("Compteurs recalés sur la compta du " + fmtD(d));
}
export { compareCompta, compareSoldes, parseCompta, parseSoldes, recalSoldes };
