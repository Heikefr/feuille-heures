/* EXCEL — exports au format Excel, avec la bibliothèque ExcelJS (chargée depuis un CDN, version fixe).
 */
import { CONGE_H, CONGE_J, DAYN, EXTRAS, fmtD, isWork, monOfKey, weekCalc } from "./calculs.js";
import { soldeCalc } from "./compteurs.js";
import { S, TODAY, week } from "./etat.js";
import { shareFile, toast } from "./outils.js";
import { saveWeek } from "./stockage.js";
import { BCOLS, MOIS, bilanData } from "./ecran-bilan.js";
import { subject } from "./ecran-envoi.js";
import { render } from "./ecran-rendu.js";

/** Exporte le bilan de l'année affichée (un mois par ligne). */
async function bilanExport() {
  if (typeof ExcelJS === "undefined") {
    toast("Le module Excel n'a pas chargé. Recharge la page.");
    return;
  }
  var y = S.by || TODAY.getFullYear(), B = bilanData(y), st = S.settings, wb = new ExcelJS.Workbook(), ws = wb.addWorksheet("Bilan " + y);
  ws.addRow(["Bilan " + y + (st.profil.nom ? " – " + st.profil.nom : "")]);
  ws.getRow(1).font = { bold: true, size: 14 };
  ws.addRow([]);
  var hr = ws.addRow(["Mois"].concat(BCOLS.map(function(c) {
    return c[1];
  })));
  hr.font = { bold: true };
  hr.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCDCD4" } };
  var val = function(c, v) {
    return c[2] === "n" ? v : v / 1440;
  };
  B.M.forEach(function(m, i) {
    ws.addRow([MOIS[i]].concat(BCOLS.map(function(c) {
      return val(c, m[c[0]]);
    })));
  });
  var tr = ws.addRow(["Total"].concat(BCOLS.map(function(c) {
    return val(c, B.T[c[0]]);
  })));
  tr.font = { bold: true };
  ws.getColumn(1).width = 14;
  BCOLS.forEach(function(c, j) {
    var col = ws.getColumn(j + 2);
    col.width = 13;
    if (c[2] !== "n") for (var r = 4; r <= 17; r++) ws.getCell(r, j + 2).numFmt = "[h]:mm";
  });
  var buf = await wb.xlsx.writeBuffer();
  shareFile(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "bilan-heures-"
      + y + ".xlsx", "Bilan " + y);
}

/**
 * Exporte la semaine affichée dans un fichier Excel.
 * @param {boolean} validate Ancien paramètre (valider la semaine après l'export) ; toujours false aujourd'hui.
 */
async function doExport(validate) {
  if (typeof ExcelJS === "undefined") {
    toast("Le module Excel n'a pas chargé. Recharge la page.");
    return;
  }
  var w = week(), st = S.settings, c = weekCalc(w, st), mon = monOfKey(S.cur), now = /* @__PURE__ */ new Date();
  var sentAt = fmtD(now) + "/" + now.getFullYear() + " à " + String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
  var soldeAvant = soldeCalc(st, S.weeks).solde - (w.validated ? 0 : 0);
  var buf = await buildXlsx(w, c, mon, st, validate ? sentAt : w.sentAt || sentAt, w.validated ? soldeAvant : soldeAvant + c.net);
  var name = "Feuille_heures_S" + String(+S.cur.slice(6)).padStart(2, "0") + "_" + S.cur.slice(0, 4) + (st.profil.nom ? "_"
      + st.profil.nom.replace(/[^\wÀ-ÿ-]+/g, "_") : "") + ".xlsx";
  var blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  var ok = await shareFile(blob, name, subject(), "Bonjour,\n\nVeuillez trouver ci-joint ma feuille d'heures de la semaine "
      + +S.cur.slice(6) + ".\n\nCordialement,\n" + (st.profil.nom || ""));
  if (!ok) {
    toast("Envoi annulé : la semaine n'est pas validée");
    return;
  }
  if (validate) {
    w.validated = true;
    w.sentAt = sentAt;
    saveWeek();
  }
  S.lastExport = S.cur;
  render();
  toast(validate ? "Fiche créée, semaine validée" : "Fiche recréée");
}

/**
 * Construit le classeur de la semaine : en-tête, grille des 7 jours, bilan, observation.
 * @returns {Promise<ArrayBuffer>} Contenu du fichier .xlsx.
 */
