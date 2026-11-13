/* ÉCRAN D'ENVOI — aperçu de la fiche, destinataires, copie de l'image et ouverture d'Outlook.
 */
import { fmtD, weekCalc } from "./calculs.js";
import { S, week } from "./etat.js";
import { esc, mailList, toast } from "./outils.js";
import { saveWeek } from "./stockage.js";
import { addSnap } from "./sauvegardes.js";
import { FT, ficheBlob, ficheObsEnTrop, ficheTaille, ficheURL } from "./fiche.js";
import { render } from "./ecran-rendu.js";

/**
 * Destinataires, objet et liens d'ouverture de la messagerie.
 * Outlook s'ouvre par un lien « ms-outlook:// » ; les adresses y sont séparées par des points-virgules.
 */
function sendUrls() {
  var st = S.settings, to = mailList(st.mails.paye), cc = st.mails.ccResp ? mailList(st.mails.resp) : [], subj = subject();
  return {
    to,
    cc,
    subj,
    ol: "ms-outlook://compose?to=" + to.map(encodeURIComponent).join(";") + (cc.length ? "&cc=" + cc.map(encodeURIComponent).join(";") : "")
        + "&subject=" + encodeURIComponent(subj),
    mt: "mailto:" + to.join(";") + "?subject=" + encodeURIComponent(subj) + (cc.length ? "&cc=" + cc.join(";") : "")
  };
}

/** L'écran d'envoi (fenêtre sur PC, plein écran sur iPhone). */
function viewSend() {
  var w = week(), st = S.settings, c = weekCalc(w, st), u = sendUrls(), n = +S.cur.slice(6), D = S.desk;
  var who = u.to.map(function(x) {
    return '<div class="swho"><small>À</small><span>' + esc(x) + "</span></div>";
  }).join("") + u.cc.map(function(x) {
    return '<div class="swho"><small>Cc</small><span>' + esc(x) + "</span></div>";
  }).join("");
  if (!u.to.length) who = '<div class="banner warn">Aucune adresse du service paye. <button class="btn small" data-act="dgo" data-t="set" data-p="dest">Les saisir</button></div>';
  // Observations trop longues pour la fiche : on prévient, sans rien changer à la fiche.
  var enTrop = ficheObsEnTrop(w, c, st);
  var obsAlerte = enTrop ? '<div class="banner warn"><span>' + (enTrop > 1 ? enTrop + " lignes d'observation ne tiennent pas"
      : "1 ligne d'observation ne tient pas")
      + ' sur la fiche (6 lignes au plus). Elles ne seront pas envoyées.</span>' + (w.validated ? "" : '<span class="btns"><button class="btn small" data-act="obsfix">Raccourcir</button></span>')
          + "</div>" : "";
  var steps = D ? ["La fiche est copiée" + (w.validated ? "." : " et la semaine passe en « envoyée »."), "Outlook s'ouvre avec les destinataires et l'objet.",
      "Clique dans le message et colle avec <b>Ctrl+V</b>."] : ["La fiche est copiée"
      + (w.validated ? "." : ", la semaine passe en « envoyée »."), "Outlook s'ouvre, destinataires et objet remplis.",
          "Dans le message : appui long puis <b>Coller</b>."];
  return '<div class="sendov" role="dialog" aria-modal="true" aria-label="Envoyer la fiche"><div class="sendbg" data-act="sendclose"></div><div class="sendm"><div class="sendh"><b>'
      + (w.validated ? "Renvoyer la fiche S" + n : D ? "Envoyer la semaine " + n + " au service paye" : "Envoyer la S"
      + n) + '</b><button class="btn small" data-act="sendclose">✕ Fermer</button></div><div class="sendf"><div class="slab">Ce qui partira dans le mail</div><img class="fiche-img" alt="Fiche de la semaine '
      + n + '" src="' + ficheURL(w, c, st) + '"><div class="ftaille"><span>Taille dans le mail</span><div class="seg">'
      + Object.keys(FT).map(function(k) {
    return '<button class="' + (ficheTaille() === k ? "on" : "") + '" data-act="ftaille" data-v="' + k + '">' + FT[k][1] + "</button>";
  }).join("") + "</div><small>" + Math.round(FT[ficheTaille()][0] * 1e3) + ' px de large</small></div></div><div class="sendr"><div class="slab">Destinataires</div><div class="swhos">'
      + who + '</div><div class="sobj">Objet : <b>' + esc(u.subj) + "</b></div>" + (w.validated ? '<div class="tiny">Envoyée le '
      + esc(w.sentAt || "") + ". La renvoyer ne change rien dans l'appli.</div>" : "") + '<div class="sgrow"></div>' + obsAlerte
      + (u.to.length ? '<a class="btn primary sgo" href="' + esc(u.ol) + '" data-act="sendgo" data-m="ol">Copier la fiche et ouvrir Outlook</a>'
          : '<button class="btn primary sgo" disabled>Copier la fiche et ouvrir Outlook</button>')
      + (S.sendFail ? `<div class="banner warn" style="display:block">La copie automatique n'a pas marché. `
          + (D ? "Fais un clic droit sur la fiche puis « Copier l'image »" : "Fais un appui long sur la fiche puis « Copier »")
      + ', puis <a class="linkbtn" href="' + esc(u.ol) + '" data-act="sendgo" data-m="nocopy">ouvre Outlook</a>.</div>' : "")
      + '<ol class="ssteps">' + steps.map(function(x) {
    return "<li>" + x + "</li>";
  }).join("") + '</ol><div class="slinks">Pas Outlook ? <a class="linkbtn" href="' + esc(u.mt) + '" data-act="sendgo" data-m="mail">Autre messagerie</a> · <button class="linkbtn" data-act="export">Fichier Excel</button></div></div></div></div>';
}

