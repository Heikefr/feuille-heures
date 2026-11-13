/* ÉCRAN SEMAINE — saisie de la semaine, détail d'un jour, vue année. */
import { ABS, ABSC, CONGE_H, CONGE_J, CPT_KEYS, DAYL, DAYN, EXTRAS, dayCalc, dayDate, ferieOf, fmtD, hm, isWork, keyOf, monOfKey, mondayOf, schedFor, schedName, shiftKey, toTime, weekCalc } from "./calculs.js";
import { CPT_DEF, counters, soldeCalc } from "./compteurs.js";
import { S, week } from "./etat.js";
import { ICON, esc } from "./outils.js";
import { saveWeek } from "./stockage.js";
import { SY, pendingCount } from "./synchro.js";
import { ficheCanvas, ficheURL } from "./fiche.js";
import { fracCands, fracCard, viewReminders } from "./ecran-compteurs.js";
import { deskRecap, deskSend } from "./ecran-rendu.js";
import { viewVerif } from "./ecran-verification.js";

/* ----- Fériés ----- */
function prefillFeries(k){var w=week(k),ch=false;if(w.validated)return;
  for(var i=0;i<5;i++){var d=w.days[i]||{};if(!d.type&&!d.noFerie&&ferieOf(dayDate(k,i))){w.days[i]={type:"ferie",auto:true,x:d.x||{}};ch=true}}
  if(ch)saveWeek(k)}
function selOptions(d,i){var st=S.settings,o='',cur=d.type||"";
  st.horaires.forEach(function(h){o+='<option value="sch:'+h.id+'"'+(cur==="sch:"+h.id?' selected':'')+'>'+esc(schedFor(st,h.id,i).label)+'</option>'});
  o+='<option value="perso"'+(cur==="perso"?' selected':'')+'>Autre horaire</option><optgroup label="Congés (compteur)">';
  var cn=S._cpt||counters(st,S.weeks);
  CPT_KEYS.forEach(function(k){var c=cn[k];o+='<option value="'+k+'"'+(cur===k?' selected':'')+'>'+ABS[k]+' · reste '+(c.u==="j"?c.reste+' j':hm(c.reste))+'</option>'});
  o+='</optgroup><optgroup label="Autres absences">';
  ["formation","ferie","maladie","greve","absence"].forEach(function(k){o+='<option value="'+k+'"'+(cur===k?' selected':'')+'>'+ABS[k]+'</option>'});
  return o+'</optgroup><option value=""'+(!cur?' selected':'')+'>'+(i>4?'Repos':'Non renseigné')+'</option>'}
function selClass(d,dc){return isWork(d)?dc.team:dc.abs?'abs':'off'}
function theoRange(d,i){var st=S.settings,sc=/^sch:/.test(d.type||"")?schedFor(st,d.type.slice(4),i):null,s=sc?sc.start:d.start,p=sc?sc.pause:(+d.pause||0),dc=dayCalc(d,i,st);
  if(!dc.theo)return null;return{s:s,e:s+dc.theo+p,t:dc.theo}}
