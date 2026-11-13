/* SYNCHRO — échanges avec le Google Sheet de l'utilisateur, par le script Code.gs.
 *
 * Chaque « document » a une clé : « settings » pour les réglages, « w:AAAA-Wss » pour une semaine.
 * Règle : la dernière modification gagne, document par document (heure de l'appareil qui a modifié).
 * Un document modifié ici est marqué « à envoyer » (SY.dirty) ; il le reste tant que l'envoi n'a pas réussi,
 * ce qui permet de travailler hors réseau.
 *
 * CONTRAINTE 1.0 : le dialogue avec Code.gs (actions ping, pull, push) est celui de la 0.10. Il ne change pas,
 * pour qu'aucun appareil n'ait à être reconnecté ni le script redéployé.
 */
import { defaultSettings } from "./calculs.js";
import { S } from "./etat.js";
import { deepMerge, toast } from "./outils.js";
import { WK_RE, applyTheme, cleanWeek, migrate, persist } from "./stockage.js";
import { addSnap } from "./sauvegardes.js";
import { render, safeRender } from "./ecran-rendu.js";

/**
 * Clé de stockage et état de la synchro.
 *   SY.api, SY.cle  adresse du script et code d'accès (vides si la synchro est désactivée)
 *   SY.meta         heure de dernière modification connue de chaque document
 *   SY.dirty        documents modifiés ici, pas encore envoyés
 *   SY.last         heure serveur de la dernière réception ; SY.lastOk, SY.err : dernier succès, dernière erreur
 */
var KEY_SYNC = "feuille-heures-sync", SY = (function() {
  try {
    return JSON.parse(localStorage.getItem(KEY_SYNC)) || {};
  } catch (e) {
    return {};
  }
})();

/* État complété au chargement (premier lancement). */
SY.meta = SY.meta || {};
SY.dirty = SY.dirty || {};

/** Enregistre l'état de la synchro sur l'appareil. */
function saveSync() {
  try {
    localStorage.setItem(KEY_SYNC, JSON.stringify(SY));
  } catch (e) {
  }
}

/**
 * Marque un document comme modifié maintenant ; envoi 1,5 s plus tard si la synchro est active.
 * @param {string} k « settings » ou « w:AAAA-Wss ».
 */
function touch(k) {
  if (S.readErr) return;
  SY.meta[k] = Date.now();
  SY.dirty[k] = 1;
  saveSync();
  if (SY.api) {
    clearTimeout(touch.t);
    touch.t = setTimeout(syncNow, 1500);
  }
}

/** Marque tout comme modifié (après une restauration ou un import) et lance l'envoi. */
function markAllDirty() {
  var n = Date.now();
  SY.meta.settings = n;
  SY.dirty.settings = 1;
  Object.keys(S.weeks).forEach(function(k) {
    SY.meta["w:" + k] = n;
    SY.dirty["w:" + k] = 1;
  });
  saveSync();
  if (SY.api) syncNow();
}

/** Contenu actuel d'un document, d'après sa clé. */
function docFor(k) {
  return k === "settings" ? S.settings : S.weeks[k.slice(2)] || null;
}

/** Applique un document reçu du Sheet aux données de l'appareil (après contrôle). */
function applyRemote(it) {
  if (it.k === "settings") {
    S.settings = deepMerge(defaultSettings(S.cur), it.d || {});
    migrate();
    applyTheme();
  } else if (it.k.indexOf("w:") === 0 && it.d && WK_RE.test(it.k.slice(2))) {
    var w = cleanWeek(it.d);
    if (w) S.weeks[it.k.slice(2)] = w;
  }
  SY.meta[it.k] = it.t;
}

/**
 * Appel du script Google, abandonné au bout de 20 s (réseau du site souvent faible).
 * @param {"pull"|"push"|"ping"} action @param {object} payload
 * @returns {Promise<object>} Réponse du script. Lève une erreur en clair (« Hors ligne », « Réseau indisponible »…).
 */
