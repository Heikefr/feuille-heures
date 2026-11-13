/* SYNCHRO — échanges avec le Google Sheet (Code.gs) : envoi, réception, reprise après coupure réseau. */
import { defaultSettings } from "./calculs.js";
import { S } from "./etat.js";
import { deepMerge, toast } from "./outils.js";
import { WK_RE, applyTheme, cleanWeek, migrate, persist } from "./stockage.js";
import { addSnap } from "./sauvegardes.js";
import { render, safeRender } from "./ecran-rendu.js";

/* ----- Synchronisation (Google Sheet) ----- */
var KEY_SYNC="feuille-heures-sync",SY=(function(){try{return JSON.parse(localStorage.getItem(KEY_SYNC))||{}}catch(e){return{}}})();
SY.meta=SY.meta||{};SY.dirty=SY.dirty||{};
function saveSync(){try{localStorage.setItem(KEY_SYNC,JSON.stringify(SY))}catch(e){}}
function touch(k){if(S.readErr)return;SY.meta[k]=Date.now();SY.dirty[k]=1;saveSync();if(SY.api){clearTimeout(touch.t);touch.t=setTimeout(syncNow,1500)}}
function markAllDirty(){var n=Date.now();SY.meta.settings=n;SY.dirty.settings=1;Object.keys(S.weeks).forEach(function(k){SY.meta["w:"+k]=n;SY.dirty["w:"+k]=1});saveSync();if(SY.api)syncNow()}
function docFor(k){return k==="settings"?S.settings:S.weeks[k.slice(2)]||null}
function applyRemote(it){if(it.k==="settings"){S.settings=deepMerge(defaultSettings(S.cur),it.d||{});migrate();applyTheme()}else if(it.k.indexOf("w:")===0&&it.d&&WK_RE.test(it.k.slice(2))){var w=cleanWeek(it.d);if(w)S.weeks[it.k.slice(2)]=w}SY.meta[it.k]=it.t}
/* Appel du script Google, abandonné au bout de 20 s (réseau du site souvent faible). */
async function syncApi(action,payload){var r,ac=window.AbortController?new AbortController():null,to=ac?setTimeout(function(){ac.abort()},20000):0;
  try{if(action==="pull"){var u=new URL(SY.api);u.searchParams.set("action","pull");u.searchParams.set("cle",SY.cle);u.searchParams.set("since",payload.since||0);r=await fetch(u.toString(),ac?{signal:ac.signal}:{})}
  else r=await fetch(SY.api,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(Object.assign({action:action,cle:SY.cle},payload)),signal:ac?ac.signal:undefined})}
  catch(e){throw new Error(navigator.onLine===false?"Hors ligne":e&&e.name==="AbortError"?"Pas de réponse (réseau lent)":"Réseau indisponible")}finally{clearTimeout(to)}
  var j=await r.json();if(!j.ok)throw new Error(j.err||"Réponse refusée");return j}
/* Coupures réseau : les modifications restent en attente (SY.dirty) et un nouvel essai est programmé
   de plus en plus espacé (15 s, 30 s, 1 min, 2 min, 5 min). Le retour du réseau relance tout de suite. */
var syncing=false,NET={retry:0,t:null};
function syncRetry(){clearTimeout(NET.t);if(!SY.api)return;var d=[15,30,60,120,300][Math.min(NET.retry,4)]*1000;NET.retry++;NET.t=setTimeout(function(){syncNow()},d)}
function pendingCount(){return Object.keys(SY.dirty||{}).length}
function syncLabel(){var nd=pendingCount(),ago=SY.lastOk?Math.round((Date.now()-SY.lastOk)/60000):null;
  if(!SY.api)return{c:"",t:"Pas de synchronisation"};
  if(navigator.onLine===false||SY.err==="Hors ligne")return{c:"off",t:"Hors ligne"+(nd?" · "+nd+" modif. en attente":"")};
  if(SY.err)return{c:"err",t:"Synchro en échec"+(nd?" · "+nd+" en attente":"")+" · nouvel essai auto"};
  return{c:"ok",t:"Synchronisé"+(ago!=null?(ago<1?" à l'instant":" il y a "+ago+" min"):"")}}
async function syncNow(manual){if(!SY.api||syncing||S.readErr)return;syncing=true;var changed=false,hadErr=!!SY.err,sent=0;clearTimeout(NET.t);
  try{var keys=Object.keys(SY.dirty);
    if(keys.length){var items=keys.map(function(k){return{k:k,t:SY.meta[k]||Date.now(),d:docFor(k)}});var j=await syncApi("push",{items:items});
      items.forEach(function(it){if(SY.meta[it.k]===it.t){delete SY.dirty[it.k];sent++}});
      (j.rejected||[]).forEach(function(it){if(!SY.dirty[it.k]){applyRemote(it);changed=true}})}
    var p=await syncApi("pull",{since:SY.last||0});
    (p.items||[]).forEach(function(it){if(SY.dirty[it.k])return;if(+it.t>(SY.meta[it.k]||0)){applyRemote(it);changed=true}});
    SY.last=Math.max(0,(p.now||0)-10000);SY.lastOk=Date.now();SY.err="";NET.retry=0;
    if(hadErr&&sent&&!manual)toast("Réseau revenu : "+sent+" modification(s) envoyée(s)");
  }catch(e){SY.err=String(e&&e.message||e);syncRetry()}
  finally{syncing=false;saveSync()}
  if(changed){persist();safeRender()}else if((S.tab==="set"&&S.setPage==="sync")||S.desk||hadErr!==!!SY.err)safeRender();
  if(manual)toast(SY.err?"Synchronisation impossible : "+SY.err:"Synchronisé")}
async function syncConnect(api,cle){if(!/^https:\/\/script\.google\.com\//.test(api)){toast("L'adresse doit commencer par https://script.google.com/");return}if(!cle){toast("Saisis le code d'accès");return}
  addSnap("Avant synchronisation",true);SY.api=api;SY.cle=cle;SY.last=0;SY.dirty={};
  try{await syncAdopt();render();toast("Synchronisation activée")}
  catch(e){SY.api="";SY.cle="";saveSync();render();toast("Connexion impossible : "+(e&&e.message||e))}}
/* Reprise complète : relit tout le Google Sheet, l'applique par-dessus les données de l'appareil,
   puis marque « à envoyer » ce qui n'existe que sur l'appareil. Lève une erreur si le Sheet ne répond pas. */
async function syncAdopt(){var p=await syncApi("pull",{since:0}),remote={};
    (p.items||[]).forEach(function(it){remote[it.k]=1;applyRemote(it)});
    if(!remote.settings){SY.meta.settings=Date.now();SY.dirty.settings=1}
    Object.keys(S.weeks).forEach(function(k){if(!remote["w:"+k]){SY.meta["w:"+k]=Date.now();SY.dirty["w:"+k]=1}});
    SY.last=Math.max(0,(p.now||0)-10000);saveSync();persist();await syncNow();return(p.items||[]).length}
document.addEventListener("visibilitychange",function(){if(!document.hidden)syncNow()});
setInterval(function(){if(!document.hidden)syncNow()},60000);
window.addEventListener("online",function(){NET.retry=0;syncNow()});
window.addEventListener("offline",function(){if(SY.api){SY.err="Hors ligne";saveSync();safeRender()}});

export { SY, saveSync, touch, markAllDirty, applyRemote, syncApi, pendingCount, syncLabel, syncNow, syncConnect, syncAdopt };
