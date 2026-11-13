/* ÉCRAN RÉGLAGES — liste façon iPhone, puis une page par sujet : profil, destinataires, horaires, règles de calcul,
 * affichage, synchronisation, sauvegardes, nouveautés.
 */
import { ABS, autoLabel, defaultSettings, hm, toTime } from "./calculs.js";
import { CHANGELOG, S, VERSION } from "./etat.js";
import { copyLine, esc, fmtDT, mailList } from "./outils.js";
import { themeChoisi } from "./stockage.js";
import { SY } from "./synchro.js";
import { backupDue, getSnaps, lastFileBackup } from "./sauvegardes.js";
import { rescueKept } from "./secours.js";

/** Pages des réglages : code → [titre, couleur de l'icône, icône]. */
var SETP = { profil: ["Profil", "#5b8def", "u"], dest: ["Destinataires", "#2f9e6b", "m"], horaires: ["Horaires",
    "#d9822b", "c"], regles: ["Règles de calcul", "#8a6bd1", "r"], aff: ["Affichage", "#6b7280", "t"], sync: ["Synchronisation",
    "#2563eb", "y"], save: ["Sauvegardes", "#0e8f9c", "s"], news: ["Nouveautés", "#e0a21b", "n"] };

/** Icônes des pages de réglages. */
var SICON = {
  u: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/></svg>',
  m: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
  c: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/></svg>',
  r: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 7h14M5 12h14M5 17h9"/></svg>',
  t: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor"/></svg>',
  s: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4"/></svg>',
  n: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z"/></svg>',
  y: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 0 0-14.3-4.9L4 8"/><path d="M4 3v5h5"/><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16"/><path d="M20 21v-5h-5"/></svg>'
};

/** Une ligne de la liste des réglages. @param {string} id Page. @param {string} val Résumé affiché à droite. */
function setRow(id, val) {
  var p = SETP[id];
  return '<button class="irow" data-act="setp" data-p="' + id + '"><span class="iic" style="background:' + p[1]
      + '">' + SICON[p[2]] + "</span><span>" + p[0] + "</span><em>" + esc(val) + '</em><span class="chev">›</span></button>';
}