async function syncApi(action, payload) {
  var r, ac = window.AbortController ? new AbortController() : null, to = ac ? setTimeout(function() {
    ac.abort();
  }, 2e4) : 0;
  try {
    if (action === "pull") {
      var u = new URL(SY.api);
      u.searchParams.set("action", "pull");
      u.searchParams.set("cle", SY.cle);
      u.searchParams.set("since", payload.since || 0);
      r = await fetch(u.toString(), ac ? { signal: ac.signal } : {});
    } else r = await fetch(SY.api, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(Object.assign({ action, cle: SY.cle }, payload)), signal: ac ? ac.signal : void 0 });
  } catch (e) {
    throw new Error(navigator.onLine === false ? "Hors ligne" : e && e.name === "AbortError" ? "Pas de réponse (réseau lent)"
        : "Réseau indisponible");
  } finally {
    clearTimeout(to);
  }
  var j = await r.json();
  if (!j.ok) throw new Error(j.err || "Réponse refusée");
  return j;
}

/**
 * Coupures réseau : les modifications restent en attente (SY.dirty) et un nouvel essai est programmé
 * de plus en plus espacé (15 s, 30 s, 1 min, 2 min, 5 min). Le retour du réseau relance tout de suite.
 * syncing : un échange est en cours ; NET : nombre d'essais ratés et minuterie du prochain.
 */
var syncing = false, NET = { retry: 0, t: null };

/** Programme le prochain essai après un échec. */
function syncRetry() {
  clearTimeout(NET.t);
  if (!SY.api) return;
  var d = [15, 30, 60, 120, 300][Math.min(NET.retry, 4)] * 1e3;
  NET.retry++;
  NET.t = setTimeout(function() {
    syncNow();
  }, d);
}

/** Nombre de documents en attente d'envoi. */
function pendingCount() {
  return Object.keys(SY.dirty || {}).length;
}

/**
 * État de la synchro en clair, pour l'affichage.
 * @returns {{c:string, t:string}} c : "" (désactivée), "ok", "off" (hors ligne), "err" ; t : texte.
 */
function syncLabel() {
  var nd = pendingCount(), ago = SY.lastOk ? Math.round((Date.now() - SY.lastOk) / 6e4) : null;
  if (!SY.api) return { c: "", t: "Pas de synchronisation" };
  if (navigator.onLine === false || SY.err === "Hors ligne") return { c: "off", t: "Hors ligne" + (nd ? " · " + nd + " modif. en attente" : "") };
  if (SY.err) return { c: "err", t: "Synchro en échec" + (nd ? " · " + nd + " en attente" : "") + " · nouvel essai auto" };
  return { c: "ok", t: "Synchronisé" + (ago != null ? ago < 1 ? " à l'instant" : " il y a " + ago + " min" : "") };
}

/**
 * Un échange complet : envoi de ce qui attend, puis réception de ce qui a changé ailleurs.
 * Ne fait rien si la synchro est désactivée, déjà en cours, ou en mode secours.
 * @param {boolean} [manual] Vrai si demandé par le bouton (affiche le résultat).
 */
