/* ACTIONS — réactions aux clics, saisies, gestes et raccourcis clavier. */
import { ABS, dayDate, defaultSettings, ferieOf, hm, keyOf, mondayOf, schedFor, shiftKey, toMin, weekCalc } from "./calculs.js";
import { cpPeriod } from "./compteurs.js";
import { DMQ, S, TODAY, app, week } from "./etat.js";
import { parseHM, selectCode, setPath, shareFile, toast } from "./outils.js";
import { applyTheme, saveSettings, saveWeek } from "./stockage.js";
import { SY, saveSync, syncConnect, syncNow } from "./synchro.js";
import { addSnap, backup, delSnap, exportSnap, restore, restoreSnap } from "./sauvegardes.js";
import { ficheBlob, sendHtml } from "./fiche.js";
import { recalSoldes } from "./compta.js";
import { bilanExport, doExport } from "./excel.js";
import { KEY_RESCUE, rescueAct, rescueExport } from "./secours.js";
import { applySched, poseConge, setDay } from "./ecran-semaine.js";
import { sendGo } from "./ecran-envoi.js";
import { exportIcs, saveCet, saveCounter, upcoming } from "./ecran-compteurs.js";
import { runVerif, verifMsg } from "./ecran-verification.js";
import { goWeek, render } from "./ecran-rendu.js";

