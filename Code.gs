/**
 * FEUILLE D'HEURES — script de synchronisation iPhone ↔ PC, version 1.0
 *
 * INSTALLATION (une seule fois, sur le PC, avec ton compte Google perso)
 * 1) Crée un Google Sheet vide nommé « Feuille d'heures — données ».
 * 2) Menu Extensions > Apps Script. Efface tout le contenu de Code.gs et colle ce fichier. Enregistre.
 * 3) En haut, choisis la fonction « installer » puis Exécuter. Accepte les autorisations
 *    (« Paramètres avancés > Accéder au projet » si Google affiche un avertissement : c'est normal pour un script perso).
 * 4) Déployer > Nouveau déploiement > roue dentée > Application Web.
 *    Exécuter en tant que : Moi. Qui a accès : Tout le monde. Déployer, puis copie l'adresse qui finit par /exec.
 * 5) Le code d'accès est dans l'onglet « Code d'accès » du Sheet. Ne le partage avec personne.
 */

var VERSION = '1.0';
var ONGLET = 'Données';
var ONGLET_CODE = "Code d'accès";

function installer() {
  var p = PropertiesService.getScriptProperties();
  if (!p.getProperty('cle')) p.setProperty('cle', genere_());
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(ONGLET) || ss.insertSheet(ONGLET);
  if (sh.getLastRow() === 0) {
    sh.appendRow(['Clé', 'Modifié dans l\'appli (ms)', 'Reçu par le script (ms)', 'Données (JSON)']);
    sh.setFrozenRows(1);
    sh.setColumnWidth(4, 600);
  }
  var c = ss.getSheetByName(ONGLET_CODE) || ss.insertSheet(ONGLET_CODE);
  c.clear();
  c.getRange('A1:B3').setValues([
    ["Code d'accès", p.getProperty('cle')],
    ['À quoi il sert', "À saisir une fois dans l'appli : Réglages › Synchronisation"],
    ['Important', 'Ne le partage avec personne. Pour en changer, efface la propriété « cle » du script puis relance installer.']
  ]);
  c.setColumnWidth(1, 160); c.setColumnWidth(2, 520);
  Logger.log("Code d'accès : " + p.getProperty('cle'));
}

function genere_() {
  var car = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = '';
  for (var i = 0; i < 16; i++) s += car.charAt(Math.floor(Math.random() * car.length));
  return s;
}

function doGet(e) { return reponse_(traite_((e && e.parameter) || {})); }
function doPost(e) {
  var q = {};
  try { q = JSON.parse(e.postData.contents); } catch (x) {}
  return reponse_(traite_(q));
}
function reponse_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function traite_(q) {
  var cle = PropertiesService.getScriptProperties().getProperty('cle');
  if (!cle || q.cle !== cle) return { ok: false, err: "Code d'accès incorrect" };
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ONGLET);
  if (!sh) return { ok: false, err: 'Lance la fonction installer dans le script' };
  var now = Date.now();

  if (q.action === 'ping') return { ok: true, now: now, version: VERSION };

  if (q.action === 'pull') {
    var since = +q.since || 0, n = sh.getLastRow(), out = [];
    var v = n > 1 ? sh.getRange(2, 1, n - 1, 4).getValues() : [];
    v.forEach(function (r) {
      if (+r[2] > since) { try { out.push({ k: String(r[0]), t: +r[1], d: JSON.parse(r[3]) }); } catch (x) {} }
    });
    return { ok: true, now: now, items: out };
  }

  if (q.action === 'push') {
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      var m = sh.getLastRow(), lignes = m > 1 ? sh.getRange(2, 1, m - 1, 4).getValues() : [], idx = {}, refus = [], ok = 0;
      lignes.forEach(function (r, i) { idx[String(r[0])] = { row: i + 2, t: +r[1], d: r[3] }; });
      (q.items || []).forEach(function (it) {
        if (!it || !it.k) return;
        var s = JSON.stringify(it.d), cur = idx[it.k];
        if (cur) {
          if (+it.t >= cur.t) { sh.getRange(cur.row, 2, 1, 3).setValues([[+it.t, now, s]]); ok++; }
          else { try { refus.push({ k: it.k, t: cur.t, d: JSON.parse(cur.d) }); } catch (x) {} }
        } else {
          sh.appendRow([it.k, +it.t, now, s]);
          idx[it.k] = { row: sh.getLastRow(), t: +it.t, d: s }; ok++;
        }
      });
      return { ok: true, now: now, accepted: ok, rejected: refus };
    } finally { lock.releaseLock(); }
  }
  return { ok: false, err: 'Action inconnue' };
}