async function syncNow(manual) {
  if (!SY.api || syncing || S.readErr) return;
  syncing = true;
  var changed = false, hadErr = !!SY.err, sent = 0;
  clearTimeout(NET.t);
  try {
    var keys = Object.keys(SY.dirty);
    if (keys.length) {
      var items = keys.map(function(k) {
        return { k, t: SY.meta[k] || Date.now(), d: docFor(k) };
      });
      var j = await syncApi("push", { items });
      items.forEach(function(it) {
        if (SY.meta[it.k] === it.t) {
          delete SY.dirty[it.k];
          sent++;
        }
      });
      // Envoi refusé : le Sheet avait une version plus récente, venue d'un autre appareil. Elle remplace celle d'ici.
      // Depuis la 1.0, la version d'ici est d'abord mise dans les sauvegardes, et un bandeau le signale (S.remplace).
      var refuses = (j.rejected || []).filter(function(it) {
        return !SY.dirty[it.k];
      });
      if (refuses.length) {
        addSnap("Avant remplacement par un autre appareil", true);
        S.remplace = (S.remplace || []).concat(refuses.map(function(it) {
          return it.k === "settings" ? "Réglages" : "Semaine " + +it.k.slice(8);
        }));
        refuses.forEach(applyRemote);
        changed = true;
      }
    }
    var p = await syncApi("pull", { since: SY.last || 0 });
    (p.items || []).forEach(function(it) {
      if (SY.dirty[it.k]) return;
      if (+it.t > (SY.meta[it.k] || 0)) {
        applyRemote(it);
        changed = true;
      }
    });
    SY.last = Math.max(0, (p.now || 0) - 1e4);
    SY.lastOk = Date.now();
    SY.err = "";
    NET.retry = 0;
    if (hadErr && sent && !manual) toast("Réseau revenu : " + sent + " modification(s) envoyée(s)");
  } catch (e) {
    SY.err = String(e && e.message || e);
    syncRetry();
  } finally {
    syncing = false;
    saveSync();
  }
  if (changed) {
    persist();
    safeRender();
  } else if (S.tab === "set" && S.setPage === "sync" || S.desk || hadErr !== !!SY.err) safeRender();
  if (manual) toast(SY.err ? "Synchronisation impossible : " + SY.err : "Synchronisé");
}

/**
 * Première connexion d'un appareil (Réglages › Synchronisation ou lien de connexion).
 * Une sauvegarde est faite avant ; en cas d'échec, la synchro reste désactivée.
 */
async function syncConnect(api, cle) {
  if (!/^https:\/\/script\.google\.com\//.test(api)) {
    toast("L'adresse doit commencer par https://script.google.com/");
    return;
  }
  if (!cle) {
    toast("Saisis le code d'accès");
    return;
  }
  addSnap("Avant synchronisation", true);
  SY.api = api;
  SY.cle = cle;
  SY.last = 0;
  SY.dirty = {};
  try {
    await syncAdopt();
    render();
    toast("Synchronisation activée");
  } catch (e) {
    SY.api = "";
    SY.cle = "";
    saveSync();
    render();
    toast("Connexion impossible : " + (e && e.message || e));
  }
}

/**
 * Reprise complète : relit tout le Google Sheet, l'applique par-dessus les données de l'appareil,
 * puis marque « à envoyer » ce qui n'existe que sur l'appareil. Lève une erreur si le Sheet ne répond pas.
 * @returns {Promise<number>} Nombre de documents reçus.
 */
async function syncAdopt() {
  var p = await syncApi("pull", { since: 0 }), remote = {};
  (p.items || []).forEach(function(it) {
    remote[it.k] = 1;
    applyRemote(it);
  });
  if (!remote.settings) {
    SY.meta.settings = Date.now();
    SY.dirty.settings = 1;
  }
  Object.keys(S.weeks).forEach(function(k) {
    if (!remote["w:" + k]) {
      SY.meta["w:" + k] = Date.now();
      SY.dirty["w:" + k] = 1;
    }
  });
  SY.last = Math.max(0, (p.now || 0) - 1e4);
  saveSync();
  persist();
  await syncNow();
  return (p.items || []).length;
}

/* Retour au premier plan : échange immédiat. */
document.addEventListener("visibilitychange", function() {
  if (!document.hidden) syncNow();
});

/* Puis un échange par minute tant que l'appli est visible. */
setInterval(function() {
  if (!document.hidden) syncNow();
}, 6e4);

/* Retour du réseau : on repart de zéro pour les essais et on échange tout de suite. */
window.addEventListener("online", function() {
  NET.retry = 0;
  syncNow();
});

/* Perte du réseau : l'état « Hors ligne » est affiché. */
window.addEventListener("offline", function() {
  if (SY.api) {
    SY.err = "Hors ligne";
    saveSync();
    safeRender();
  }
});
export { SY, applyRemote, markAllDirty, pendingCount, saveSync, syncAdopt, syncApi, syncConnect, syncLabel, syncNow, touch };