/** L'écran Réglages (liste, ou page ouverte selon S.setPage). */
function viewSettings() {
  var st = S.settings, p = st.profil, m = st.mails, R = st.regles, pg = S.setPage;
  function f(path, label, val, type) {
    return '<div class="field"><label for="s-' + path + '">' + label + '</label><input type="' + (type || "text")
        + '" id="s-' + path + '" data-act="sset" data-p="' + path + '" value="' + esc(val) + '"></div>';
  }
  function ft(path, label, val) {
    return '<div class="field"><label for="s-' + path + '">' + label + '</label><input type="time" id="s-' + path
        + '" data-act="sset" data-p="' + path + '" data-time="1" value="' + toTime(val) + '"></div>';
  }
  if (!pg) {
    var nm = mailList(m.paye).length + (m.resp ? 1 : 0), bk = lastFileBackup(), sn = getSnaps();
    return '<section><div class="ios-t">Réglages</div><div class="igl">Moi</div><div class="igr">' + setRow("profil", p.nom || "À remplir")
        + setRow("dest", nm ? nm + " adresse" + (nm > 1 ? "s" : "") : "À remplir") + '</div><div class="igl">Travail</div><div class="igr">'
        + setRow("horaires", st.horaires.length + " horaires") + setRow("regles", rulesDefault() ? "Accords 2010" : "Personnalisées")
        + '</div><div class="igl">Appli</div><div class="igr">' + setRow("aff", { light: "Clair", dark: "Sombre" }[themeChoisi()] || "Automatique")
        + setRow("sync", SY.api ? SY.err ? "⚠ Erreur" : "Active" : "Désactivée") + setRow("save", (backupDue() ? "⚠ " : "")
        + (sn.length ? fmtDT(sn[0].date).slice(0, 5) : "Aucune")) + setRow("news", "v" + VERSION) + "</div></section>";
  }
  var out = '<section><button class="iback" data-act="setback">‹ Réglages</button><div class="ios-h">' + SETP[pg][0] + "</div>";
  if (pg === "profil") out += '<div class="card pad"><div class="row2">' + f("profil.nom", "Nom Prénom", p.nom)
      + f("profil.matricule", "Matricule", p.matricule) + f("profil.poste", "Poste", p.poste) + f("profil.site", "Site", p.site)
      + "</div></div>";
  if (pg === "dest") out += '<div class="card pad">' + f("mails.paye", "Gestionnaires des heures (séparées par ;)", m.paye, "email")
      + f("mails.resp", "Responsable", m.resp, "email") + '<label class="lbl"><input type="checkbox" data-act="sset" data-p="mails.ccResp" data-bool="1"'
      + (m.ccResp ? " checked" : "") + "> Mettre le responsable en copie</label></div>";
  if (pg === "horaires") {
    out += '<div class="card">';
    st.horaires.forEach(function(h, i) {
      out += '<div class="sched-edit"><div class="hd"><input type="text" aria-label="Nom" data-act="hset" data-i="'
          + i + '" data-k="label" value="' + esc(h.label) + '" placeholder="' + esc(autoLabel(h.start, h.end))
              + ' (automatique)"><select aria-label="Équipe" data-act="hset" data-i="'
          + i + '" data-k="team">' + ["Matin", "Soir", "Journée"].map(function(t) {
        return "<option" + (h.team === t ? " selected" : "") + ">" + t + "</option>";
      }).join("") + '</select><button class="btn small ghost" data-act="hdel" data-i="' + i + '" aria-label="Supprimer">✕</button></div><div class="row3">'
          + hin(i, "start", "Début", h.start) + hin(i, "end", "Fin", h.end) + hin(i, "pause", "Pause", h.pause) + hin(i, "theo", "Théorique", h.theo)
          + '</div><label class="tiny"><input type="checkbox" data-act="hfri" data-i="' + i + '"' + (h.fri ? " checked" : "")
          + "> Horaire différent le vendredi</label>" + (h.fri ? '<div class="row3">' + hin(i, "fri.start", "Ven. début", h.fri.start)
          + hin(i, "fri.end", "Ven. fin", h.fri.end) + hin(i, "fri.pause", "Ven. pause", h.fri.pause) + hin(i,
              "fri.theo", "Ven. théorique", h.fri.theo)
          + "</div>" : "") + "</div>";
    });
    out += '</div><button class="btn" data-act="hadd">Ajouter un horaire</button>';
  }
  if (pg === "regles") {
    out += '<div class="igl">Heures sup</div><div class="card pad"><div class="row2">' + ft("regles.seuil", "Seuil de la semaine", R.seuil)
        + ft("regles.palier", "1er palier d'heures sup", R.palier) + f("regles.taux1", "Majoration 1er palier (%)", R.taux1, "number")
        + f("regles.taux2", "Majoration au-delà (%)", R.taux2, "number") + '</div><div class="field"><label for="s-hs">Heures sup</label><select id="s-hs" data-act="sset" data-p="regles.hsMode"><option value="recup"'
        + (R.hsMode === "recup" ? " selected" : "") + '>À récupérer (compteur)</option><option value="payer"'
            + (R.hsMode === "payer" ? " selected" : "")
        + '>À payer</option></select></div><div class="field"><label for="s-hsc">Calcul des heures sup</label><select id="s-hsc" data-act="sset" data-p="regles.hsCalc"><option value="jour"'
        + (R.hsCalc === "jour" ? " selected" : "") + `>Jour par jour, au-delà de l'horaire théorique (ancien fichier)</option><option value="semaine"`
        + (R.hsCalc !== "jour" ? " selected" : "") + ">À la semaine, au-delà de " + hm(R.seuil) + ' (accord ARTT)</option></select></div></div><div class="igl">Nuit, samedi et primes</div><div class="card pad"><div class="row2">'
        + ft("regles.nuitDebut", "Nuit avant", R.nuitDebut) + ft("regles.nuitFin", "Nuit après", R.nuitFin)
            + f("regles.nuit", "Majoration de nuit (%)", R.nuit, "number")
        + f("regles.samTaux", "Majoration du samedi (%)", R.samTaux, "number") + ft("regles.panierMin", "Primes dès", R.panierMin)
        + '</div></div><div class="igl">Alertes</div><div class="card pad"><div class="row2">' + ft("regles.maxJour", "Au-delà de (jour)", R.maxJour)
        + ft("regles.maxSem", "Au-delà de (semaine)", R.maxSem) + `</div></div><div class="igl">Journées d'absence (heures comptées)</div><div class="card pad"><div class="row2">`;
    Object.keys(ABS).forEach(function(k) {
      out += ft("comptes." + k, ABS[k] + (k === "recup" ? " (débit)" : ""), st.comptes[k]);
    });
    out += '</div></div><button class="reset' + (S.confirm === "reset" ? " primary" : "") + '" data-act="resetrules">'
        + (S.confirm === "reset" ? "Confirmer : rétablir les valeurs des accords ?" : "Rétablir les valeurs des accords")
        + "</button>";
  }
  if (pg === "sync") {
    var ago = SY.lastOk ? Math.round((Date.now() - SY.lastOk) / 6e4) : null, nd = Object.keys(SY.dirty).length;
    out += '<div class="card pad">' + (SY.api ? '<div class="syncst"><i class="' + (SY.err ? "err" : "ok") + '"></i><b>'
        + (SY.err ? "Erreur : " + esc(SY.err) : "Synchronisation active") + "</b></div>" + (SY.err ? '<div class="tiny">Tes modifications sont gardées sur cet appareil. Nouvel essai automatique, et dès le retour du réseau.</div>'
            : "")
        + '<div class="tiny">Dernière synchronisation : ' + (ago == null ? "jamais" : ago < 1 ? "à l'instant" : "il y a "
        + ago + " min") + (nd ? " · " + nd + " modification(s) en attente" : "") + '</div><div class="btns"><button class="btn" data-act="syncnow">Synchroniser maintenant</button><button class="btn danger'
        + (S.confirm === "syncoff" ? " primary" : "") + '" data-act="syncoff">' + (S.confirm === "syncoff" ? "Confirmer ?" : "Désactiver")
        + "</button></div>" : `<div class="tiny">Relie l'iPhone et le PC à ton Google Sheet pour avoir les mêmes données partout. Suis le guide d'installation, puis colle ici l'adresse du script et le code d'accès (ou ouvre le lien d'installation).</div><div class="field"><label for="sy-api">Adresse du script (se termine par /exec)</label><input type="text" id="sy-api" data-act="syncf" placeholder="https://script.google.com/macros/s/…/exec" autocapitalize="off" autocorrect="off"></div><div class="field"><label for="sy-cle">Code d'accès</label><input type="text" id="sy-cle" data-act="syncf" placeholder="16 caractères" autocapitalize="characters" autocorrect="off"></div><button class="btn primary" data-act="syncconnect">Connecter</button>`)
        + `<a class="tiny" href="https://github.com/Heikefr/feuille-heures#synchronisation-iphone--pc" target="_blank" rel="noopener">Guide d'installation</a></div>`;
    if (SY.api) out += `<div class="tiny">Lien pour connecter un autre appareil : ouvre ce lien sur le PC ou l'iPhone.</div>`
        + copyLine("Lien", location.origin + location.pathname + "?api=" + encodeURIComponent(SY.api) + "&cle=" + encodeURIComponent(SY.cle));
  }
  if (pg === "aff") out += '<div class="card pad"><div class="field"><label for="s-theme">Thème</label><select id="s-theme" data-act="sset" data-p="theme"><option value="auto"'
      + (themeChoisi() !== "light" && themeChoisi() !== "dark" ? " selected" : "") + `>Automatique (comme l'iPhone)</option><option value="light"`
      + (themeChoisi() === "light" ? " selected" : "") + '>Clair</option><option value="dark"' + (themeChoisi() === "dark" ? " selected" : "")
      + ">Sombre</option></select></div></div>";
  if (pg === "save") out += viewSnaps().replace("<h2>Sauvegardes</h2>", "");
  if (pg === "news") out += '<div class="card">' + CHANGELOG.map(function(c, i) {
    return '<details style="border:0;border-bottom:1px solid var(--line);border-radius:0;background:none"' + (i === 0 ? " open" : "")
        + "><summary>Version " + c[0] + (c[0].indexOf("0.") === 0 ? " bêta" : "") + (c[0] === VERSION ? ' <span class="chip sent">Installée</span>' : "")
        + ' <span class="tiny">· ' + c[1] + '</span></summary><ul style="margin:0 0 12px;padding:0 14px 0 32px;font-size:14px;color:var(--muted)">'
        + c[2].map(function(x) {
      return "<li>" + esc(x) + "</li>";
    }).join("") + "</ul></details>";
  }).join("") + "</div>";
  return out + "</section>";
}

