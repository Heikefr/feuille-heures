/**
 * FAUX GOOGLE SHEET
 * -----------------
 * Remplace, pendant les tests, le script Code.gs et son Google Sheet. Il reproduit exactement ses règles :
 *   - code d'accès obligatoire ;
 *   - « pull » : renvoie les lignes reçues par le serveur après l'instant demandé ;
 *   - « push » : une ligne est acceptée si son heure de modification est égale ou postérieure à celle déjà
 *     enregistrée ; sinon elle est refusée et la version du Sheet est renvoyée (la dernière modification gagne).
 * Il permet aussi de simuler une coupure réseau.
 */
"use strict";

/** Adresse et code d'accès fictifs, à placer dans les réglages de synchro de l'appli testée. */
const API = "https://script.google.com/macros/s/TEST/exec";
const CODE = "CODEDETEST234567";

/**
 * Crée un faux Sheet vide.
 * @param {number} depart  Heure de départ de l'horloge du serveur (millisecondes).
 * @returns {object} lignes (Map clé → { t, recu, d }), poser(k, t, d), couper(bool), journal (actions reçues), brancher(page).
 */
function creerFauxSheet(depart) {
  const lignes = new Map();
  const journal = [];
  let maintenant = depart, enPanne = false;

  /** Même logique que traite_() dans Code.gs. */
  function traiter(q) {
    maintenant += 1000;
    if (q.cle !== CODE) return { ok: false, err: "Code d'accès incorrect" };
    if (q.action === "ping") return { ok: true, now: maintenant, version: "1.0" };
    if (q.action === "pull") {
      const depuis = +q.since || 0, items = [];
      for (const [k, l] of lignes) if (l.recu > depuis) items.push({ k, t: l.t, d: l.d });
      return { ok: true, now: maintenant, items };
    }
    if (q.action === "push") {
      let acceptes = 0;
      const refus = [];
      for (const it of q.items || []) {
        if (!it || !it.k) continue;
        const actuel = lignes.get(it.k);
        if (actuel && !(+it.t >= actuel.t)) refus.push({ k: it.k, t: actuel.t, d: actuel.d });
        else { lignes.set(it.k, { t: +it.t, recu: maintenant, d: JSON.parse(JSON.stringify(it.d)) }); acceptes++; }
      }
      return { ok: true, now: maintenant, accepted: acceptes, rejected: refus };
    }
    return { ok: false, err: "Action inconnue" };
  }

  return {
    lignes, journal,
    /** Écrit une ligne comme si un autre appareil venait de l'envoyer. */
    poser(k, t, d) { maintenant += 1000; lignes.set(k, { t, recu: maintenant, d }); },
    /** Coupe (true) ou rétablit (false) le réseau vers le Sheet. */
    couper(etat) { enPanne = etat; },
    /** Détourne vers ce faux Sheet tous les appels de la page au script Google. */
    async brancher(page) {
      await page.route("https://script.google.com/**", async (route) => {
        if (enPanne) return route.abort();
        const req = route.request();
        const q = req.method() === "GET" ? Object.fromEntries(new URL(req.url()).searchParams) : JSON.parse(req.postData() || "{}");
        journal.push(q.action);
        return route.fulfill({ contentType: "application/json", body: JSON.stringify(traiter(q)) });
      });
    },
  };
}

module.exports = { creerFauxSheet, API, CODE };
