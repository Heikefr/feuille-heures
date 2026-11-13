/* ÉCRAN BILAN — l'année mois par mois.
 *
 * Chaque jour est rangé dans le mois de sa date (une semaine à cheval compte pour les deux mois).
 * Heures sup = heures sup de la semaine réparties sur les jours (hsDay), samedi à part.
 * Récup gagnée = résultat de la semaine, rangé dans le mois de son jeudi (règle ISO).
 */
import { CONGE_H, dayDate, hm, weekCalc } from "./calculs.js";
import { S, TODAY } from "./etat.js";
import { ICON } from "./outils.js";

/** Noms des mois. */
var MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

/** Colonnes du bilan : [code, titre, "n" si c'est un nombre et non une durée]. */
var BCOLS = [["w", "Travaillé"], ["hs", "Heures sup"], ["n", "Nuit"], ["sa", "Samedi"], ["pa", "Primes", "n"], ["gain", "Récup gagnée"], ["rp", "Récup posée"], ["co", "Congés"], ["fo", "Formation"], ["ma", "Maladie"], ["gr", "Grève"], ["fe", "Fériés"]];

/**
 * Calcule le bilan d'une année.
 * @returns {{y:number, M:object[], T:object, nb:{sent:number, draft:number}}} M : 12 mois ; T : totaux ; nb : semaines envoyées et brouillons.
 */
function bilanData(y) {
  var st = S.settings, M = [], i, nb = { sent: 0, draft: 0 };
  for (i = 0; i < 12; i++) M.push({ w: 0, hs: 0, n: 0, sa: 0, pa: 0, gain: 0, rp: 0, co: 0, fo: 0, ma: 0, gr: 0, fe: 0 });
  Object.keys(S.weeks).forEach(function(k) {
    var a = +k.slice(0, 4);
    if (a < y - 1 || a > y + 1) return;
    var w = S.weeks[k];
    if (!w || !(w.days || []).some(function(d) {
      return d && d.type && !d.auto;
    })) return;
    var c = weekCalc(w, st), th = dayDate(k, 3);
    if (th.getFullYear() === y) {
      M[th.getMonth()].gain += c.gain;
      if (w.validated) nb.sent++;
      else nb.draft++;
    }
    c.days.forEach(function(r, j) {
      var d = dayDate(k, j);
      if (d.getFullYear() !== y) return;
      var m = M[d.getMonth()];
      m.w += r.worked;
      m.hs += c.hsDay[j] || 0;
      m.n += r.night;
      m.sa += r.samedi;
      m.pa += r.panier;
      m.co += (CONGE_H[r.abs] ? r.counted : 0) + r.congeH;
      m.rp += (r.abs === "recup" ? r.counted : 0) + r.recupH;
      m.fo += r.formJour;
      m.ma += r.abs === "maladie" ? r.counted : 0;
      m.gr += r.greveJour + (r.x.greve || 0);
      m.fe += r.abs === "ferie" ? r.counted : 0;
    });
  });
  var T = {};
  BCOLS.forEach(function(c) {
    T[c[0]] = M.reduce(function(s2, m) {
      return s2 + m[c[0]];
    }, 0);
  });
  return { y, M, T, nb };
}

/** L'écran Bilan : chiffres clés, tableau mensuel, bouton d'export. */
function viewBilan() {
  var y = S.by || TODAY.getFullYear(), B = bilanData(y), T = B.T, cur = y === TODAY.getFullYear() ? TODAY.getMonth() : 11;
  var cols = BCOLS.filter(function(c) {
    return ["w", "hs", "n", "pa"].indexOf(c[0]) >= 0 || T[c[0]];
  }), mx = Math.max.apply(null, B.M.map(function(m) {
    return m.hs;
  })) || 1;
  var f = function(c, v) {
    return c[2] === "n" ? String(v) : hm(v);
  };
  var out = '<section><div class="byear"><button class="iconbtn" data-act="by" data-n="-1" aria-label="Année précédente">'
      + ICON.prev + "</button><h2>Bilan " + y + '</h2><button class="iconbtn" data-act="by" data-n="1" aria-label="Année suivante">'
      + ICON.next + "</button></div>";
  var kpi = function(l, v, cl) {
    return '<div class="bkpi"><small>' + l + '</small><b class="mono' + (cl ? " " + cl : "") + '">' + v + "</b></div>";
  };
  out += '<div class="bkpis">' + kpi("Heures travaillées", hm(T.w)) + kpi("Heures sup", hm(T.hs), "supp") + kpi("Heures de nuit", hm(T.n), "nuit")
      + kpi("Primes panier · équipe", T.pa + " · " + T.pa) + (T.sa ? kv0("Samedis", hm(T.sa)) : "") + kpi("Récup gagnée", hm(T.gain), "okc")
      + kpi("Congés pris", hm(T.co)) + "</div>";
  function kv0(l, v) {
    return kpi(l, v);
  }
  out += '<div class="card btab"><table><thead><tr><th scope="col">Mois</th>' + cols.map(function(c) {
    return '<th scope="col">' + c[1] + "</th>";
  }).join("") + "</tr></thead><tbody>";
  B.M.forEach(function(m, i) {
    var empty = !BCOLS.some(function(c) {
      return m[c[0]];
    });
    out += '<tr class="' + (i > cur ? "fut" : "") + (empty ? " vide" : "") + '"><th scope="row">' + MOIS[i] + "</th>" + cols.map(function(c) {
      var v = m[c[0]];
      if (!v) return '<td class="z">·</td>';
      if (c[0] === "hs") return '<td><span class="bbar" style="width:' + Math.round(v / mx * 100) + '%"></span><span class="bv">'
          + f(c, v) + "</span></td>";
      return "<td>" + f(c, v) + "</td>";
    }).join("") + "</tr>";
  });
  out += '</tbody><tfoot><tr><th scope="row">Total</th>' + cols.map(function(c) {
    return "<td>" + f(c, T[c[0]]) + "</td>";
  }).join("") + "</tr></tfoot></table></div>";
  out += '<div class="tiny">' + B.nb.sent + " semaine(s) envoyée(s)" + (B.nb.draft ? ", " + B.nb.draft + " brouillon(s) compté(s)" : "")
      + ". Une semaine à cheval sur deux mois compte jour par jour ; la récup gagnée est rangée dans le mois du jeudi. Primes : panier et équipe vont ensemble.</div>";
  if (!S.desk) out += '<button class="btn" data-act="bexport" style="width:100%">Exporter en Excel</button>';
  return out + "</section>";
}
export { BCOLS, MOIS, bilanData, viewBilan };
