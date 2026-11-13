/* ÉCRAN COMPTEURS — rappels, prochaines échéances, cartes des compteurs, CET, historique des fiches envoyées.
 */
import { CONGE_H, CONGE_J, dayCalc, dayDate, ferieOf, fmtD, hm, keyOf, monOfKey, mondayOf, weekCalc, ymdStr } from "./calculs.js";
import { CET_MAX, CET_SRC, CPT_DEF, counters, cpPeriod, soldeCalc } from "./compteurs.js";
import { S } from "./etat.js";
import { esc, fmtJ, parseHM, shareFile, toast } from "./outils.js";
import { saveSettings } from "./stockage.js";

/** Prochaines échéances : semaines à venir qui ont une note, des congés ou une formation. */
function upcoming() {
  var cur = keyOf(mondayOf(/* @__PURE__ */ new Date())), out = [];
  Object.keys(S.weeks).sort().forEach(function(k) {
    if (k < cur) return;
    var w = S.weeks[k];
    if (!w) return;
    var days = w.days || [], cg = [], fo = [];
    days.forEach(function(d, i) {
      if (!d) return;
      if (CONGE_H[d.type] || CONGE_J[d.type]) cg.push(i);
      if (d.type === "formation") fo.push(i);
    });
    if (!w.note && !cg.length && !fo.length) return;
    var idx = cg.concat(fo).sort(), a = idx.length ? idx[0] : 0, b = idx.length ? idx[idx.length - 1] : 4, c = weekCalc(w, S.settings);
    var title = w.note || (cg.length ? "Congés" : "Formation"), det = [];
    if (c.conge) det.push(hm(c.conge) + " de congé");
    if (c.formation) det.push("formation " + hm(c.formation));
    out.push({ k, title, a: dayDate(k, a), b: dayDate(k, b), det: det.join(" · "), note: !!w.note && !cg.length, conge: c.conge });
  });
  return out;
}

/** Fichier calendrier (.ics) pour une liste d'échéances. */
function icsFor(list) {
  function ymd(d) {
    return d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
  }
  function e(s) {
    var B = String.fromCharCode(92);
    return String(s).split(B).join(B + B).replace(/[;,]/g, function(m) {
      return B + m;
    }).split(String.fromCharCode(10)).join(B + "n");
  }
  var now = (/* @__PURE__ */ new Date()).toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z", L = ["BEGIN:VCALENDAR",
      "VERSION:2.0", "PRODID:-//Feuille d'heures//FR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  list.forEach(function(x) {
    var end = new Date(x.b);
    end.setDate(end.getDate() + 1);
    L.push("BEGIN:VEVENT", "UID:feuille-heures-" + x.k + "@heikefr.github.io", "DTSTAMP:" + now, "DTSTART;VALUE=DATE:"
        + ymd(x.a), "DTEND;VALUE=DATE:" + ymd(end), "SUMMARY:" + e(x.title), "DESCRIPTION:" + e("Semaine " + +x.k.slice(6)
        + (x.det ? " · " + x.det : "")), "TRANSP:TRANSPARENT", "END:VEVENT");
  });
  L.push("END:VCALENDAR");
  return L.join("\r\n");
}

/** Remet le fichier calendrier à l'utilisateur (ajout au Calendrier de l'iPhone). */
function exportIcs(list, name) {
  if (!list.length) {
    toast("Aucune échéance à ajouter");
    return;
  }
  shareFile(new Blob([icsFor(list)], { type: "text/calendar" }), name, "Échéances").then(function(ok) {
    if (ok) toast("Ouvre le fichier .ics (app Fichiers) pour l'ajouter au Calendrier");
  });
}

/** Rappels : placement CET possible (avril et novembre), récup à poser avant le 31/12 (décembre). */
function reminders() {
  var td = /* @__PURE__ */ new Date(), m = td.getMonth() + 1, y = td.getFullYear(), r = [], rc = (S._cpt || counters(S.settings, S.weeks)).recup;
  var cet = m <= 4 ? "30/04/" + y : m <= 11 ? "30/11/" + y : "30/04/" + (y + 1);
  r.push({ on: m === 4 || m === 11, t: "Placement CET possible jusqu'au " + cet, d: "Dans Pléiade : récup, 5e semaine, fractionnement ou ancienneté, jusqu'à "
      + hm(CET_MAX) + " au CET. Puis ajoute-le dans la carte CET." });
  r.push({ on: m === 12 && rc.reste > 0, t: "Récup : " + hm(rc.reste) + " à poser avant le 31/12/" + y, d: "Le compteur de récup repart à zéro le 1er janvier." });
  return r;
}

