/* STOCKAGE — lecture, contrôle, conversion et enregistrement des données sur l'appareil.
 *
 * Format enregistré (clé localStorage « feuille-heures-v1 », fichiers de sauvegarde, Google Sheet) :
 *   { app:"feuille-heures", format:SCHEMA, version, exporte, settings:{…},
 *     weeks:{ "AAAA-Wss":{ days:[7 jours], note, obs, validated, sentAt, check } } }
 * Un jour : null ou { type:"sch:<id>"|"perso"|<absence>, start, end, pause (minutes), team, label, dur, auto, x:{autres heures} }.
 *
 * CONTRAINTE 1.0 : ce format et cette clé sont ceux de la 0.10. Ils ne doivent pas changer tant que des
 * appareils peuvent encore tourner en 0.10 (trois appareils synchronisés, mis à jour à des moments différents).
 */
import { defaultSettings } from "./calculs.js";
import { S, VERSION, week } from "./etat.js";
import { deepMerge, toast } from "./outils.js";
import { touch } from "./synchro.js";
import { prefAppareil } from "./appareil.js";

/** Minuteries en cours (p = enregistrement différé). */
var timers = {};

/**
 * Signale qu'une semaine a changé : elle sera synchronisée et enregistrée sous peu.
 * @param {string} [k] Clé de la semaine (par défaut la semaine affichée).
 */
function saveWeek(k) {
  k = k || S.cur;
  week(k);
  touch("w:" + k);
  queue();
}

/** Signale que les réglages ont changé : synchronisation et enregistrement. */
function saveSettings() {
  touch("settings");
  queue();
}

/** Numéro du format des données. Augmente à chaque changement de format ; les conversions sont dans migrate(). */
var SCHEMA = 2;

/** Clés de stockage : les données, et la date du dernier fichier de sauvegarde exporté. */
var KEY = "feuille-heures-v1", KEY_BK = "feuille-heures-backup";

/** Forme d'une clé de semaine valide : « 2026-W46 ». */
var WK_RE = /^\d{4}-W\d{2}$/;

/**
 * Contrôle une semaine venue de l'extérieur (fichier, synchro) : 7 jours, nombres valides.
 * @returns {object|null} La semaine nettoyée, ou null si elle est inutilisable.
 */
function cleanWeek(w) {
  if (!w || typeof w !== "object" || Array.isArray(w)) return null;
  var d = Array.isArray(w.days) ? w.days.slice(0, 7) : [];
  while (d.length < 7) d.push(null);
  w.days = d.map(function(x) {
    if (!x || typeof x !== "object") return null;
    ["start", "end", "pause", "dur", "theo"].forEach(function(f) {
      if (x[f] != null && !isFinite(+x[f])) delete x[f];
    });
    if (x.x && typeof x.x !== "object") x.x = {};
    return x;
  });
  return w;
}

/**
 * Contrôle un lot de semaines.
 * @returns {{weeks:object, bad:number}} Les semaines valides et le nombre de semaines écartées.
 */
function cleanWeeks(ws) {
  var out = {}, bad = 0;
  if (!ws || typeof ws !== "object") return { weeks: out, bad: 0 };
  Object.keys(ws).forEach(function(k) {
    var w = WK_RE.test(k) ? cleanWeek(ws[k]) : null;
    if (w) out[k] = w;
    else bad++;
  });
  return { weeks: out, bad };
}

/** Programme un enregistrement dans 300 ms (regroupe les frappes rapprochées). */
function queue() {
  clearTimeout(timers.p);
  timers.p = setTimeout(persist, 300);
}

/* Fermeture ou mise en arrière-plan : un enregistrement en attente est fait tout de suite. */
window.addEventListener("pagehide", function() {
  if (timers.p) {
    clearTimeout(timers.p);
    persist();
  }
});

/* Idem quand l'appli passe en arrière-plan (iPhone). */
document.addEventListener("visibilitychange", function() {
  if (document.hidden && timers.p) {
    clearTimeout(timers.p);
    persist();
  }
});

/** Photographie complète des données, au format des sauvegardes. */
function snapshot() {
  return { app: "feuille-heures", format: SCHEMA, version: VERSION, exporte: (/* @__PURE__ */ new Date()).toISOString().slice(0,
      16), settings: S.settings, weeks: S.weeks };
}

/**
 * Enregistre les données sur l'appareil.
 * En mode secours (données illisibles), n'écrit rien : voir secours.js.
 * @returns {boolean} false si rien n'a été écrit.
 */
function persist() {
  if (S.readErr) return false;
  try {
    localStorage.setItem(KEY, JSON.stringify(snapshot()));
    return true;
  } catch (e) {
    toast("Impossible d'enregistrer sur cet appareil");
    return false;
  }
}

/**
 * Charge des données (stockage, fichier, sauvegarde) dans l'appli.
 * Lève une erreur si elles sont inutilisables ou viennent d'une version plus récente (« plus récent »).
 */