async function buildXlsx(w, c, mon, st, sentAt, soldeApres) {
  var wb = new ExcelJS.Workbook();
  wb.creator = st.profil.nom || "Feuille d'heures";
  var ws = wb.addWorksheet("S" + +S.cur.slice(6), { pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 1, paperSize: 9 } });
  ws.columns = [{ width: 34 }].concat(DAYN.map(function() {
    return { width: 11 };
  })).concat([{ width: 12 }]);
  var T = "[h]:mm", thin = { style: "thin", color: { argb: "FF9AA7B4" } }, border = { top: thin, left: thin, bottom: thin, right: thin };
  var HEAD = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2B38" } }, SUB = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE7EBEF" } }, HL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFBEEDD" } };
  ws.mergeCells("A1:I1");
  var t = ws.getCell("A1");
  t.value = "FICHE DE TRAVAIL & ABSENCES";
  t.font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  t.fill = HEAD;
  t.alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(1).height = 28;
  var sun = new Date(mon);
  sun.setDate(sun.getDate() + 6);
  var info = [["Nom", st.profil.nom, "Matricule", st.profil.matricule], ["Poste", st.profil.poste, "Site", st.profil.site], ["Semaine", +S.cur.slice(6)
      + " / " + S.cur.slice(0, 4), "Période", "du " + fmtD(mon) + "/" + mon.getFullYear() + " au " + fmtD(sun) + "/"
      + sun.getFullYear()]];
  info.forEach(function(r2, i2) {
    var row = 3 + i2;
    ws.getCell(row, 1).value = r2[0] + " :";
    ws.getCell(row, 1).font = { bold: true };
    ws.mergeCells(row, 2, row, 4);
    ws.getCell(row, 2).value = r2[1] || "";
    ws.getCell(row, 5).value = r2[2] + " :";
    ws.getCell(row, 5).font = { bold: true };
    ws.mergeCells(row, 6, row, 9);
    ws.getCell(row, 6).value = r2[3] || "";
  });
  var hr = 7, hdr = ws.getRow(hr);
  hdr.getCell(1).value = "";
  for (var i = 0; i < 7; i++) {
    var d = new Date(mon);
    d.setDate(d.getDate() + i);
    hdr.getCell(2 + i).value = DAYN[i] + " " + fmtD(d);
  }
  hdr.getCell(9).value = "TOTAL";
  hdr.eachCell({ includeEmpty: true }, function(cl) {
    cl.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cl.fill = HEAD;
    cl.alignment = { horizontal: "center" };
    cl.border = border;
  });
  var r = hr + 1;
  function line(label, vals, fmt, total, opt) {
    var row = ws.getRow(r++);
    row.getCell(1).value = label;
    row.getCell(1).font = { bold: !!(opt && opt.bold) };
    for (var i2 = 0; i2 < 7; i2++) {
      var v = vals[i2];
      var cl = row.getCell(2 + i2);
      if (v !== "" && v != null && v !== 0) {
        cl.value = fmt === T ? v / 1440 : v;
        if (fmt) cl.numFmt = fmt;
      }
      cl.alignment = { horizontal: "center" };
    }
    var tc = row.getCell(9);
    if (total !== void 0 && total !== "" && total !== 0) {
      tc.value = fmt === T ? total / 1440 : total;
      if (fmt) tc.numFmt = fmt;
    }
    tc.font = { bold: true };
    tc.alignment = { horizontal: "center" };
    row.eachCell({ includeEmpty: true }, function(cl2, n) {
      if (n <= 9) cl2.border = border;
      if (opt && opt.fill) cl2.fill = opt.fill;
    });
  }
  var days = w.days.map(function(d2) {
    return d2 || {};
  });
  var sumv = function(a) {
    return a.reduce(function(s, v) {
      return s + (+v || 0);
    }, 0);
  };
  line("Équipe / motif", days.map(function(d2, i2) {
    var dc = c.days[i2];
    return isWork(d2) ? dc.team + (d2.type === "perso" ? "" : " (" + dc.label + ")") : dc.abs ? dc.label : "";
  }), null, "", { fill: SUB, bold: true });
  line("Début", days.map(function(d2) {
    return isWork(d2) ? d2.start : "";
  }), T);
  line("Fin", days.map(function(d2) {
    return isWork(d2) ? d2.end <= d2.start ? d2.end + 1440 : d2.end : "";
  }), T);
  line("Pause", days.map(function(d2) {
    return isWork(d2) ? +d2.pause || 0 : "";
  }), T, sumv(days.map(function(d2) {
    return isWork(d2) ? +d2.pause || 0 : 0;
  })));
  line("Nombre total d'heures de travail", c.days.map(function(x) {
    return x.worked;
  }), T, c.worked, { bold: true, fill: HL });
  line("HEURE DE NUIT", c.days.map(function(x) {
    return x.night;
  }), T, c.night, { bold: true });
  line("Prime de panier 3001", c.days.map(function(x) {
    return x.panier;
  }), "0", c.panier);
  line("Prime d'équipe 3008", c.days.map(function(x) {
    return x.panier;
  }), "0", c.panier);
  line("Indemnité de Samedi 3006", c.days.map(function(x) {
    return x.sam;
  }), "0", c.sam);
  line("Formation permanente (GA 40)", c.days.map(function(x) {
    return x.formJour;
  }), T, c.formation);
  line("Grève AN", c.days.map(function(x) {
    return x.greveJour + x.x.greve;
  }), T, c.greve);
  EXTRAS.slice(1).forEach(function(e) {
    line(e[2], c.days.map(function(x) {
      return x.x[e[0]];
    }), T, c.x[e[0]]);
  });
  line("Congés payés", c.days.map(function(x) {
    return CONGE_H[x.abs] ? x.counted : "";
  }), T, c.conge);
  line("Ancienneté / congés supplémentaires", c.days.map(function(x) {
    return CONGE_J[x.abs] ? x.counted : "";
  }), T, c.days.reduce(function(s, x) {
    return s + (CONGE_J[x.abs] ? x.counted : 0);
  }, 0));
  line("Jour férié", c.days.map(function(x) {
    return x.abs === "ferie" ? x.counted : "";
  }), T, c.ferie);
  line("Maladie", c.days.map(function(x) {
    return x.abs === "maladie" ? x.counted : "";
  }), T, c.maladie);
  line("Récupération prise", c.days.map(function(x) {
    return x.abs === "recup" ? +st.comptes.recup || 0 : "";
  }), T, c.debit);
  line("Absence", c.days.map(function(x) {
    return x.abs === "absence" ? "Abs." : "";
  }), null, c.absence || "");
  r++;
  var R = st.regles;
  ws.mergeCells(r, 1, r, 4);
  var sh = ws.getCell(r, 1);
  sh.value = "BILAN DE LA SEMAINE";
  sh.font = { bold: true, color: { argb: "FFFFFFFF" } };
  sh.fill = HEAD;
  r++;
  function kv(l, v, fmt, bold) {
    ws.mergeCells(r, 1, r, 3);
    var a = ws.getCell(r, 1), b = ws.getCell(r, 4);
    a.value = l;
    b.value = fmt === T ? v / 1440 : v;
    if (fmt) b.numFmt = fmt;
    b.alignment = { horizontal: "center" };
    [1, 2, 3, 4].forEach(function(n) {
      ws.getCell(r, n).border = border;
    });
    if (bold) {
      a.font = { bold: true };
      b.font = { bold: true };
      b.fill = HL;
    }
    r++;
  }
  kv("Total heures de la semaine (absences comprises)", c.counted, T, true);
  kv("Seuil hebdomadaire", R.seuil, T);
  kv("Heures supplémentaires", c.hs, T, true);
  kv("dont majorées à " + R.taux1 + " %", c.hs1, T);
  if (c.hs2) kv("dont majorées à " + R.taux2 + " %", c.hs2, T);
  kv("Majoration des heures sup", c.majHs, T);
  if (c.samedi) {
    kv("Heures du samedi (hors seuil)", c.samedi, T);
    kv("Majoration samedi (" + R.samTaux + " %)", c.majSam, T);
  }
  kv("Majoration heures de nuit (" + R.nuit + " %)", c.majNuit, T);
  kv(c.recupMode ? "Heures sup à récupérer" : "Heures sup à payer", c.hs, T);
  kv("Total à récupérer cette semaine", c.gain, T, true);
  kv("Récupération prise", c.debit, T);
  kv("Solde du compteur après cette semaine", soldeApres, T, true);
  r++;
  ws.getCell(r, 1).value = "OBSERVATION :";
  ws.getCell(r, 1).font = { bold: true };
  ws.mergeCells(r, 2, r + 2, 9);
  var o = ws.getCell(r, 2);
  o.value = w.obs || "";
  o.alignment = { vertical: "top", wrapText: true };
  o.border = border;
  r += 3;
  r++;
  ws.getCell(r, 1).value = "Envoyé le " + sentAt;
  ws.getCell(r, 1).font = { italic: true, color: { argb: "FF5B6876" } };
  return await wb.xlsx.writeBuffer();
}
export { bilanExport, doExport };