/** Affiche les rappels. @param {boolean} onlyOn Vrai pour n'afficher que ceux qui sont d'actualité. */
function viewReminders(onlyOn) {
  return reminders().filter(function(x) {
    return !onlyOn || x.on;
  }).map(function(x) {
    return '<div class="remind' + (x.on ? " on" : "") + '"><b>' + esc(x.t) + "</b><span>" + esc(x.d) + "</span></div>";
  }).join("");
}

/**
 * Fractionnement : repère chaque série de 5 jours ouvrés consécutifs de congé principal pris entre novembre et mai.
 * RÈGLE (accord congés payés) : une telle série donne droit à 2 jours de fractionnement (plafond 28 h par période).
 * @returns {object[]} Séries pas encore traitées : id, dates, semaine, minutes à créditer.
 */
function fracCands() {
  var st = S.settings, td = /* @__PURE__ */ new Date(), per = cpPeriod(td), fr = (st.cpt || {}).frac || {}, done = fr.done || [], ds = [];
  Object.keys(S.weeks).forEach(function(k) {
    ((S.weeks[k] || {}).days || []).forEach(function(d, i) {
      if (!d || !(d.type === "cp" || d.type === "conge")) return;
      var dt = dayDate(k, i), mo = dt.getMonth() + 1, s = ymdStr(dt);
      if ((mo >= 11 || mo <= 5) && s >= per.a && s <= per.b) ds.push({ s, dt, k, min: dayCalc(d, i, st).counted });
    });
  });
  ds.sort(function(a, b) {
    return a.s < b.s ? -1 : 1;
  });
  function nextWork(dt) {
    var n = new Date(dt);
    do {
      n.setDate(n.getDate() + 1);
    } while (n.getDay() === 0 || n.getDay() === 6 || ferieOf(n));
    return ymdStr(n);
  }
  var runs = [], cur = null;
  ds.forEach(function(x) {
    if (cur && nextWork(cur[cur.length - 1].dt) === x.s) cur.push(x);
    else {
      cur = [x];
      runs.push(cur);
    }
  });
  var credited = (fr.adds || []).filter(function(a) {
    return a.per === per.a;
  }).reduce(function(s, a) {
    return s + (+a.min || 0);
  }, 0), out = [];
  runs.forEach(function(r) {
    for (var j = 0; j + 5 <= r.length; j += 5) {
      var id = r[j].s, min = Math.round(r.slice(j, j + 5).reduce(function(s, x) {
        return s + x.min;
      }, 0) / 5 * 2);
      if (done.indexOf(id) >= 0) continue;
      if (credited + min > 1680) return;
      out.push({ id, a: r[j].dt, b: r[j + 4].dt, k: r[j].k, min });
    }
  });
  return out;
}

/** Carte proposant d'ajouter le fractionnement. */
function fracCard(x) {
  return '<div class="card pad" style="border-color:var(--note)"><b>5 jours de congé principal du ' + fmtD(x.a)
      + " au " + fmtD(x.b) + '</b><span class="tiny">Si ces jours sont pris sur ton congé principal, tu as droit à 2 jours de fractionnement ('
      + hm(x.min) + ').</span><div class="btns"><button class="btn small primary" data-act="fracadd" data-id="' + x.id
      + '" data-min="' + x.min + '">Ajouter ' + hm(x.min) + '</button><button class="btn small" data-act="fracno" data-id="'
      + x.id + '">Non merci</button></div></div>';
}