app.addEventListener("click",function(e){var el=e.target.closest("[data-act]");if(!el)return;var a=el.dataset.act;
  if(a==="close"&&e.target!==el)return;
  if(["vtxt","dset","xset","xsel","sset","hset","obs","xsam","hfri","dtype","dpause","wnote","ynote","syncf","cfix"].indexOf(a)>=0)return;
  if(a==="ygo"&&S.lpFired){S.lpFired=false;return}
  if(a==="yclose"&&e.target!==el)return;
  if(S.readErr){rescueAct(a);return}
  var w=week();
  if(a==="tab"){S.tab=el.dataset.t;S.sheet=null;S.setPage=null;S.confirm=null;render();window.scrollTo(0,0)}
  else if(a==="year"){S.year=S.year!=null?null:+S.cur.slice(0,4);render()}
  else if(a==="yr"){S.year+=+el.dataset.n;render()}
  else if(a==="yclose"){S.year=null;render()}
  else if(a==="ytoday"){S.cur=keyOf(mondayOf(new Date()));S.year=null;S.tab="week";render();window.scrollTo(0,0)}
  else if(a==="ygo"){S.cur=el.dataset.k;S.year=null;S.yEdit=null;S.tab="week";render();window.scrollTo(0,0)}
  else if(a==="yedclose"){S.yEdit=null;render()}
  else if(a==="weekconge"){S.pickConge=S.cur;render()}
  else if(a==="pickno"){S.pickConge=null;render()}
  else if(a==="poseconge"){poseConge(el.dataset.k,el.dataset.t);S.pickConge=null;render();toast("Semaine "+(+el.dataset.k.slice(6))+" posée en "+ABS[el.dataset.t].toLowerCase()+" (fériés conservés)")}
  else if(a==="fix"){S.fix=el.dataset.k;render()}
  else if(a==="fixno"){S.fix=null;render()}
  else if(a==="cetfix"||a==="cetsave"){if(saveCet(a==="cetfix"?"fix":"add")){S.fix=null;render()}}
  else if(a==="cetdel"){var ce=(S.settings.cpt||{}).cet;if(ce){ce.moves=(ce.moves||[]).filter(function(m){return m.id!==el.dataset.id});saveSettings();render();toast("Placement supprimé")}}
  else if(a==="srecal"){recalSoldes()}
  else if(a==="by"){S.by=(S.by||TODAY.getFullYear())+(+el.dataset.n);render()}
  else if(a==="bexport"){bilanExport()}
  else if(a==="sendopen"){S.send=true;S.sendFail=false;render()}
  else if(a==="sendclose"){S.send=false;S.sendFail=false;render()}
  else if(a==="sendgo"){sendGo(el.dataset.m)}
  else if(a==="ftaille"){S.settings.ficheT=el.dataset.v;saveSettings();render()}
  else if(a==="dmode"){S.dprev=el.dataset.m==="1";render()}
  else if(a==="dkeys"){S.dkeys=!S.dkeys;render()}
  else if(a==="dgo"){S.tab=el.dataset.t;S.verif=false;S.setPage=el.dataset.p||null;S.year=null;render();window.scrollTo(0,0)}
  else if(a==="sverif"){S.tab="week";S.verif=true;S.vres=null;S.dprev=false;render();window.scrollTo(0,0)}
  else if(a==="fixacq"){var q=parseHM(document.getElementById("cf-q").value);if(q==null){toast("Valeur incorrecte");return}(S.settings.cpt=S.settings.cpt||{}).cpacq=q;S.fix=null;saveSettings();render()}
  else if(a==="fixsave"){saveCounter(S.fix);S.fix=null;render();toast("Compteur mis à jour")}
  else if(a==="fracadd"||a==="fracno"){var cp=S.settings.cpt=S.settings.cpt||{},fr=cp.frac=cp.frac||{};fr.done=fr.done||[];fr.adds=fr.adds||[];fr.done.push(el.dataset.id);
    if(a==="fracadd")fr.adds.push({id:el.dataset.id,per:cpPeriod(new Date()).a,min:+el.dataset.min});saveSettings();render();toast(a==="fracadd"?"Fractionnement ajouté : "+hm(+el.dataset.min):"Noté")}
  else if(a==="ics"){exportIcs(upcoming().filter(function(x){return x.k===el.dataset.k}),"echeance-S"+el.dataset.k.slice(6)+".ics")}
  else if(a==="icsall"){exportIcs(upcoming(),"echeances.ics")}
  else if(a==="shareimg"){var ww=week();ficheBlob(ww,weekCalc(ww,S.settings),S.settings).then(function(b){shareFile(b,"Fiche_S"+S.cur.slice(6)+".png","Fiche de la semaine")})}
  else if(a==="syncconnect"){syncConnect(document.getElementById("sy-api").value.trim(),document.getElementById("sy-cle").value.trim())}
  else if(a==="syncnow"){syncNow(true)}
  else if(a==="syncoff"){if(S.confirm!=="syncoff"){S.confirm="syncoff";render();return}S.confirm=null;SY.api="";SY.cle="";saveSync();render();toast("Synchronisation désactivée sur cet appareil")}
  else if(a==="setp"){S.setPage=el.dataset.p;S.confirm=null;render();window.scrollTo(0,0)}
  else if(a==="setback"){S.setPage=null;S.confirm=null;render();window.scrollTo(0,0)}
  else if(a==="resetrules"){if(S.confirm!=="reset"){S.confirm="reset";render();return}S.confirm=null;var dd=defaultSettings("");S.settings.regles=dd.regles;S.settings.comptes=dd.comptes;saveSettings();render();toast("Valeurs des accords rétablies")}
  else if(a==="preview"){S.preview=!S.preview;render()}
  else if(a==="verif"){S.verif=!S.verif;S.vres=null;S.sres=null;render()}
  else if(a==="vrun"){runVerif()}
  else if(a==="vopen"){var wasOpen=el.dataset.open==="1";S.vopen=wasOpen?"none":el.dataset.k;render()}
  else if(a==="vcopy"){var mtx=verifMsg(el.dataset.k);try{navigator.clipboard.writeText(mtx).then(function(){toast("Message copié")},function(){toast("Copie impossible")})}catch(x){toast("Copie impossible")}}
  else if(a==="obsbtn"){S.showObs=!S.showObs;render();var o=document.getElementById("obs");if(o)o.focus()}
  else if(a==="fixr"){S.fixR=true;render()}
  else if(a==="fixc"){S.fixC=true;render()}
  else if(a==="wk"){goWeek(+el.dataset.n)}
  else if(a==="openday"){S.sheet=+el.dataset.i;render()}
  else if(a==="close"){S.sheet=null;render()}
  else if(a==="prevday"){S.sheet=Math.max(0,S.sheet-1);render()}
  else if(a==="nextday"){S.sheet=Math.min(6,S.sheet+1);render()}
  else if(a==="pick"){var i=S.sheet,id=el.dataset.id,old=w.days[i]||{},d;
    if(id==="")d={x:old.x||{},noFerie:!!ferieOf(dayDate(S.cur,i))};else if(id==="perso")d={type:"perso",team:old.team||"Matin",start:old.start!=null?old.start:360,end:old.end!=null?old.end:795,pause:old.pause||0,x:old.x||{}};
    else if(ABS[id])d={type:id,x:old.x||{}};else d=applySched(i,id);
    setDay(i,d);render()}
  else if(a==="fill"){var nf=0;for(var i=0;i<5;i++){var od=w.days[i]||{};if(od.type==="ferie"){nf++;continue}w.days[i]=applySched(i,el.dataset.id)}saveWeek();render();toast(nf?"Lundi à vendredi remplis (férié conservé)":"Lundi à vendredi remplis")}
  else if(a==="copyprev"){var p=S.weeks[shiftKey(S.cur,-1)];if(!p){toast("Rien à copier dans la semaine précédente");return}
    w.days=JSON.parse(JSON.stringify(p.days));saveWeek();render();toast("Semaine précédente copiée")}
  else if(a==="clear"){w.days=[{},{},{},{},{},{},{}];w.note="";saveWeek();render()}
  else if(a==="sendhtml")sendHtml(true);
  else if(a==="copyhtml")sendHtml(false);
  else if(a==="rsexport"){rescueExport()}
  else if(a==="rsforget"){if(S.confirm!=="rsforget"){S.confirm="rsforget";render();return}S.confirm=null;try{localStorage.removeItem(KEY_RESCUE)}catch(x){}render();toast("Données illisibles supprimées")}
  else if(a==="snapnew"){addSnap("Sauvegarde manuelle",false);render();toast("Sauvegarde créée dans l'appli")}
  else if(a==="snapexp")exportSnap(el.dataset.id);
  else if(a==="snaprest"){if(S.confirm!=="r"+el.dataset.id){S.confirm="r"+el.dataset.id;render();return}S.confirm=null;restoreSnap(el.dataset.id)}
  else if(a==="snapdel"){if(S.confirm!=="d"+el.dataset.id){S.confirm="d"+el.dataset.id;render();return}S.confirm=null;delSnap(el.dataset.id);render();toast("Sauvegarde supprimée")}
  else if(a==="reopen"){w.validated=false;saveWeek();render()}
  else if(a==="send"||a==="export")doExport(a==="send");
  else if(a==="copy"){var v=el.dataset.v;if(!v)return;var done=function(){toast("Copié")};
    try{navigator.clipboard.writeText(v).then(done,function(){selectCode(el)})}catch(x){selectCode(el)}}
  else if(a==="setsolde"){var raw=document.getElementById("c-val").value.trim(),neg=/^-/.test(raw),m=toMin(raw.replace(/^[-+]/,"").replace("h",":"));
    if(m==null&&/^\d+$/.test(raw.replace(/^[-+]/,"")))m=+raw.replace(/^[-+]/,"")*60;
    if(m==null){toast("Format attendu : 12:30");return}
    S.settings.solde={min:neg?-m:m,from:document.getElementById("c-wk").value};S.fixR=false;saveSettings();render();toast("Compteur mis à jour")}
  else if(a==="setconges"){var rh=document.getElementById("c-ch").value.trim(),mh=toMin(rh.replace(/^[-+]/,"").replace("h",":"));
    if(mh==null&&/^\d+$/.test(rh.replace(/^[-+]/,"")))mh=+rh.replace(/^[-+]/,"")*60;
    if(mh==null){toast("Format attendu : 175:00");return}
    S.settings.conges={h:/^-/.test(rh)?-mh:mh,j:+document.getElementById("c-cj").value||0,from:document.getElementById("c-cwk").value};S.fixC=false;saveSettings();render();toast("Solde de congés mis à jour")}
  else if(a==="hadd"){S.settings.horaires.push({id:"h"+Date.now().toString(36),label:"",team:"Matin",start:360,end:795,pause:0,theo:420,fri:null});saveSettings();render()}
  else if(a==="backup")backup();
  else if(a==="hdel"){S.settings.horaires.splice(+el.dataset.i,1);saveSettings();render()}
});
app.addEventListener("change",function(e){var el=e.target,a=el.dataset.act;if(!a)return;var w=week();
  if(a==="cetsrc"){S.cetSrc=el.value;render();return}
  if(a==="dtype"){var di=+el.dataset.i,v0=el.value,od=w.days[di]||{},nd;
    if(v0==="")nd={x:od.x||{},noFerie:!!ferieOf(dayDate(S.cur,di))};else if(v0==="perso")nd={type:"perso",team:od.team||"Matin",start:od.start!=null?od.start:360,end:od.end!=null?od.end:795,pause:od.pause||0,theo:420,x:od.x||{}};
    else if(ABS[v0])nd={type:v0,x:od.x||{}};else nd=applySched(di,v0.slice(4));
    w.days[di]=nd;saveWeek();render();return}
  if(a==="dpause"){var dp=w.days[+el.dataset.i],sc=/^sch:/.test(dp.type)?schedFor(S.settings,dp.type.slice(4),+el.dataset.i):null;dp.pause=el.checked?((sc&&sc.pause)||60):0;saveWeek();render();return}
  if(a==="dset"){var d=w.days[el.dataset.i!=null?+el.dataset.i:S.sheet];var k=el.dataset.k;d[k]=k==="team"?el.value:toMin(el.value)||0;saveWeek();if(S.desk&&el.type==="time"&&document.activeElement===el){S.defer=true;return}render()}
  else if(a==="xset"){var d2=w.days[S.sheet]=w.days[S.sheet]||{};d2.x=d2.x||{};d2.x[el.dataset.k]=toMin(el.value)||0;saveWeek();render()}
  else if(a==="xsel"){var d4=w.days[S.sheet]=w.days[S.sheet]||{};d4.x=d4.x||{};d4.x[el.dataset.k]=el.value;saveWeek();render()}
  else if(a==="xsam"){var d3=w.days[S.sheet]=w.days[S.sheet]||{};d3.x=d3.x||{};d3.x.sam=el.checked?1:0;saveWeek();render()}
  else if(a==="sset"){var v=el.dataset.bool?el.checked:el.dataset.time?(toMin(el.value)||0):el.type==="number"?(+el.value||0):el.value;setPath(S.settings,el.dataset.p,v);if(el.dataset.p==="theme")applyTheme();saveSettings();render()}
  else if(a==="hset"){var h=S.settings.horaires[+el.dataset.i];setPath(h,el.dataset.k,el.dataset.time?(toMin(el.value)||0):el.value);saveSettings();render()}
  else if(a==="hfri"){var h2=S.settings.horaires[+el.dataset.i];h2.fri=el.checked?{start:h2.start,end:h2.end,pause:h2.pause,theo:h2.theo}:null;saveSettings();render()}
});
app.addEventListener("change",function(e){if(e.target.id==="imp"&&e.target.files&&e.target.files[0])restore(e.target.files[0])});
app.addEventListener("input",function(e){var a=e.target.dataset.act;if(a==="obs"){week().obs=e.target.value;saveWeek()}
  else if(a==="wnote"){week().note=e.target.value;saveWeek()}
  else if(a==="vtxt"){S.vtxt=e.target.value}
  else if(a==="ynote"){var k=e.target.dataset.k;week(k).note=e.target.value;saveWeek(k)}});