/** Vrai si les règles de calcul sont celles des accords (aucune valeur modifiée). */
function rulesDefault() {
  var d = defaultSettings(""), a = S.settings;
  return JSON.stringify(d.regles) === JSON.stringify(Object.assign({}, d.regles, a.regles)) && JSON.stringify(d.comptes) === JSON.stringify(Object.assign({},
      d.comptes, a.comptes));
}

/** Champ d'heure d'un horaire type. */
function hin(i, k, l, v) {
  return '<div class="field"><label class="tiny">' + l + '</label><input type="time" data-act="hset" data-i="'
      + i + '" data-k="' + k + '" data-time="1" value="' + toTime(v || 0) + '"></div>';
}

/** Page Sauvegardes : rappel d'export, boutons, liste des sauvegardes de l'appli. */
function viewSnaps() {
  var a = getSnaps(), bk = lastFileBackup(), out = "<h2>Sauvegardes</h2>";
  if (backupDue()) out += '<div class="banner warn">Aucun fichier de sauvegarde depuis plus de 30 jours. Exporte-en un dans Fichiers ou iCloud Drive.</div>';
  out += rescueKept();
  out += `<div class="card pad"><div class="tiny">Les sauvegardes de la liste restent dans l'appli : elles protègent d'une erreur de saisie, pas d'une suppression de l'appli. Pour ça, exporte un fichier de temps en temps.</div><div class="tiny">Dernier fichier exporté : `
      + (bk ? fmtDT(bk) : "jamais") + '</div><div class="btns"><button class="btn" data-act="snapnew">Sauvegarder maintenant</button><button class="btn" data-act="snapexp" data-id="">Exporter un fichier</button></div><label class="btn" for="imp" style="text-align:center">Importer un fichier…</label><input type="file" id="imp" accept=".json,application/json" hidden></div>';
  out += '<div class="card">';
  if (!a.length) out += `<div class="snap"><span class="tiny">Aucune sauvegarde pour l'instant. Une sauvegarde est créée automatiquement à chaque fiche validée.</span></div>`;
  a.forEach(function(s) {
    var nw = Object.keys(s.data && s.data.weeks || {}).length, cr = S.confirm === "r" + s.id, cd = S.confirm === "d" + s.id;
    out += '<div class="snap"><div><b>' + fmtDT(s.date) + '</b><div class="tiny">' + esc(s.label) + " · " + nw
        + ' semaine(s)</div></div><div class="btns"><button class="btn small' + (cr ? " primary" : "") + '" data-act="snaprest" data-id="'
        + s.id + '">' + (cr ? "Confirmer ?" : "Restaurer") + '</button><button class="btn small" data-act="snapexp" data-id="'
        + s.id + '" aria-label="Exporter">⤓</button><button class="btn small danger' + (cd ? " primary" : "") + '" data-act="snapdel" data-id="'
        + s.id + '" aria-label="Supprimer">' + (cd ? "Supprimer ?" : "✕") + "</button></div></div>";
  });
  out += "</div>";
  return out;
}
export { viewSettings };