/** Carte d'un compteur : reste, barre pris / prévu / reste, et formulaire « Corriger » (recopie du relevé). */
function cptCard(o) {
  var H = o.u === "h", f = function(v) {
    return H ? hm(v) : fmtJ(v) + " j";
  };
  var big = f(o.reste), sm = H ? "≈ " + fmtJ(o.reste / 420) + " jour" + (Math.abs(o.reste) >= 840 ? "s" : "")
      : hm(o.reste * 420), tot = Math.max(o.acq, o.pris
      + o.prevu, 1e-4);
  var bar = '<div class="cbar"><i style="width:' + o.pris / tot * 100 + '%;background:var(--abs)"></i><i style="width:'
      + o.prevu / tot * 100 + '%;background:var(--note)"></i><i style="width:' + Math.max(0, o.reste) / tot * 100 + "%;background:"
      + (o.k === "recup" ? "var(--ok)" : "var(--accent)") + '"></i></div>';
  var h = '<div class="ccard' + (o.reste <= 0 ? " zero" : "") + '"><div class="ctop"><b>' + esc(o.n) + "</b><small>"
      + (o.prevu ? "reste après prévus" : "reste") + '</small></div><div class="cval"><span class="mono">' + big + "</span><span>"
      + sm + "</span></div>" + bar + '<div class="cleg"><span>Acquis <b>' + f(o.acq) + "</b></span><span>Pris <b>" + f(o.pris)
      + "</b>" + (o.cet ? " dont CET " + f(o.cet) : "") + "</span><span>Prévu <b>" + f(o.prevu) + "</b></span>"
          + (S.fix === o.k ? "" : '<button class="linkbtn" data-act="fix" data-k="'
      + o.k + '">Corriger</button>') + "</div>";
  if (S.fix === o.k) {
    var b = (S.settings.cpt || {})[o.k] || {};
    var ia = o.acq - (o.k === "recup" ? o.gain : 0) - (o.k === "frac" ? (b.adds || []).reduce(function(s, a) {
      return s + (+a.min || 0);
    }, 0) : 0);
    h += '<div class="row2"><div class="field"><label for="cf-a">Acquis (relevé)</label><input type="text" id="cf-a" data-act="cfix" value="'
        + (H ? hm(o.acq) : o.acq) + '"></div><div class="field"><label for="cf-p">Pris (relevé)</label><input type="text" id="cf-p" data-act="cfix" value="'
        + (H ? hm(o.pris) : o.pris) + `"></div></div><div class="tiny">Recopie les colonnes « Acquis » et « Pris » de ton relevé d'aujourd'hui. Les jours que tu poses après aujourd'hui seront retirés automatiquement.</div><div class="btns"><button class="btn small primary" data-act="fixsave">Enregistrer</button><button class="btn small" data-act="fixno">Annuler</button></div>`;
  }
  return h + "</div>";
}

/** Enregistre le relevé saisi pour un compteur : il devient le nouveau point de départ, daté d'aujourd'hui. */
function saveCounter(k) {
  var o = S._cpt[k], H = o.u === "h", a = document.getElementById("cf-a").value, p = document.getElementById("cf-p").value;
  var va = H ? parseHM(a) : parseFloat(String(a).replace(",", ".")), vp = H ? parseHM(p) : parseFloat(String(p).replace(",", "."));
  if (va == null || isNaN(va) || vp == null || isNaN(vp)) {
    toast("Valeur incorrecte");
    return;
  }
  var td = /* @__PURE__ */ new Date(), cp = S.settings.cpt = S.settings.cpt || {}, old = cp[k] || {};
  if (k === "recup") cp.recup = { year: td.getFullYear(), acq: va, pris: vp, ref: ymdStr(td), refT: Date.now(), from: keyOf(mondayOf(td)) };
  else {
    var per = cpPeriod(td).a, adds = (old.adds || []).filter(function(x) {
      return x.per === per;
    });
    if (k === "frac") va -= adds.reduce(function(s, x) {
      return s + (+x.min || 0);
    }, 0);
    cp[k] = { per, acq: va, pris: vp, ref: ymdStr(td), refT: Date.now(), adds: old.adds, done: old.done };
  }
  saveSettings();
}