function isChanged(d,i,k){var sc=/^sch:/.test(d.type||"")?schedFor(S.settings,d.type.slice(4),i):null;return sc&&sc[k]!==d[k]}
function primes(dc){return'<span class="prim"><i class="'+(dc.panier?'on':'')+'">P</i><i class="'+(dc.panier?'on':'')+'">E</i><i class="'+(dc.sam?'on':'')+'">S</i></span>'}
function viewWeek(){
  var st=S.settings,w=week(),c=weekCalc(w,st),mon=monOfKey(S.cur),out='<section>',lock=w.validated?' disabled':'',D=S.desk,P=D&&S.dprev;
  if(S.storeErr)out+='<div class="banner warn">Impossible de lire les données enregistrées sur cet appareil.</div>';
  if(!st.profil.nom&&!D)out+='<div class="banner info">Renseigne ton profil et les adresses mail dans Réglages. <button class="btn small" data-act="tab" data-t="set">Ouvrir</button></div>';
  if(w.validated)out+='<div class="banner ok"><span>Envoyée'+(w.sentAt?' le '+esc(w.sentAt):'')+'. Semaine verrouillée.</span><button class="btn small" data-act="reopen">Modifier</button></div>';
  else{out+='<div class="quick" aria-label="Remplir lundi à vendredi"><span class="qlbl">Remplir :</span>';
    st.horaires.forEach(function(h){out+='<button class="qbtn t'+({Matin:"m",Soir:"s","Journée":"j"}[h.team]||"")+'" data-act="fill" data-id="'+h.id+'">'+esc(schedName(h))+'</button>'});
    out+='<button class="qbtn tv" data-act="clear">Vider</button></div>'}
  out+='<label class="wnote"><span>Note</span><input type="text" data-act="wnote" placeholder="Ex. Vacances, Formation soudure…" value="'+esc(w.note||"")+'"'+lock+'></label>';
  if(!D&&SY.api&&pendingCount()&&(navigator.onLine===false||SY.err))out+='<div class="banner info">'+(navigator.onLine===false||SY.err==="Hors ligne"?'Hors ligne : ':'Synchro en attente : ')+pendingCount()+' modification(s) enregistrée(s) ici, envoyée(s) dès le retour du réseau.</div>';
  if(!D)out+=viewReminders(true);
  fracCands().filter(function(x){return x.k===S.cur}).forEach(function(x){out+=fracCard(x)});
  if(c.alertSem||c.alertJours)out+='<div class="banner warn">'+(c.alertSem?'Semaine à '+hm(c.worked)+' : au-delà du maximum de '+hm(st.regles.maxSem)+'. ':'')+(c.alertJours?c.alertJours+' jour(s) au-delà de '+hm(st.regles.maxJour)+'.':'')+'</div>';
  var ph='',pc='';
  for(var i=0;i<7;i++){var d=w.days[i]||{},dc=c.days[i],dt=new Date(mon),wk,fn;dt.setDate(dt.getDate()+i);wk=isWork(d);fn=ferieOf(dt);
    var sel='<select class="psel '+selClass(d,dc)+'" data-act="dtype" data-i="'+i+'" aria-label="Horaire du '+DAYL[i]+'"'+lock+'>'+selOptions(d,i)+'</select>';
    var tr=wk?theoRange(d,i):null;
    var tin=function(k){return'<input type="time" class="tin'+(isChanged(d,i,k)?' chg':'')+'" data-act="dset" data-i="'+i+'" data-k="'+k+'" value="'+toTime(d[k])+'" aria-label="'+(k==="start"?"Arrivée":"Fin")+' '+DAYL[i]+'"'+lock+'>'};
    var pause=wk?'<label><input type="checkbox" data-act="dpause" data-i="'+i+'"'+(+d.pause?' checked':'')+lock+'> Pause'+(+d.pause?' '+hm(+d.pause):'')+'</label>':'';
    var notes=[];if(fn)notes.push(fn+(i>4?' (information)':'')+(fn==="Lundi de Pentecôte"?' — à vérifier':''));if(dc.alerte)notes.push('plus de '+hm(st.regles.maxJour)+' !');
    EXTRAS.forEach(function(e){if(dc.x[e[0]])notes.push(e[1]+' '+hm(dc.x[e[0]]))});if(dc.recupP)notes.push('récup posée '+hm(dc.recupP));if(dc.congeP)notes.push('congé posé '+hm(dc.congeP)+' ('+ABSC[dc.congeK].toLowerCase()+')');if(i===5&&dc.samedi)notes.push('samedi +'+st.regles.samTaux+' %');
    var more=lock?'':'<button class="more" data-act="openday" data-i="'+i+'" aria-label="Autres heures du '+DAYL[i]+'">⋯</button>';
    var tot=wk?hm(dc.worked):dc.abs&&dc.counted?hm(dc.counted):'';
    ph+='<div class="prow'+(!wk&&!dc.abs?' off':'')+'"><div class="pday"><b>'+DAYN[i]+'</b><span>'+fmtD(dt)+'</span></div><div class="pmid">'+sel+
      (wk?'<div class="preal">'+tin("start")+'<span>→</span>'+tin("end")+(tr?'<span class="ptheo">théo '+toTime(tr.s)+'–'+toTime(tr.e)+'</span>':'')+'</div>'+
        '<div class="pinf"><span>Supp <b class="supp">'+(c.hsDay[i]?hm(c.hsDay[i]):'0:00')+'</b></span><span>Nuit <b class="nuit">'+(dc.night?hm(dc.night):'0:00')+'</b></span>'+pause+primes(dc)+more+'</div>'
      :(notes.length||more?'<div class="pinf">'+(dc.abs==="recup"?'<span>débit du compteur</span>':'')+more+'</div>':''))+
      (notes.length?'<div class="pnote">'+esc(notes.join(' · '))+'</div>':'')+
      '</div><div class="ptot"><b'+(dc.alerte?' class="negc"':'')+'>'+tot+'</b>'+(dc.abs&&dc.counted?'<span>compté</span>':'')+'</div></div>';
    pc+='<div class="pcr'+(!wk&&!dc.abs?' off':'')+'"><div class="pday"><b>'+DAYL[i]+'</b><span>'+fmtD(dt)+'</span></div><div>'+sel+'</div>'+
      '<div class="g3 ptheo">'+(tr?'<span>'+toTime(tr.s)+'</span><span>'+toTime(tr.e)+'</span><span>'+hm(tr.t)+'</span>':'')+'</div>'+
      '<div>'+(wk?tin("start")+tin("end"):'')+'</div><div class="pinf">'+pause+'</div>'+
      '<div class="g3"><b>'+tot+'</b><b class="supp">'+(c.hsDay[i]?hm(c.hsDay[i]):'')+'</b><b class="nuit">'+(dc.night?hm(dc.night):'')+'</b></div>'+
      '<div>'+(wk||dc.sam?primes(dc):'')+'</div><div class="pabs"><div>'+(dc.abs?'<b>'+(dc.counted?hm(dc.counted):'—')+'</b> '+(CPT_DEF[dc.abs]?'débit '+ABSC[dc.abs].toLowerCase():'compté'):'')+(notes.length?'<div class="pnote">'+esc(notes.join(' · '))+'</div>':'')+'</div>'+more+'</div></div>'}
  var hsT=c.hs+c.samedi;
  var congeBtn=w.validated?'':S.pickConge===S.cur?'<div class="card pad"><b>Poser lundi–vendredi en congé, sur quel compteur ?</b>'+congeChooser(S.cur)+'</div>':'<button class="btn paperbtn" data-act="weekconge">Poser la semaine en congé payé</button>';
  out+='<div class="paper pph"><div class="ph-h"><div>Jour</div><div>Horaire · temps réel</div><div style="text-align:right">Total</div></div>'+ph+
    '<div class="pfoot"><div>Sem.</div><div class="mono">Supp <span class="supp">'+hm(hsT)+'</span> · Nuit <span class="nuit">'+hm(c.night)+'</span> · P/E '+c.panier+'</div><div class="r">'+hm(c.counted)+'</div></div></div>';
  out+='<div class="paper pcg"><div class="pc-h"><div>Jour</div><div>Horaire</div><div style="--n:3">Théorique<small><span>Début</span><span>Fin</span><span>Total</span></small></div><div style="--n:2">Temps réel<small><span>Arrivée</span><span>Fin</span></small></div><div>Pause</div><div style="--n:3">Total d\'heures<small><span>Total</span><span>Supp</span><span>Nuit</span></small></div><div>Primes<small style="--n:1"><span>P · E · S</span></small></div><div>Absence</div></div>'+pc+
    '<div class="pcf"><div>Semaine</div><div></div><div class="ptheo" style="text-align:center">'+hm(st.regles.seuil)+'</div><div></div><div></div><div class="g3"><span>'+hm(c.counted)+'</span><span class="supp">'+hm(hsT)+'</span><span class="nuit">'+hm(c.night)+'</span></div><div class="mono">'+c.panier+' · '+c.panier+' · '+c.sam+'</div><div class="tiny">'+(c.conge||c.ferie?('Congés/fériés '+hm(c.conge+c.ferie)):'')+'</div></div></div>';
  out+=congeBtn;
  if(D){
    if(S.verif)out+=viewVerif();
    else if(w.check)out+='<button class="remind'+(w.check.bad?' on':'')+'" data-act="verif" style="text-align:left;border:0">'+'<b>'+(w.check.bad?'⚠ '+w.check.bad+' écart(s) avec la compta':'✓ Vérifiée avec la compta')+'</b><span>le '+esc(w.check.at)+' · cliquer pour revoir</span></button>';
    if(S.showObs||w.obs)out+='<div class="field"><label for="obs">Observation (apparaît sur la fiche)</label><textarea id="obs" data-act="obs"'+lock+'>'+esc(w.obs||"")+'</textarea></div>';
    out+='</section>';
    var right=P?'<div class="dfiche"><div class="dlab">L\'image exacte qui partira dans le mail</div><img class="fiche-img" alt="Fiche de la semaine" src="'+ficheURL(w,c,st)+'"></div>':deskRecap(w,c,st);
    if(!P){var cut=right.indexOf('<div class="card pad dcard"><h4>Mes compteurs');right=right.slice(0,cut)+deskSend(w)+right.slice(cut)}else right+=deskSend(w);
    return'<div class="dweek'+(P?' prev':'')+'"><div class="dleft">'+out+'</div><div class="dright">'+right+'</div></div>'}
  var s=soldeCalc(st,S.weeks),after=s.solde+(w.validated?0:c.gain);
  out+='<div class="wkbottom"><div style="display:grid;gap:10px"><div class="tiles"><div><span>Heures sup</span><b>'+hm(hsT)+'</b></div><div><span>Maj. HS + nuit</span><b>'+hm(c.majHs+c.majSam+c.majNuit)+'</b></div><div class="'+(c.net<0?'n':'g')+'"><span>Compteur</span><b>'+hm(c.net,true)+'</b></div></div>'+
    '<div class="tiny">Compteur de récup '+(w.validated?'':'après envoi')+' : <b class="mono">'+hm(after)+'</b>'+(c.hs2?' · dont '+hm(c.hs2)+' d\'HS à '+st.regles.taux2+' %':'')+'</div></div>';
  out+='<div style="display:grid;gap:10px"><div class="acts">'+
    '<button class="act p" data-act="sendopen">'+ICON.mail+(w.validated?'Renvoyer':'Envoyer')+'</button>'+
    '<button class="act" data-act="preview" aria-pressed="'+!!S.preview+'">'+ICON.eye+'Aperçu</button>'+
    '<button class="act" data-act="obsbtn" aria-pressed="'+!!(S.showObs||w.obs)+'">'+ICON.pen+'Observ.</button>'+
    '<button class="act" data-act="verif" aria-pressed="'+!!S.verif+'">'+ICON.check+'Vérifier</button></div></div></div>';
  if(S.verif)out+=viewVerif();
  else if(w.check)out+='<button class="remind'+(w.check.bad?' on':'')+'" data-act="verif" style="text-align:left;border:0">'+'<b>'+(w.check.bad?'⚠ '+w.check.bad+' écart(s) avec la compta':'✓ Vérifiée avec la compta')+'</b><span>le '+esc(w.check.at)+' · toucher pour revoir</span></button>';
  if(S.showObs||w.obs)out+='<div class="field"><label for="obs">Observation (apparaît sur la fiche)</label><textarea id="obs" data-act="obs"'+lock+'>'+esc(w.obs||"")+'</textarea></div>';
  if(S.preview)out+='<img class="fiche-img" alt="Aperçu de la fiche" src="'+ficheCanvas(w,c,st).toDataURL("image/png")+'">';
  out+='</section>';return out}
