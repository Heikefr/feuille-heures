/* RENDU — démarrage, affichage général (iPhone et PC), navigation entre semaines. */
import { fmtD, hm, keyOf, monOfKey, mondayOf, shiftKey } from "./calculs.js";
import { CET_MAX, counters, soldeCalc } from "./compteurs.js";
import { S, TODAY, VERSION, app, week } from "./etat.js";
import { ICON, esc, fmtJ } from "./outils.js";
import { applyTheme, loadLocal, migrate } from "./stockage.js";
import { SY, syncConnect, syncLabel, syncNow } from "./synchro.js";
import { viewRescue } from "./secours.js";
import { surveillerMisesAJour } from "./mise-a-jour.js";
import { prefillFeries, viewSheet, viewWeek, viewYear, weekStatus } from "./ecran-semaine.js";
import { viewSend } from "./ecran-envoi.js";
import { reminders, viewBank } from "./ecran-compteurs.js";
import { viewBilan } from "./ecran-bilan.js";
import { viewSettings } from "./ecran-reglages.js";

function boot(){
  loadLocal();migrate();applyTheme();S.ready=true;
  try{var q=new URLSearchParams(location.search);if(!S.readErr&&q.get("api")&&q.get("cle")){var qa=q.get("api"),qc=q.get("cle");history.replaceState(null,"",location.pathname);S.tab="set";S.setPage="sync";render();syncConnect(qa,qc);return}}catch(e){}
  render();syncNow();
  surveillerMisesAJour();
}
/* ----- Rendu ----- */
function render(){S.defer=false;
  if(S.readErr){app.innerHTML=viewRescue();return}
  prefillFeries(S.cur);S._cpt=counters(S.settings,S.weeks);
  var mon=monOfKey(S.cur),sun=new Date(mon);sun.setDate(sun.getDate()+6);var w=week();
  var ws=weekStatus(S.cur),status=ws==="s"?'<span class="chip sent">Envoyée</span>':ws==="dr"?'<span class="chip draft">Brouillon</span>':'';
  var head='<header class="top"><div class="wrap"><div class="wk-nav">'+
    '<button class="iconbtn" data-act="wk" data-n="-1" aria-label="Semaine précédente">'+ICON.prev+'</button>'+
    '<button class="wk-title" data-act="year" aria-label="Choisir une semaine"><b>Semaine '+(+S.cur.slice(6))+'<i>'+(S.year!=null?'▴':'▾')+'</i></b><span>'+fmtD(mon)+' – '+fmtD(sun)+'/'+sun.getFullYear()+' · </span>'+status+'</button>'+
    '<button class="iconbtn" data-act="wk" data-n="1" aria-label="Semaine suivante">'+ICON.next+'</button></div></div></header>';
  var fe=document.activeElement,fs=fe&&fe.dataset&&fe.dataset.act?'[data-act="'+fe.dataset.act+'"]'+(fe.dataset.i!=null?'[data-i="'+fe.dataset.i+'"]':'')+(fe.dataset.k?'[data-k="'+fe.dataset.k+'"]':''):null;
  var body=S.tab==="week"?viewWeek():S.tab==="bank"?viewBank():S.tab==="bilan"?viewBilan():viewSettings();
  if(S.desk){var y0=window.scrollY;app.innerHTML=deskShell(body,mon,sun,status)+(S.sheet!=null?viewSheet():"")+(S.year!=null?viewYear():"")+(S.send?viewSend():"");window.scrollTo(0,y0);refocus(fs);return}
  var tabs='<nav class="tabs"><div class="wrap">'+
    tab("week","Semaine",ICON.week)+tab("bank","Compteur",ICON.bank)+tab("bilan","Bilan",ICON.chart)+tab("set","Réglages",ICON.gear)+'</div></nav>';
  var y=window.scrollY;
  app.innerHTML=head+'<main><div class="wrap">'+body+'</div></main>'+tabs+(S.sheet!=null?viewSheet():"")+(S.year!=null?viewYear():"")+(S.send?viewSend():"");
  window.scrollTo(0,y);refocus(fs);
}
function refocus(fs){if(!fs)return;try{var e=[].filter.call(app.querySelectorAll(fs),function(x){return x.offsetParent!==null})[0];if(e&&e.tagName!=="BUTTON")e.focus({preventScroll:true})}catch(x){}}
function deskShell(body,mon,sun,status){var st=S.settings,cur=S.cur,vf=S.tab==="week"&&S.verif;
  var it=function(act,t,l,on,ex){return'<button class="dit'+(on?' on':'')+'" data-act="'+act+'"'+(t?' data-t="'+t+'"':'')+'><span>'+l+'</span>'+(ex||'')+'</button>'};
  var h='<div class="dk"><aside class="dside"><div class="dbrand">Feuille d\'heures</div><nav class="dnav">'+
    it("tab","week","Semaine",S.tab==="week"&&!vf,'<span class="dcnt">S'+(+cur.slice(6))+'</span>')+it("tab","bank","Compteurs",S.tab==="bank")+it("tab","bilan","Bilan",S.tab==="bilan")+
    it("tab","set","Réglages",S.tab==="set",!st.profil.nom?'<i class="ddot"></i>':'')+'</nav>';
  var k0=shiftKey(cur,-2),tk=keyOf(mondayOf(TODAY)),m0=monOfKey(k0),m1=monOfKey(shiftKey(k0,9)),MO=["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
  h+='<div class="dsec">'+MO[m0.getMonth()]+(m1.getMonth()!==m0.getMonth()?' – '+MO[m1.getMonth()]:'')+' '+m1.getFullYear()+'</div><div class="dcal">';
  for(var i=0;i<10;i++){var k=shiftKey(k0,i),ws=weekStatus(k);h+='<button class="dwk '+ws+(k===cur?' cur':'')+(k===tk?' today':'')+'" data-act="ygo" data-k="'+k+'" title="Semaine '+(+k.slice(6))+'">'+(+k.slice(6))+'</button>'}
  h+='</div><div class="dleg"><span style="color:#7fd3a1">■</span> envoyée &nbsp;<span style="color:#ffbf73">■</span> brouillon</div>';
  var rm=reminders().filter(function(x){return x.on});
  if(rm.length||!st.profil.nom){h+='<div class="dsec">À ne pas oublier</div>';rm.forEach(function(x){h+='<button class="drem" data-act="tab" data-t="bank" title="'+esc(x.d)+'">● '+esc(x.t)+'</button>'});
    if(!st.profil.nom)h+='<button class="drem g" data-act="dgo" data-t="set" data-p="profil">● Profil à compléter</button>'}
  var ago=SY.lastOk?Math.round((Date.now()-SY.lastOk)/60000):null;
  var sl=syncLabel();h+='<div class="dfoot"><button data-act="dgo" data-t="set" data-p="sync">'+(sl.c?'<span style="color:'+(sl.c==="ok"?'#7fd3a1':'#ffbf73')+'">●</span> ':'○ ')+esc(sl.t)+'</button><button data-act="dgo" data-t="set" data-p="news">Version '+VERSION+' · Nouveautés</button></div></aside>';
  h+='<div class="dmain"><header class="dhead">';
  if(S.tab==="week")h+='<div class="dwn"><button class="iconbtn" data-act="wk" data-n="-1" aria-label="Semaine précédente">'+ICON.prev+'</button><button class="wk-title" data-act="year" aria-label="Choisir une semaine"><b>Semaine '+(+cur.slice(6))+'</b><span>'+fmtD(mon)+' – '+fmtD(sun)+'/'+sun.getFullYear()+' · </span>'+status+'</button><button class="iconbtn" data-act="wk" data-n="1" aria-label="Semaine suivante">'+ICON.next+'</button></div>';
  else h+='<h1>'+(S.tab==="bank"?'Compteurs':S.tab==="bilan"?'Bilan':'Réglages')+'</h1>';
  h+='<div class="dtools">'+(S.tab==="week"&&!vf?'<div class="seg"><button class="'+(S.dprev?'':'on')+'" data-act="dmode" data-m="0">Saisie</button><button class="'+(S.dprev?'on':'')+'" data-act="dmode" data-m="1">Aperçu de la fiche</button></div>':'')+
    (S.tab==="bank"?'<button class="btn small primary" data-act="sverif">Vérifier mes soldes avec la compta</button>':'')+(S.tab==="bilan"?'<button class="btn small primary" data-act="bexport">Exporter en Excel</button>':'')+
    '<button class="btn small" data-act="dkeys" aria-pressed="'+!!S.dkeys+'">⌨ Raccourcis</button></div></header>';
  if(S.dkeys)h+='<div class="dkeys"><span><kbd>←</kbd> <kbd>→</kbd> semaine précédente / suivante</span><span><kbd>Tab</kbd> case suivante</span><span><kbd>Ctrl</kbd>+<kbd>Entrée</kbd> envoyer la fiche</span><span><kbd>Ctrl</kbd>+<kbd>P</kbd> aperçu / saisie</span><span><kbd>Échap</kbd> fermer</span></div>';
  return h+'<main class="dbody">'+body+'</main></div></div>'}
function deskRecap(w,c,st){var hsT=c.hs+c.samedi,abs=c.counted-c.worked,cn=S._cpt,s=soldeCalc(st,S.weeks),after=s.solde+(w.validated?0:c.gain);
  var kv=function(l,v,cl){return'<div class="kv"><span>'+l+'</span><b'+(cl?' class="'+cl+'"':'')+'>'+v+'</b></div>'},f=function(o){return o.u==="j"?fmtJ(o.reste)+' j':hm(o.reste)};
  var h='<div class="card pad dcard"><h4>Cette semaine</h4>'+kv("Travaillé",hm(c.worked))+(abs>0?kv("Absences comptées",hm(abs)):'')+kv("Heures sup",hm(hsT),"supp")+kv("Heures de nuit",hm(c.night),"nuit")+kv("Majoration HS + nuit",hm(c.majHs+c.majSam+c.majNuit))+kv("Primes panier · équipe",c.panier+" · "+c.panier)+(c.sam?kv("Indemnité samedi",c.sam):'')+
    '<div class="dsep"></div>'+kv("Récup gagnée",'+'+hm(c.gain),"okc")+(c.debit?kv("Récup posée",'−'+hm(c.debit)):'')+kv(w.validated?"Compteur de récup":"Récup après envoi",hm(after))+'</div>';
  h+='<div class="card pad dcard"><h4>Mes compteurs <button class="linkbtn" data-act="tab" data-t="bank">Tout voir</button></h4>'+kv("Récup",hm(cn.recup.reste))+kv("Congé principal",f(cn.cp))+kv("5e semaine",f(cn.c5))+(cn.frac.acq?kv("Fractionnement",f(cn.frac)):'')+kv("Ancienneté · supp.",f(cn.anc)+" · "+f(cn.csup))+kv("CET",hm(cn.cet.solde)+" / "+(CET_MAX/60))+'</div>';
  return h}
function deskSend(w){return'<div class="card pad dcard dsend"><button class="btn primary" data-act="sendopen">'+(w.validated?'Renvoyer la fiche':'Envoyer au service paye')+'</button>'+
  '<div class="tiny" style="text-align:center">'+(w.validated?'Semaine déjà envoyée':'Aperçu, destinataires puis Outlook')+' · <kbd>Ctrl</kbd>+<kbd>Entrée</kbd></div>'+
  '<div class="dsub"><button class="btn small" data-act="obsbtn" aria-pressed="'+!!(S.showObs||w.obs)+'">Observ.</button><button class="btn small" data-act="verif" aria-pressed="'+!!S.verif+'">Vérifier</button><button class="btn small" data-act="export">Excel</button></div></div>'}
function tab(id,l,ic){return'<button data-act="tab" data-t="'+id+'"'+(S.tab===id?' aria-current="page"':'')+'>'+ic+l+'</button>'}
function safeRender(){var a=document.activeElement;if(a&&/INPUT|TEXTAREA|SELECT/.test(a.tagName)&&app.contains(a)){clearTimeout(safeRender.t);safeRender.t=setTimeout(safeRender,2500);return}render()}
/* ----- Navigation ----- */
function goWeek(n){S.send=false;S.cur=shiftKey(S.cur,n);S.sheet=null;S.preview=false;S.showObs=false;S.vres=null;render()}

export { boot, render, refocus, deskShell, deskRecap, deskSend, tab, safeRender, goWeek };