/** Carte du CET : solde sur 140 h, derniers placements, formulaires d'ajout et de correction. */
function cetCard(o) {
  var pct = Math.min(100, o.solde / o.max * 100), over = o.solde > o.max, h = '<div class="ccard' + (o.solde <= 0 ? " zero" : "")
      + '"><div class="ctop"><b>' + esc(o.n) + '</b><small>au compte</small></div><div class="cval"><span class="mono">'
      + hm(o.solde) + "</span><span>≈ " + fmtJ(o.solde / 420) + " jour" + (o.solde >= 840 ? "s" : "") + '</span></div><div class="cbar"><i style="width:'
      + pct + "%;background:" + (over ? "var(--warn)" : "var(--accent)") + '"></i></div><div class="cleg"><span><b>'
      + hm(o.solde) + "</b> sur <b>" + hm(o.max) + "</b> max (20 jours)</span><span>" + (over ? "plafond dépassé" : "encore "
      + hm(o.max - o.solde) + " possibles") + "</span></div>";
  o.moves.slice(0, 6).forEach(function(m) {
    var src = CPT_DEF[m.src] || { n: "?" };
    h += '<div class="tiny" style="border-top:1px solid var(--line);padding-top:5px;display:flex;justify-content:space-between;gap:8px"><span>'
        + fmtD(new Date(+m.date.slice(0, 4), +m.date.slice(5, 7) - 1, +m.date.slice(8, 10))) + "/" + m.date.slice(0, 4)
        + " · +" + hm(+m.min || 0) + " depuis " + esc(src.n.toLowerCase()) + (src.u === "j" ? " (" + fmtJ(+m.qty) + " j)" : "")
        + '</span><button class="linkbtn" data-act="cetdel" data-id="' + esc(m.id) + '">Supprimer</button></div>';
  });
  if (S.fix === "cet") h += '<div class="field"><label for="cf-c">Solde de ton CET (Pléiade ou relevé)</label><input type="text" id="cf-c" value="'
      + hm(o.solde) + '"></div><div class="btns"><button class="btn small primary" data-act="cetfix">Enregistrer</button><button class="btn small" data-act="fixno">Annuler</button></div>';
  else if (S.fix === "cetadd") {
    var cn = S._cpt;
    h += '<div class="field"><label for="cf-src">Pris sur</label><select id="cf-src" data-act="cetsrc">' + CET_SRC.map(function(k) {
      var c = cn[k], H = c.u === "h";
      return '<option value="' + k + '"' + (S.cetSrc === k ? " selected" : "") + ">" + esc(c.n) + " · " + (H ? hm(c.reste) : fmtJ(c.reste)
          + " j") + " dispo</option>";
    }).join("") + '</select></div><div class="field"><label for="cf-q2">' + ((CPT_DEF[S.cetSrc || "recup"]
        || {}).u === "j" ? "Nombre de jours" : "Heures placées")
        + '</label><input type="text" id="cf-q2" placeholder="' + ((CPT_DEF[S.cetSrc || "recup"] || {}).u === "j" ? "1" : "35:00")
        + `"></div><div class="tiny">Le placement est appliqué tout de suite : retiré du compteur d'origine, ajouté au CET.</div><div class="btns"><button class="btn small primary" data-act="cetsave">Ajouter</button><button class="btn small" data-act="fixno">Annuler</button></div>`;
  } else h += '<div class="btns"><button class="btn small" data-act="fix" data-k="cetadd">+ Placement fait dans Pléiade</button><button class="btn small" data-act="fix" data-k="cet">Corriger</button></div>';
  return h + "</div>";
}

/**
 * Enregistre une correction du solde ("fix") ou un placement fait dans Pléiade ("add").
 * @returns {boolean} false si la saisie est incorrecte.
 */
function saveCet(kind) {
  var cp = S.settings.cpt = S.settings.cpt || {}, ce = cp.cet = cp.cet || { moves: [] };
  ce.moves = ce.moves || [];
  if (kind === "fix") {
    var v = parseHM(document.getElementById("cf-c").value);
    if (v == null) {
      toast("Valeur incorrecte");
      return false;
    }
    ce.solde = v;
    ce.ref = ymdStr(/* @__PURE__ */ new Date());
    ce.refT = Date.now();
    saveSettings();
    toast("CET mis à jour");
    return true;
  }
  var k = document.getElementById("cf-src").value, u = CPT_DEF[k].u, raw = document.getElementById("cf-q2").value,
      q = u === "j" ? parseFloat(String(raw).replace(",", ".")) : parseHM(raw);
  if (q == null || isNaN(q) || q <= 0) {
    toast("Quantité incorrecte");
    return false;
  }
  var min = u === "j" ? Math.round(q * 420) : q, c = S._cpt;
  ce.moves.push({ id: Date.now().toString(36), t: Date.now(), date: ymdStr(/* @__PURE__ */ new Date()), src: k, qty: u === "j" ? q : min, min });
  saveSettings();
  var tot = c.cet.solde + min;
  toast("CET : " + hm(tot) + " sur " + hm(CET_MAX) + (tot > CET_MAX ? " · plafond dépassé" : ""));
  return true;
}

