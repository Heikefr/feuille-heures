/* FICHE — la « fiche de travail & d'absences » envoyée au service paye.
 *
 * La fiche est une IMAGE dessinée à l'identique de la fiche papier jaune (1000 × 720 points).
 * CONTRAINTE : elle doit rester identique pixel pour pixel à celle de la 0.10 (tests/2-fiche.test.js).
 * Ne modifier ni les coordonnées, ni les polices, ni l'ordre des tracés sans y être obligé.
 */
import { ABSC, DAYL, dayDate, ferieOf, fmtD, hm, isWork, toTime } from "./calculs.js";
import { S } from "./etat.js";
import { h2m } from "./outils.js";

/**
 * Prépare le texte de chaque case de la fiche.
 * @param {object} w Semaine. @param {object} c Son calcul (weekCalc). @param {object} st Réglages.
 * @returns {object} Listes de 7 textes par ligne (theo, debut, fin, trav, hsr, nuit, panier…), totaux, et obs :
 *   observations automatiques (férié, récup ou congé posé) suivies de celles saisies, 6 lignes au plus.
 */
function ficheData(w, c, st) {
  var days = w.days.map(function(d) {
    return d || {};
  }), F = { matricule: st.profil.matricule || "", nom: st.profil.nom || "", semaine: +S.cur.slice(6) };
  function v(f) {
    return c.days.map(function(x2, i2) {
      var r = f(x2, i2);
      return r ? r : "";
    });
  }
  F.theo = v(function(x2, i2) {
    return isWork(days[i2]) && x2.theo ? h2m(x2.theo) : "";
  });
  F.debut = v(function(x2, i2) {
    return isWork(days[i2]) ? toTime(days[i2].start) : x2.abs && !(i2 > 4 && x2.abs === "ferie") ? ABSC[x2.abs] : "";
  });
  F.fin = v(function(x2, i2) {
    return isWork(days[i2]) ? toTime(days[i2].end) : x2.abs && !(i2 > 4 && x2.abs === "ferie") ? ABSC[x2.abs] : "";
  });
  F.trav = v(function(x2) {
    return x2.worked ? hm(x2.worked) : "";
  });
  F.travTot = c.worked ? hm(c.worked) : "";
  var hs = c.hsDay.slice();
  hs[5] = c.days[5].samedi;
  var hsT = c.hs + c.samedi;
  F.hsr = c.recupMode ? hs.map(function(m) {
    return m ? h2m(m) : "";
  }) : [];
  F.hsrTot = c.recupMode && hsT ? h2m(hsT) : "";
  F.hsp = !c.recupMode ? hs.map(function(m) {
    return m ? h2m(m) : "";
  }) : [];
  F.hspTot = !c.recupMode && hsT ? h2m(hsT) : "";
  F.nuit = v(function(x2) {
    return x2.night ? h2m(x2.night) : "";
  });
  F.nuitTot = c.night ? h2m(c.night) : "";
  F.panier = v(function(x2) {
    return x2.panier ? "1" : "";
  });
  F.equipe = F.panier;
  F.sam = v(function(x2) {
    return x2.sam ? "1" : "";
  });
  F.ga40 = v(function(x2) {
    return x2.formJour ? h2m(x2.formJour) : "";
  });
  F.greve = v(function(x2) {
    var g = x2.greveJour + x2.x.greve;
    return g ? h2m(g) : "";
  });
  ["ga10", "elec", "ga20", "ga80", "g001"].forEach(function(k) {
    F[k] = v(function(x2) {
      return x2.x[k] ? h2m(x2.x[k]) : "";
    });
  });
  var obs = [];
  for (var i = 0; i < 7; i++) {
    var dt = dayDate(S.cur, i), fn = ferieOf(dt), x = c.days[i];
    if (fn && i < 5 && x.abs === "ferie") obs.push(DAYL[i] + " " + fmtD(dt) + " : férié (" + fn + ").");
    if (x.recupP) obs.push(DAYL[i] + " " + fmtD(dt) + " : départ à " + toTime(days[i].end) + ", " + hm(x.recupP) + " d'heures à récupérer posée.");
    if (x.congeP) obs.push(DAYL[i] + " " + fmtD(dt) + " : " + hm(x.congeP) + " de congé payé posé.");
  }
  String(w.obs || "").split(/\n/).forEach(function(l) {
    if (l.trim()) obs.push(l.trim());
  });
  // La fiche papier n'a la place que pour 6 lignes d'observations : les suivantes ne sont pas dessinées.
  F.obs = obs.slice(0, 6);
  F.net = c.net;
  return F;
}