/**
 * Bouton « Copier la fiche et ouvrir Outlook » : la semaine passe en « envoyée » (sauvegarde automatique),
 * puis l'image est copiée. @param {string} mode "ol" Outlook, "mail" autre messagerie, "nocopy" sans copie.
 */
function sendGo(mode) {
  var w = week(), st = S.settings, c = weekCalc(w, st), done = false;
  if (!w.validated) {
    var now = /* @__PURE__ */ new Date();
    w.validated = true;
    w.sentAt = fmtD(now) + "/" + now.getFullYear() + " à " + String(now.getHours()).padStart(2, "0") + ":"
        + String(now.getMinutes()).padStart(2, "0");
    saveWeek();
    addSnap("Fiche S" + +S.cur.slice(6) + " validée", true);
  }
  S.lastExport = S.cur;
  var later = function(f) {
    setTimeout(f, 350);
  };
  var ok = function() {
    if (done) return;
    done = true;
    later(function() {
      S.send = false;
      S.sendFail = false;
      render();
      toast("Fiche copiée : colle-la dans le message");
    });
  };
  var ko = function() {
    if (done) return;
    done = true;
    later(function() {
      S.send = true;
      S.sendFail = true;
      render();
      toast("Copie impossible : copie l'image à la main");
    });
  };
  if (mode === "nocopy") {
    later(function() {
      S.send = false;
      S.sendFail = false;
      render();
    });
    return;
  }
  try {
    if (navigator.clipboard && window.ClipboardItem) {
      navigator.clipboard.write([new ClipboardItem({ "image/png": ficheBlob(w, c, st) })]).then(ok, ko);
      return;
    }
  } catch (e) {
  }
  ko();
}

/** Objet du mail : « Feuille d'heures S46 2026 – Nom (matricule) ». */
function subject() {
  var p = S.settings.profil;
  return "Feuille d'heures S" + +S.cur.slice(6) + " " + S.cur.slice(0, 4) + (p.nom ? " – " + p.nom : "") + (p.matricule ? " ("
      + p.matricule + ")" : "");
}
export { sendGo, subject, viewSend };