/** L'écran Compteurs. */
function viewBank() {
  var st = S.settings, cn = S._cpt || counters(st, S.weeks), out = "<section>";
  out += "<h2>À ne pas oublier</h2>" + viewReminders(false);
  fracCands().forEach(function(x) {
    out += fracCard(x);
  });
  var up = upcoming();
  out += '<h2>Prochaines échéances</h2><div class="card ech">';
  if (!up.length) out += '<div class="erow"><span></span><span class="tiny">Rien de prévu. Écris une note dans une semaine à venir (« Vacances », « Formation soudure ») ou pose des jours de congé.</span><span></span></div>';
  up.slice(0, 8).forEach(function(x) {
    out += '<div class="erow"><span class="wk' + (x.note || !x.conge ? " n" : "") + '">S' + x.k.slice(6) + "</span><div><b>"
        + esc(x.title) + "</b><small>" + (fmtD(x.a) === fmtD(x.b) ? "le " + fmtD(x.a) : "du " + fmtD(x.a) + " au " + fmtD(x.b))
        + (x.det ? " · " + esc(x.det) : "") + '</small></div><button class="calbtn" data-act="ics" data-k="' + x.k + '">+ Calendrier</button></div>';
  });
  out += "</div>" + (up.length > 1 ? '<button class="btn small" data-act="icsall">Tout ajouter au Calendrier</button>' : "");
  out += "<h2>Heures à récupérer · " + cn.recup.period.label + "</h2>" + cptCard(cn.recup);
  out += "<h2>Congés payés · " + cn.cp.period.label + '</h2><div class="cgrid">' + cptCard(cn.cp) + cptCard(cn.c5) + cptCard(cn.frac) + "</div>";
  out += '<h2>Autres droits (en jours)</h2><div class="cgrid">' + cptCard(cn.anc) + cptCard(cn.csup) + "</div>";
  out += "<h2>Compte épargne-temps (CET)</h2>" + cetCard(cn.cet);
  out += '<button class="btn" data-act="sverif" style="width:100%">Vérifier mes soldes avec la compta</button>';
  var acq = (st.cpt || {}).cpacq;
  out += `<div class="tiny">CP en cours d'acquisition (pour la période suivante) : ` + (acq != null ? '<b class="mono">'
      + hm(acq) + "</b> · ≈ " + fmtJ(acq / 420) + " jours" : "non renseigné") + ' · <button class="linkbtn" data-act="fix" data-k="cpacq">Modifier</button></div>';
  if (S.fix === "cpacq") out += `<div class="card pad"><div class="field"><label for="cf-q">CP en cours d'acquisition (relevé)</label><input type="text" id="cf-q" data-act="cfix" value="`
      + (acq != null ? hm(acq) : "") + '"></div><div class="btns"><button class="btn small primary" data-act="fixacq">Enregistrer</button><button class="btn small" data-act="fixno">Annuler</button></div></div>';
  var s = soldeCalc(st, S.weeks);
  out += '<h2>Historique des fiches envoyées</h2><div class="card ledger">';
  if (!s.rows.length) out += '<div class="lrow"><span class="tiny">Aucune fiche envoyée depuis le point de départ du compteur.</span></div>';
  s.rows.slice().reverse().forEach(function(r) {
    var m = monOfKey(r.k);
    out += '<div class="lrow"><div><b>S' + +r.k.slice(6) + '</b> <span class="tiny">' + fmtD(m) + " · HS " + hm(r.c.hs)
        + " · nuit " + hm(r.c.night) + '</span></div><span class="mono pos">' + hm(r.c.gain, true) + '</span><span class="mono">'
        + hm(r.after) + "</span></div>";
  });
  return out + "</div></section>";
}
export { exportIcs, fracCands, fracCard, reminders, saveCet, saveCounter, upcoming, viewBank, viewReminders };
