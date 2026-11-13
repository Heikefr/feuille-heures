/* SECOURS — mode affiché quand les données de l'appareil sont illisibles au démarrage.
 *
 * Principe : tant que l'utilisateur n'a pas choisi, RIEN n'est écrit (voir persist, touch, syncNow, addSnap).
 * Quel que soit son choix, le texte illisible est d'abord copié sous la clé KEY_RESCUE (rescueDone),
 * d'où il peut encore être exporté depuis Réglages › Sauvegardes. Couvert par tests/4-surete.test.js.
 */
import { defaultSettings, ymdStr } from "./calculs.js";
import { S } from "./etat.js";
import { esc, fmtDT, shareFile, toast } from "./outils.js";
import { applyData, persist } from "./stockage.js";
import { SY, applyRemote, saveSync, syncAdopt, syncApi } from "./synchro.js";
import { getSnaps } from "./sauvegardes.js";
import { render } from "./ecran-rendu.js";

/** Clé de stockage où le texte illisible est mis de côté : { date, raw }. */
var KEY_RESCUE = "feuille-heures-illisible";

/** Écran de secours : remplace toute l'appli. Les boutons proposés dépendent de ce qui existe sur l'appareil. */
function viewRescue() {
  var e = S.readErr, sn = getSnaps();
  var h = '<main><div class="wrap" style="max-width:520px;padding-top:32px"><section><div class="card pad" role="alert"><b style="font-size:19px">'
      + (e.recent ? "Ces données viennent d'une version plus récente" : "Tes données n'ont pas pu être lues")
          + `</b><div style="font-size:14.5px;color:var(--muted)">Rien n'a été modifié ni effacé. `
      + (e.recent ? "Cet appareil utilise encore une ancienne version de l'appli : recharge la page pour la mettre à jour."
          : "Choisis quoi faire avant de continuer.")
      + "</div>";
  if (e.recent) h += '<button class="btn primary" data-act="rsreload">Recharger la page</button>';
  if (sn.length) h += '<button class="btn" data-act="rssnap">Restaurer la sauvegarde du ' + esc(fmtDT(sn[0].date)) + "</button>";
  if (SY.api) h += '<button class="btn" data-act="rssheet">Récupérer depuis le Google Sheet</button>';
  h += '<label class="btn" for="imp" style="text-align:center">Importer un fichier de sauvegarde…</label><input type="file" id="imp" accept=".json,application/json" hidden><button class="btn" data-act="rsexport">Exporter les données brutes</button><button class="reset'
      + (S.confirm === "rszero" ? " primary" : "") + '" data-act="rszero">' + (S.confirm === "rszero" ? "Confirmer : repartir d'une appli vide ?"
          : "Repartir d'une appli vide")
      + '</button><div class="tiny">Quel que soit ton choix, les données illisibles restent de côté sur cet appareil : tu pourras encore les exporter dans Réglages › Sauvegardes.</div>';
  return h + "</div></section></div></main>";
}

/**
 * Met le texte illisible de côté puis quitte le mode secours.
 * @returns {boolean} false (on reste en mode secours) si la copie est impossible : on n'écrase jamais le seul exemplaire.
 */
function rescueDone() {
  var e = S.readErr;
  if (!e) return true;
  try {
    localStorage.setItem(KEY_RESCUE, JSON.stringify({ date: (/* @__PURE__ */ new Date()).toISOString(), raw: e.raw }));
  } catch (x) {
    toast("Stockage plein : exporte d'abord les données brutes");
    return false;
  }
  S.readErr = null;
  S.confirm = null;
  return true;
}

/** Téléchargement du texte illisible, tel quel (en mode secours, ou plus tard depuis Sauvegardes). */
function rescueExport() {
  var raw = S.readErr ? S.readErr.raw : null;
  if (raw == null) {
    try {
      raw = JSON.parse(localStorage.getItem(KEY_RESCUE)).raw;
    } catch (x) {
    }
  }
  if (raw == null) {
    toast("Rien à exporter");
    return;
  }
  shareFile(new Blob([raw], { type: "text/plain" }), "feuille-heures-donnees-brutes-" + ymdStr(/* @__PURE__ */ new Date())
      + ".txt", "Données brutes Feuille d'heures");
}

/** Rappel, dans Réglages › Sauvegardes, des données mises de côté ("" s'il n'y en a pas). */
function rescueKept() {
  var k = null;
  try {
    k = JSON.parse(localStorage.getItem(KEY_RESCUE));
  } catch (x) {
  }
  if (!k) return "";
  return '<div class="banner info"><span>Des données illisibles du ' + esc(fmtDT(k.date)) + ' sont gardées de côté.</span><span class="btns"><button class="btn small" data-act="rsexport">Exporter</button><button class="btn small danger'
      + (S.confirm === "rsforget" ? " primary" : "") + '" data-act="rsforget">' + (S.confirm === "rsforget" ? "Supprimer ?" : "Supprimer")
      + "</button></span></div>";
}

/**
 * Boutons de l'écran de secours.
 * @param {string} a Action : rsreload, rsexport, rszero, rssnap, rssheet.
 */
function rescueAct(a) {
  if (a === "rsreload") {
    location.reload();
  } else if (a === "rsexport") {
    rescueExport();
  } else if (a === "rszero") {
    if (S.confirm !== "rszero") {
      S.confirm = "rszero";
      render();
      return;
    }
    if (!rescueDone()) return;
    persist();
    render();
    toast("Appli remise à vide");
  } else if (a === "rssnap") {
    var s = getSnaps()[0];
    if (!s) return;
    try {
      applyData(JSON.parse(JSON.stringify(s.data)));
    } catch (x) {
      S.settings = defaultSettings(S.cur);
      S.weeks = {};
      toast("Cette sauvegarde est illisible elle aussi");
      return;
    }
    if (!rescueDone()) {
      S.settings = defaultSettings(S.cur);
      S.weeks = {};
      return;
    }
    persist();
    render();
    toast("Sauvegarde du " + fmtDT(s.date) + " restaurée");
    if (SY.api) {
      SY.meta = {};
      SY.dirty = {};
      SY.last = 0;
      syncAdopt().then(function() {
        render();
      }, function(x) {
        SY.err = String(x && x.message || x);
        saveSync();
        render();
      });
    }
  } else if (a === "rssheet") {
    rescueSheet();
  }
}

/**
 * Reconstruit les données de l'appareil à partir du Google Sheet.
 * Rien n'est remplacé si le Sheet ne répond pas ou est vide.
 */
async function rescueSheet() {
  toast("Récupération en cours…");
  var p;
  try {
    p = await syncApi("pull", { since: 0 });
  } catch (x) {
    toast("Récupération impossible : " + (x && x.message || x));
    return;
  }
  var items = p.items || [];
  if (!items.length) {
    toast("Le Google Sheet ne contient aucune donnée");
    return;
  }
  if (!rescueDone()) return;
  S.settings = defaultSettings(S.cur);
  S.weeks = {};
  SY.meta = {};
  SY.dirty = {};
  items.forEach(applyRemote);
  SY.last = Math.max(0, (p.now || 0) - 1e4);
  SY.lastOk = Date.now();
  SY.err = "";
  saveSync();
  persist();
  render();
  toast(items.length + " élément(s) récupéré(s) depuis le Google Sheet");
}
export { KEY_RESCUE, rescueAct, rescueDone, rescueExport, rescueKept, viewRescue };