/* ----- Vue année ----- */
function weekStatus(k){var w=S.weeks[k];if(!w)return"";if(w.validated)return"s";var any=(w.days||[]).some(function(d){return d&&d.type&&!d.auto});return any?"dr":""}
function viewYear(){var y=S.year,M=["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"],by={};
  var k=keyOf(mondayOf(new Date(y,0,4)));
  while(+k.slice(0,4)===y){var th=monOfKey(k);th.setDate(th.getDate()+3);(by[th.getMonth()]=by[th.getMonth()]||[]).push(k);k=shiftKey(k,1)}
  var today=keyOf(mondayOf(new Date())),out='<div class="ysheet" data-act="yclose"><div class="ypanel" role="dialog" aria-label="Choisir une semaine">'+
    '<div class="yhd"><button class="iconbtn" data-act="yr" data-n="-1" aria-label="Année précédente">'+ICON.prev+'</button><b>'+y+'</b><button class="iconbtn" data-act="yr" data-n="1" aria-label="Année suivante">'+ICON.next+'</button><button class="btn small" data-act="ytoday">Aujourd\'hui</button></div>'+
    '<div class="yleg"><span><i style="background:var(--ok-bg);border:1px solid var(--ok)"></i>Envoyée</span><span><i style="background:var(--warn-bg);border:1px solid var(--warn)"></i>À envoyer</span><span><i style="background:var(--soir-bg);border:1px solid var(--soir)"></i>Congés</span><span><i style="background:var(--note-bg);border:1px solid var(--note)"></i>Note / formation</span><span><i style="background:var(--warn);border-radius:50%"></i>Férié</span></div>'+
    (S.yEdit?(function(){var k=S.yEdit,w=S.weeks[k]||{};return'<div class="yedit"><b>Semaine '+(+k.slice(6))+' · du '+fmtD(dayDate(k,0))+' au '+fmtD(dayDate(k,6))+'</b><label class="wnote"><span>Note</span><input type="text" data-act="ynote" data-k="'+k+'" placeholder="Ex. Vacances, Formation soudure…" value="'+esc(w.note||"")+'"></label><div class="btns"><button class="btn small" data-act="ygo" data-k="'+k+'">Ouvrir la semaine</button><button class="btn small" data-act="yedclose">Fermer</button></div><span class="tiny">Poser lundi–vendredi en :</span>'+congeChooser(k).replace('<button class="btn small ghost" data-act="pickno">Annuler</button>','')+'</div>'})():'<div class="tiny">Touche une semaine pour l\'ouvrir. Appui long : note ou congé.</div>');
  M.forEach(function(m,i){if(!by[i])return;out+='<div class="ymo"><span>'+m+'</span><div class="ywk">'+by[i].map(function(k){var w=S.weeks[k],c=weekStatus(k),mark="";
      if(w&&(w.days||[]).some(function(d){return d&&(CONGE_H[d.type]||CONGE_J[d.type])}))mark="c";else if(w&&(w.note||(w.days||[]).some(function(d){return d&&d.type==="formation"})))mark="n";
      for(var j=0;j<5;j++)if(ferieOf(dayDate(k,j))){mark+=" f";break}
      if(mark.indexOf("c")===0||mark.indexOf("n")===0)c=c.replace("dr","");
      return'<button class="yw '+(mark?mark+' '+c.replace("dr",""):c)+(k===today?' cur':'')+(k===S.cur?' sel':'')+'" data-act="ygo" data-k="'+k+'">S'+k.slice(6)+(w&&w.check?'<em class="ychk'+(w.check.bad?' bad':'')+'">'+(w.check.bad?'!':'✓')+'</em>':'')+'</button>'}).join("")+'</div></div>';
    var nn=by[i].filter(function(k){return S.weeks[k]&&S.weeks[k].note}).map(function(k){return'S'+k.slice(6)+' · '+esc(S.weeks[k].note)});
    if(nn.length)out+='<div class="ynote">📌 '+nn.join(' — ')+'</div>'});
  return out+'</div></div>'}