/** Tailles d'envoi de l'image : code → [échelle, libellé]. La largeur dans le mail vaut échelle × 1000 pixels. */
var FT = { s: [0.9, "Petite"], m: [1.2, "Moyenne"], l: [1.5, "Grande"], xl: [2, "Très grande"] };

/** Échelle choisie dans l'écran d'envoi (Grande par défaut). */
function ficheScale(st) {
  return (FT[st.ficheT] || FT.l)[0];
}

/**
 * Dessine la fiche.
 * @param {number} [sc=2] Échelle de dessin (2 pour l'aperçu à l'écran).
 * @returns {HTMLCanvasElement}
 */
function ficheCanvas(w, c, st, sc) {
  var cv = document.createElement("canvas"), F = ficheData(w, c, st);
  var W = 1e3, H = 720, SC = sc || 2;
  cv.width = W * SC;
  cv.height = H * SC;
  var x = cv.getContext("2d");
  x.scale(SC, SC);
  var Y = "#FFFDB0", LINE = "#555", GRAY = "#D6D6CC", SERIF = '"Times New Roman",Times,serif', SANS = "Arial,Helvetica,sans-serif";
  x.fillStyle = Y;
  x.fillRect(0, 0, W, H);
  function rect(a2, b2, w2, h, fill) {
    if (fill) {
      x.fillStyle = fill;
      x.fillRect(a2, b2, w2, h);
    }
    x.strokeStyle = LINE;
    x.lineWidth = 1;
    x.strokeRect(a2 + 0.5, b2 + 0.5, w2, h);
  }
  function txt(s, a2, b2, o) {
    o = o || {};
    x.fillStyle = o.color || "#111";
    x.font = (o.it ? "italic " : "") + (o.bold ? "bold " : "") + (o.size || 12) + "px " + (o.font || SANS);
    x.textAlign = o.align || "left";
    x.textBaseline = "middle";
    x.fillText(s, a2, b2);
  }
  rect(38, 30, 924, 660);
  x.fillStyle = GRAY;
  x.fillRect(39, 31, 923, 30);
  txt("FICHE DE TRAVAIL & D'ABSENCES", 500, 47, { bold: 1, size: 22, font: SERIF, align: "center" });
  txt("Matricule :", 48, 84, { bold: 1, size: 17, font: SERIF });
  rect(160, 70, 200, 26, "#FFFFD6");
  txt(F.matricule, 260, 84, { size: 17, align: "center" });
  txt("NOM :", 430, 84, { bold: 1, size: 17, font: SERIF });
  rect(490, 70, 280, 26, "#FFFFD6");
  txt(F.nom, 630, 84, { size: 17, it: 1, bold: 1, color: "#1b2a7a", align: "center", font: SERIF });
  txt("Semaine", 800, 84, { bold: 1, size: 17, font: SERIF });
  rect(890, 58, 60, 38, "#FFFFE8");
  txt(String(F.semaine), 920, 77, { size: 20, bold: 1, color: "#1b2a7a", align: "center" });
  var L0 = 48, LW = 180, CW = 64, X0 = L0 + LW, TW = 90, XT = X0 + 7 * CW, y = 104;
  function row(h, label, vals, tot, o) {
    o = o || {};
    var n = o.n || 7;
    rect(L0, y, LW, h, o.fill);
    (Array.isArray(label) ? label : [label]).forEach(function(l, i3, a2) {
      txt(l, o.center ? L0 + LW / 2 : L0 + 8, y + h / 2 + (i3 - (a2.length - 1) / 2) * 14, { bold: o.bold, size: o.ls || 11.5, align: o.center ? "center" : "left" });
    });
    for (var i2 = 0; i2 < n; i2++) {
      rect(X0 + i2 * CW, y, CW, h, o.fill);
      var v = vals && vals[i2];
      if (v) txt(v, X0 + i2 * CW + CW / 2, y + h / 2, { size: o.vs || 15, bold: o.vb, align: "center" });
    }
    if (!o.noTot) {
      rect(XT, y, TW, h, o.fill);
      if (tot) txt(tot, XT + TW / 2, y + h / 2, { size: o.ts || 15, bold: 1, align: "center" });
    }
    y += h;
  }
  rect(L0, y, LW, 26);
  ["L", "M", "M", "J", "V", "S", "D"].forEach(function(d, i2) {
    rect(X0 + i2 * CW, y, CW, 26);
    txt(d, X0 + i2 * CW + CW / 2, y + 13, { bold: 1, size: 16, align: "center" });
  });
  rect(XT, y, TW, 26);
  txt("TOTAL", XT + TW / 2, y + 13, { size: 15, align: "center" });
  y += 26;
  row(32, "HORAIRE Théorique", F.theo, "35 Heures", { bold: 1, ts: 12 });
  rect(L0, y, LW, 48);
  txt("HORAIRE", L0 + 24, y + 17, { bold: 1, size: 11 });
  txt("DECALE", L0 + 24, y + 31, { bold: 1, size: 11 });
  txt("DEBUT ➡", L0 + LW - 8, y + 12, { bold: 1, size: 10.5, align: "right" });
  txt("FIN ➡", L0 + LW - 8, y + 36, { bold: 1, size: 10.5, align: "right" });
  for (var i = 0; i < 7; i++) {
    rect(X0 + i * CW, y, CW, 24);
    rect(X0 + i * CW, y + 24, CW, 24);
    var a = F.debut[i], b = F.fin[i];
    if (a) txt(a, X0 + i * CW + CW / 2, y + 12, { size: a.length > 5 ? 12 : 14.5, bold: a.length > 5, align: "center" });
    else if (i > 4) txt("H", X0 + i * CW + CW / 2, y + 12, { size: 9, align: "center", color: "#555" });
    if (b) txt(b, X0 + i * CW + CW / 2, y + 36, { size: b.length > 5 ? 12 : 14.5, bold: b.length > 5, align: "center" });
    else if (i > 4) txt("H", X0 + i * CW + CW / 2, y + 36, { size: 9, align: "center", color: "#555" });
  }
  rect(XT, y, TW, 24);
  rect(XT, y + 24, TW, 24);
  y += 48;
  row(54, ["Nombre total d'heure de", "TRAVAIL  (G000)    ➡"], F.trav, F.travTot ? "➡  " + F.travTot : "", { bold: 1, ls: 12.5, vs: 16, center: 1, ts: 19 });
  row(24, "Heures suppl à récupérer", F.hsr, F.hsrTot, { vb: 1 });
  row(24, "Heures suppl à payer", F.hsp, F.hspTot, { vb: 1 });
  var yn = y;
  row(24, "HEURES DE NUIT", F.nuit, F.nuitTot, { bold: 1, center: 1, fill: GRAY, ls: 11 });
  x.fillStyle = GRAY;
  x.fillRect(XT + TW + 1, yn + 1, 962 - XT - TW - 2, 23);
  rect(XT + TW, yn, 962 - XT - TW, 24);
  row(24, "Prime de panier  3001", F.panier, null, { n: 6, noTot: 1 });
  row(24, "Prime d'équipe  3008", F.equipe, null, { n: 6, noTot: 1 });
  row(24, "Indemnité de Samedi  3006", F.sam, null, { n: 6, noTot: 1 });
  [["Formation permanente (GA 40)", F.ga40], ["Grève AN", F.greve], ["Informations syndicales (GA 10)", F.ga10], ["Election Délégué Personnel CE", F.elec], ["Heures de Réunion  (GA 20)", F.ga20], ["Crédit d'heures       (GA 80)", F.ga80], ["Réunion info vœux   (G001)", F.g001]].forEach(function(r) {
    row(21, r[0], r[1], null, { n: 5, noTot: 1, ls: 10.5, vs: 13 });
  });
  y += 14;
  txt("OBSERVATIONS :", L0 + 40, y + 12, { bold: 1, size: 12 });
  F.obs.forEach(function(l, i2) {
    txt(l, L0 + 170, y + 12 + i2 * 18, { size: 13, color: "#1b2a7a" });
  });
  return cv;
}

/** Dessiner la fiche coûte environ 45 ms : l'image affichée est gardée tant que son contenu (ficheData) ne change pas. */
var FICHE_MEMO = { k: null, u: null };

/** Image de la fiche pour l'affichage (adresse « data: »), avec cache. */
function ficheURL(w, c, st) {
  var k = JSON.stringify(ficheData(w, c, st));
  if (FICHE_MEMO.k !== k) {
    FICHE_MEMO.k = k;
    FICHE_MEMO.u = ficheCanvas(w, c, st).toDataURL("image/png");
  }
  return FICHE_MEMO.u;
}

/**
 * Image de la fiche à copier dans le presse-papiers ou à partager, à la taille d'envoi choisie.
 * @returns {Promise<Blob>}
 */
function ficheBlob(w, c, st) {
  var cv = ficheCanvas(w, c, st, ficheScale(st));
  return new Promise(function(res) {
    cv.toBlob(function(b) {
      res(b);
    }, "image/png");
  });
}
export { FT, ficheBlob, ficheCanvas, ficheData, ficheURL };