(function(){var tm=null;document.addEventListener("pointerdown",function(e){var b=e.target.closest&&e.target.closest(".yw");if(!b)return;clearTimeout(tm);tm=setTimeout(function(){S.lpFired=true;S.yEdit=b.dataset.k;render()},550)});
  ["pointerup","pointercancel","pointerleave"].forEach(function(n){document.addEventListener(n,function(){clearTimeout(tm)})});
  document.addEventListener("contextmenu",function(e){if(e.target.closest&&e.target.closest(".yw"))e.preventDefault()})})();
(function(){var x0=null,y0=0,t0=0;
  document.addEventListener("touchstart",function(e){if(S.tab!=="week"||S.sheet!=null||S.year!=null||e.touches.length!==1){x0=null;return}
    if(e.target.closest("input,select,textarea,.quick,.fiche-wrap,.paper.pcg")){x0=null;return}x0=e.touches[0].clientX;y0=e.touches[0].clientY;t0=Date.now()},{passive:true});
  document.addEventListener("touchend",function(e){if(x0==null)return;var dx=e.changedTouches[0].clientX-x0,dy=e.changedTouches[0].clientY-y0;x0=null;
    if(Math.abs(dx)>70&&Math.abs(dy)<45&&Date.now()-t0<700)goWeek(dx<0?1:-1)},{passive:true})})();