function viewSheet(){var i=S.sheet,w=week(),d=w.days[i]||{},st=S.settings,mon=monOfKey(S.cur),dt=new Date(mon);dt.setDate(dt.getDate()+i);
  var g='<div class="grid-sched">';
  st.horaires.forEach(function(h){var s=schedFor(st,h.id,i),cl={Matin:"m",Soir:"s","Journée":"j"}[h.team]||"m";
    g+='<button class="sbtn '+cl+'" data-act="pick" data-id="'+h.id+'" aria-pressed="'+(d.type==="sch:"+h.id)+'"><b>'+esc(s.label)+'</b><span>'+toTime(s.start)+'–'+toTime(s.end)+'</span></button>'});
  g+='<button class="sbtn" data-act="pick" data-id="perso" aria-pressed="'+(d.type==="perso")+'"><b>Perso</b><span>autre horaire</span></button>';
  Object.keys(ABS).forEach(function(k){g+='<button class="sbtn a" data-act="pick" data-id="'+k+'" aria-pressed="'+(d.type===k)+'"><b>'+ABS[k]+'</b><span>'+(st.comptes[k]?hm(st.comptes[k]):'0:00')+(k==="recup"?' débit':'')+'</span></button>'});
  g+='<button class="sbtn" data-act="pick" data-id="" aria-pressed="'+(!d.type)+'"><b>Repos</b><span>rien</span></button></div>';
  var times="";
  if(isWork(d)){times='<div class="row3"><div class="field"><label for="d-start">Début</label><input type="time" id="d-start" data-act="dset" data-k="start" value="'+toTime(d.start)+'"></div>'+
    '<div class="field"><label for="d-end">Fin</label><input type="time" id="d-end" data-act="dset" data-k="end" value="'+toTime(d.end)+'"></div>'+
    '<div class="field"><label for="d-pause">Pause</label><input type="time" id="d-pause" data-act="dset" data-k="pause" value="'+toTime(+d.pause||0)+'"></div></div>'+
    (i<5?'<div class="row3"><div class="field"><label for="d-theo">Théorique</label><input type="time" id="d-theo" data-act="dset" data-k="theo" value="'+toTime(dayCalc(d,i,st).theo)+'"></div></div>':'');
    if(d.type==="perso")times+='<div class="field"><label for="d-team">Équipe</label><select id="d-team" data-act="dset" data-k="team">'+["Matin","Soir","Journée"].map(function(t){return'<option'+(d.team===t?' selected':'')+'>'+t+'</option>'}).join("")+'</select></div>';
    var c=dayCalc(d,i,st);times+='<div class="tiny mono">Travaillé '+hm(c.worked)+(c.night?' · nuit '+hm(c.night):'')+(c.panier?' · primes panier + équipe':'')+'</div>';}
  var x=d.x||{},ex='<details'+(EXTRAS.some(function(e){return+x[e[0]]})||+x.sam?' open':'')+'><summary>Autres heures (grève, syndical, réunion…)</summary><div class="pad"><div class="row2">';
  EXTRAS.forEach(function(e){ex+='<div class="field"><label for="x-'+e[0]+'">'+e[1]+'</label><input type="time" id="x-'+e[0]+'" data-act="xset" data-k="'+e[0]+'" value="'+(+x[e[0]]?toTime(+x[e[0]]):"")+'"></div>'});
  ex+='</div>'+'<div class="tiny">La grève en heures se retire du temps travaillé. Les autres lignes sont reportées sur la fiche.</div></div></details>';
  var xx=d.x||{};
  if(isWork(d)&&i<5)times+='<div class="row2"><div class="field"><label for="x-recupH">Heures à récupérer prises ce jour</label><input type="time" id="x-recupH" data-act="xset" data-k="recupH" value="'+(+xx.recupH?toTime(+xx.recupH):"")+'"></div>'+
    '<div class="field"><label for="x-congeH">Congé pris ce jour</label><input type="time" id="x-congeH" data-act="xset" data-k="congeH" value="'+(+xx.congeH?toTime(+xx.congeH):"")+'"></div></div>'+
    '<div class="field"><label for="x-congeK">Ce congé est pris sur</label><select id="x-congeK" data-act="xsel" data-k="congeK">'+["cp","c5","frac"].map(function(k){return'<option value="'+k+'"'+((xx.congeK||"cp")===k?' selected':'')+'>'+ABS[k]+'</option>'}).join("")+'</select></div>'+
    '<div class="tiny">Pose-les quand tu pars en dehors de tes heures. Comme pour la compta, elles sont retirées en entier du compteur et comptées comme du temps de la journée.</div>';
  if(d.type&&ABS[d.type]&&d.type!=="ferie")times+='<div class="row2"><div class="field"><label for="d-dur">Durée comptée</label><input type="time" id="d-dur" data-act="dset" data-k="dur" value="'+toTime(dayCalc(d,i,st).counted)+'"></div></div><div class="tiny">Par défaut '+hm(st.comptes[d.type]||0)+'. Mets par exemple 3:30 pour une demi-journée.</div>';
  if(i===5)times+='<div class="tiny">Samedi : heures hors seuil de la semaine, toutes à récupérer avec '+st.regles.samTaux+' % de majoration. Dès '+hm(st.regles.panierMin)+' de travail : panier, équipe et indemnité samedi 3006.</div>';
  return'<div class="sheet-bg" data-act="close"><div class="sheet" role="dialog" aria-label="'+DAYL[i]+'"><div class="sheet-h"><b>'+DAYL[i]+' '+fmtD(dt)+'</b><button class="btn small" data-act="close">OK</button></div>'+g+times+ex+
  '<div class="btns"><button class="btn small" data-act="prevday"'+(i===0?' disabled':'')+'>‹ Jour précédent</button><button class="btn small" data-act="nextday"'+(i===6?' disabled':'')+'>Jour suivant ›</button></div></div></div>'}
/* ----- Actions ----- */
function setDay(i,d){var w=week();w.days[i]=d;saveWeek()}
function applySched(i,id){var s=schedFor(S.settings,id,i);var old=week().days[i]||{};return{type:"sch:"+id,label:s.label,team:s.team,start:s.start,end:s.end,pause:s.pause,theo:s.theo,x:old.x||{}}}
function poseConge(k,ty){var w=week(k);for(var i=0;i<5;i++){var d=w.days[i]||{};if(d.type==="ferie"||ferieOf(dayDate(k,i)))continue;w.days[i]={type:ty||"cp",x:{}}}if(!w.note)w.note="Congés";saveWeek(k)}
function congeChooser(k){return'<div class="btns">'+["cp","c5","frac"].map(function(ty){var c=(S._cpt||{})[ty];return'<button class="btn small" data-act="poseconge" data-k="'+k+'" data-t="'+ty+'">'+ABS[ty]+(c?' <span class="tiny">reste '+hm(c.reste)+'</span>':'')+'</button>'}).join("")+'<button class="btn small ghost" data-act="pickno">Annuler</button></div>'}

export { prefillFeries, viewWeek, weekStatus, viewYear, viewSheet, setDay, applySched, poseConge };
