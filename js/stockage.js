/* STOCKAGE — lecture, contrôle, conversion et enregistrement des données sur l'appareil (localStorage). */
import { defaultSettings } from "./calculs.js";
import { S, VERSION, week } from "./etat.js";
import { deepMerge, toast } from "./outils.js";
import { touch } from "./synchro.js";

/* ----- Sauvegarde ----- */
var timers={};
function saveWeek(k){k=k||S.cur;week(k);touch("w:"+k);queue()}
function saveSettings(){touch("settings");queue()}
/* ----- Données -----
   Format enregistré (localStorage "feuille-heures-v1", fichiers de sauvegarde, Google Sheet) :
   { app:"feuille-heures", format:SCHEMA, version, exporte, settings:{...}, weeks:{ "AAAA-Wss":{ days:[7 jours], note, obs, validated, sentAt, check } } }
   Un jour : null ou { type:"sch:<id>"|"perso"|<absence>, start, end, pause (minutes), team, label, dur, auto, x:{extras} }.
   SCHEMA augmente à chaque changement de format ; les conversions sont dans migrate(). */
var SCHEMA=2;
var KEY="feuille-heures-v1",KEY_BK="feuille-heures-backup";
var WK_RE=/^\d{4}-W\d{2}$/;
/* Vérifie et nettoie des données venues de l'extérieur (fichier, synchro). Retourne les semaines valides et le nombre écarté. */
function cleanWeek(w){if(!w||typeof w!=="object"||Array.isArray(w))return null;var d=Array.isArray(w.days)?w.days.slice(0,7):[];while(d.length<7)d.push(null);
  w.days=d.map(function(x){if(!x||typeof x!=="object")return null;["start","end","pause","dur","theo"].forEach(function(f){if(x[f]!=null&&!isFinite(+x[f]))delete x[f]});if(x.x&&typeof x.x!=="object")x.x={};return x});return w}
function cleanWeeks(ws){var out={},bad=0;if(!ws||typeof ws!=="object")return{weeks:out,bad:0};Object.keys(ws).forEach(function(k){var w=WK_RE.test(k)?cleanWeek(ws[k]):null;if(w)out[k]=w;else bad++});return{weeks:out,bad:bad}}
function queue(){clearTimeout(timers.p);timers.p=setTimeout(persist,300)}
window.addEventListener("pagehide",function(){if(timers.p){clearTimeout(timers.p);persist()}});
document.addEventListener("visibilitychange",function(){if(document.hidden&&timers.p){clearTimeout(timers.p);persist()}});
function snapshot(){return{app:"feuille-heures",format:SCHEMA,version:VERSION,exporte:new Date().toISOString().slice(0,16),settings:S.settings,weeks:S.weeks}}
function persist(){if(S.readErr)return false;/* mode secours : on ne touche pas aux données illisibles */try{localStorage.setItem(KEY,JSON.stringify(snapshot()));return true}catch(e){toast("Impossible d'enregistrer sur cet appareil");return false}}
function applyData(d){if(!d||typeof d!=="object")throw new Error("format");if(+d.format>SCHEMA)throw new Error("plus récent");
  if(d.settings&&typeof d.settings==="object")S.settings=deepMerge(defaultSettings(S.cur),d.settings);
  if(d.weeks){var cw=cleanWeeks(d.weeks);S.weeks=cw.weeks;S.badWeeks=cw.bad}migrate();applyTheme()}
/* Conversions des anciens formats, dans l'ordre. Chacune est sans effet si elle a déjà été faite. */
function migrate(){var def={};defaultSettings("").horaires.forEach(function(h){def[h.id]=h});
  migrate14();
  if((S.settings.schema||1)<2){/* schéma 2 : anciens drapeaux de migration regroupés, types d'absence modernisés (migrateTypes) */S.settings.schema=2}
  (S.settings.horaires||[]).forEach(function(h){var dh=def[h.id];if(h.theo==null)h.theo=dh?dh.theo:420;if(h.fri&&h.fri.theo==null)h.fri.theo=dh&&dh.fri?dh.fri.theo:h.theo})}
function migrate14b(){if(S.settings.mig14b)return;var names={m1:"Matin 1",m2:"Matin 2",m3:"Matin 3",s2:"Soir 2",s3:"Soir 3",j:"Journée"};
  (S.settings.horaires||[]).forEach(function(h){if(names[h.id]&&h.label===names[h.id])h.label=""});
  Object.keys(S.weeks).forEach(function(k){(S.weeks[k].days||[]).forEach(function(d){if(d&&/^sch:/.test(d.type||"")&&names[d.type.slice(4)]===d.label)d.label=""})});
  S.settings.regles.hsCalc="semaine";S.settings.mig14b=true}
function migrateTypes(){Object.keys(S.weeks).forEach(function(k){(S.weeks[k]&&S.weeks[k].days||[]).forEach(function(d){if(d&&d.type==="conge")d.type="cp";if(d&&d.type==="cjour")d.type="csup"})})}
function migrate15(){migrateTypes();if(S.settings.mig15)return;(S.settings.horaires||[]).forEach(function(h){if(h.id==="m3"&&h.start===330&&h.end===780){h.end=750;h.fri=null}});S.settings.mig15=true}
function migrate14(){migrate14b();migrate15();if(S.settings.mig14)return;(S.settings.horaires||[]).forEach(function(h){if(h.id==="m3"&&!h.fri&&h.end===780)h.fri={start:330,end:720,pause:0,theo:420}});S.settings.mig14=true}
function applyTheme(){var th=S.settings.theme,r=document.documentElement;if(th==="light"||th==="dark")r.setAttribute("data-theme",th);else r.removeAttribute("data-theme")}
/* Lecture des données de l'appareil.
   Si le texte enregistré existe mais ne peut pas être relu (abîmé, ou écrit par une version plus récente de l'appli),
   on passe en « mode secours » : S.readErr garde le texte d'origine, plus rien n'est enregistré ni synchronisé,
   et l'écran de secours (viewRescue) demande quoi faire. Avant la 1.0, le premier enregistrement écrasait tout.
   Si c'est le stockage lui-même qui est inaccessible (raw reste null), on garde l'ancien comportement : simple bandeau. */
function loadLocal(){var raw=null;try{raw=localStorage.getItem(KEY);if(raw)applyData(JSON.parse(raw))}
  catch(e){if(raw==null){S.storeErr=true;return}
    S.readErr={raw:raw,recent:String(e&&e.message)==="plus récent"};S.settings=defaultSettings(S.cur);S.weeks={}}}

export { timers, saveWeek, saveSettings, SCHEMA, KEY, KEY_BK, WK_RE, cleanWeek, cleanWeeks, queue, snapshot, persist, applyData, migrate, migrate14b, migrateTypes, migrate15, migrate14, applyTheme, loadLocal };