(function(){var f=function(){var d=DMQ.matches;if(d!==S.desk){S.desk=d;if(S.ready)render()}};if(DMQ.addEventListener)DMQ.addEventListener("change",f);else if(DMQ.addListener)DMQ.addListener(f)})();
app.addEventListener("focusout",function(e){if(S.defer&&e.target&&e.target.type==="time")setTimeout(function(){if(S.defer)render()},0)});
document.addEventListener("keydown",function(e){if(!S.desk||!S.ready)return;var t=e.target,inF=t&&/^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName);
  if(e.key==="Escape"){if(S.send){S.send=false;render()}else if(S.dkeys){S.dkeys=false;render()}return}
  if((e.ctrlKey||e.metaKey)&&e.key==="Enter"&&S.tab==="week"){var q=S.send?'.sendm .sgo':'.dsend [data-act=sendopen]',b=app.querySelector(q);if(b){e.preventDefault();if(t&&t.blur)t.blur();setTimeout(function(){b=app.querySelector(q);if(b)b.click()},30)}return}
  if((e.ctrlKey||e.metaKey)&&(e.key==="p"||e.key==="P")&&S.tab==="week"&&!S.verif){e.preventDefault();S.dprev=!S.dprev;render();return}
  if(!inF&&!e.ctrlKey&&!e.altKey&&!e.metaKey&&(e.key==="ArrowLeft"||e.key==="ArrowRight")&&S.tab==="week"&&S.sheet==null&&S.year==null){e.preventDefault();goWeek(e.key==="ArrowLeft"?-1:1)}});
