/* SAUVEGARDES — sauvegardes automatiques dans l'appli, export et import de fichiers. */
import { defaultSettings } from "./calculs.js";
import { S } from "./etat.js";
import { fmtDT, shareFile, toast } from "./outils.js";
import { KEY_BK, SCHEMA, applyData, cleanWeeks, migrate, persist, snapshot } from "./stockage.js";
import { markAllDirty, touch } from "./synchro.js";
import { rescueDone } from "./secours.js";
import { render } from "./ecran-rendu.js";

/* ----- Sauvegardes ----- */
var KEY_SNAPS="feuille-heures-snapshots",SNAP_MAX=15;
function getSnaps(){try{return JSON.parse(localStorage.getItem(KEY_SNAPS)||"[]")}catch(e){return[]}}
function setSnaps(a){for(;;){try{localStorage.setItem(KEY_SNAPS,JSON.stringify(a));return true}catch(e){var i=-1;for(var j=a.length-1;j>=0;j--)if(a[j].auto){i=j;break}if(i<0&&a.length)i=a.length-1;if(i<0)return false;a.splice(i,1)}}}
function addSnap(label,auto){if(S.readErr)return;/* pas de sauvegarde d'une appli vide en mode secours */var a=getSnaps();a.unshift({id:Date.now().toString(36),date:new Date().toISOString(),label:label,auto:!!auto,data:snapshot()});
  while(a.length>SNAP_MAX){var k=-1;for(var j=a.length-1;j>=0;j--)if(a[j].auto){k=j;break}a.splice(k<0?a.length-1:k,1)}setSnaps(a)}
function findSnap(id){var r=null;getSnaps().forEach(function(s){if(s.id===id)r=s});return r}
function delSnap(id){setSnaps(getSnaps().filter(function(s){return s.id!==id}))}
function restoreSnap(id){var s=findSnap(id);if(!s)return;addSnap("Avant restauration",true);applyData(JSON.parse(JSON.stringify(s.data)));persist();markAllDirty();render();toast("Sauvegarde du "+fmtDT(s.date)+" restaurée")}
function exportSnap(id){var s=id?findSnap(id):null,data=s?s.data:snapshot(),d=s?s.date:new Date().toISOString();
  var name="feuille-heures-sauvegarde-"+d.slice(0,10)+".json";
  shareFile(new Blob([JSON.stringify(data,null,1)],{type:"application/json"}),name,"Sauvegarde feuille d'heures").then(function(ok){if(ok){try{localStorage.setItem(KEY_BK,new Date().toISOString())}catch(e){}render();toast("Fichier de sauvegarde créé")}})}
function lastFileBackup(){try{return localStorage.getItem(KEY_BK)}catch(e){return null}}
function backupDue(){var b=lastFileBackup(),n=Object.keys(S.weeks).filter(function(k){return S.weeks[k]&&S.weeks[k].validated}).length;if(!n)return false;return!b||(Date.now()-new Date(b))>30*864e5}

function restore(file){var r=new FileReader(),re=S.readErr;r.onload=function(){try{var d=JSON.parse(r.result);if(d.app!=="feuille-heures")throw 0;if(+d.format>SCHEMA){toast("Ce fichier vient d'une version plus récente de l'appli : recharge la page puis réessaie");return}
    if(re&&!rescueDone())return;/* mode secours : les données illisibles sont mises de côté avant d'être remplacées */
    if(d.kind==="historique"){if(!re)addSnap("Avant import de l'historique",true);var n=0,cw=cleanWeeks(d.weeks);d.weeks=cw.weeks;Object.keys(d.weeks).forEach(function(k){var cur=S.weeks[k];var empty=!cur||!(cur.days||[]).some(function(x){return x&&x.type&&!x.auto});if(empty){S.weeks[k]=d.weeks[k];touch("w:"+k);n++}});
      if(d.cpt){S.settings.cpt=Object.assign({},S.settings.cpt||{},d.cpt);touch("settings")}migrate();persist();render();toast(n+" semaine(s) ajoutée(s)"+(d.cpt?", compteurs mis à jour":""));return}if(!re)addSnap("Avant import",true);applyData(d);persist();markAllDirty();render();toast("Données importées"+(S.badWeeks?" ("+S.badWeeks+" semaine(s) illisible(s) ignorée(s))":""))}catch(e){if(re){S.readErr=re;S.settings=defaultSettings(S.cur);S.weeks={}}toast("Ce fichier n'est pas une sauvegarde de Feuille d'heures")}};r.readAsText(file)}

export { getSnaps, addSnap, delSnap, restoreSnap, exportSnap, lastFileBackup, backupDue, restore };