function applyData(d) {
  if (!d || typeof d !== "object") throw new Error("format");
  if (+d.format > SCHEMA) throw new Error("plus récent");
  if (d.settings && typeof d.settings === "object") S.settings = deepMerge(defaultSettings(S.cur), d.settings);
  if (d.weeks) {
    var cw = cleanWeeks(d.weeks);
    S.weeks = cw.weeks;
    S.badWeeks = cw.bad;
  }
  migrate();
  applyTheme();
}

/**
 * Conversions des anciens formats, dans l'ordre. Chacune est sans effet si elle a déjà été faite.
 * Complète aussi les horaires sans durée théorique.
 */
function migrate() {
  var def = {};
  defaultSettings("").horaires.forEach(function(h) {
    def[h.id] = h;
  });
  migrate14();
  if ((S.settings.schema || 1) < 2) {
    S.settings.schema = 2;
  }
  (S.settings.horaires || []).forEach(function(h) {
    var dh = def[h.id];
    if (h.theo == null) h.theo = dh ? dh.theo : 420;
    if (h.fri && h.fri.theo == null) h.fri.theo = dh && dh.fri ? dh.fri.theo : h.theo;
  });
}

/** Ancienne conversion : horaires nommés « Matin 1 »… renommés par leurs heures ; calcul des heures sup à la semaine. */
function migrate14b() {
  if (S.settings.mig14b) return;
  var names = { m1: "Matin 1", m2: "Matin 2", m3: "Matin 3", s2: "Soir 2", s3: "Soir 3", j: "Journée" };
  (S.settings.horaires || []).forEach(function(h) {
    if (names[h.id] && h.label === names[h.id]) h.label = "";
  });
  Object.keys(S.weeks).forEach(function(k) {
    (S.weeks[k].days || []).forEach(function(d) {
      if (d && /^sch:/.test(d.type || "") && names[d.type.slice(4)] === d.label) d.label = "";
    });
  });
  S.settings.regles.hsCalc = "semaine";
  S.settings.mig14b = true;
}

/** Ancienne conversion : types « conge » et « cjour » devenus « cp » et « csup ». */
function migrateTypes() {
  Object.keys(S.weeks).forEach(function(k) {
    (S.weeks[k] && S.weeks[k].days || []).forEach(function(d) {
      if (d && d.type === "conge") d.type = "cp";
      if (d && d.type === "cjour") d.type = "csup";
    });
  });
}

/** Ancienne conversion : horaire Matin 3 ramené à 5h30 – 12h30 (accord). */
function migrate15() {
  migrateTypes();
  if (S.settings.mig15) return;
  (S.settings.horaires || []).forEach(function(h) {
    if (h.id === "m3" && h.start === 330 && h.end === 780) {
      h.end = 750;
      h.fri = null;
    }
  });
  S.settings.mig15 = true;
}

/** Ancienne conversion : variante du vendredi de l'ancien Matin 3. Enchaîne les deux précédentes. */
function migrate14() {
  migrate14b();
  migrate15();
  if (S.settings.mig14) return;
  (S.settings.horaires || []).forEach(function(h) {
    if (h.id === "m3" && !h.fri && h.end === 780) h.fri = { start: 330, end: 720, pause: 0, theo: 420 };
  });
  S.settings.mig14 = true;
}

/** Thème en vigueur sur cet appareil : "light", "dark" ou "auto". Le choix de l'appareil passe avant l'ancien réglage synchronisé (voir appareil.js). */
function themeChoisi() {
  return prefAppareil("theme") || S.settings.theme || "auto";
}

/** Applique le thème choisi (clair, sombre, ou automatique selon l'appareil). */
function applyTheme() {
  var th = themeChoisi(), r = document.documentElement;
  if (th === "light" || th === "dark") r.setAttribute("data-theme", th);
  else r.removeAttribute("data-theme");
}

/**
 * Lecture des données de l'appareil au démarrage.
 * Si le texte enregistré existe mais ne peut pas être relu (abîmé, ou écrit par une version plus récente),
 * on passe en « mode secours » : S.readErr garde le texte d'origine, plus rien n'est enregistré ni synchronisé,
 * et l'écran de secours demande quoi faire. (En 0.10, le premier enregistrement écrasait tout.)
 * Si c'est le stockage lui-même qui est inaccessible, simple bandeau d'avertissement (S.storeErr).
 */
function loadLocal() {
  var raw = null;
  try {
    raw = localStorage.getItem(KEY);
    if (raw) applyData(JSON.parse(raw));
  } catch (e) {
    if (raw == null) {
      S.storeErr = true;
      return;
    }
    S.readErr = { raw, recent: String(e && e.message) === "plus récent" };
    S.settings = defaultSettings(S.cur);
    S.weeks = {};
  }
}
export { themeChoisi, KEY_BK, SCHEMA, WK_RE, applyData, applyTheme, cleanWeek, cleanWeeks, loadLocal, migrate, persist, saveSettings, saveWeek, snapshot };
