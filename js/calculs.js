/* CALCULS — heures, heures sup, nuit, primes, samedi, jours fériés, semaines ISO. Fonctions pures : aucune dépendance à l'écran ni au stockage. */
/* ===== Calculs (purs) ===== */
var DAYN=["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];
var DAYL=["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"];
var ABS={cp:"Congé principal",c5:"5e semaine",frac:"Fractionnement",anc:"Ancienneté",csup:"Congé supplémentaire",recup:"Heures à récupérer",formation:"Formation",ferie:"Férié",maladie:"Maladie",greve:"Grève",absence:"Absence"};
var ABSC={cp:"Congé",c5:"5e sem.",frac:"Fract.",anc:"Ancien.",csup:"C. supp.",recup:"Récup",formation:"Form.",ferie:"Férié",maladie:"Maladie",greve:"Grève",absence:"Abs.",conge:"Congé",cjour:"C. supp."};
var CONGE_H={cp:1,c5:1,frac:1,conge:1},CONGE_J={anc:1,csup:1,cjour:1};
var CPT_KEYS=["cp","c5","frac","anc","csup","recup"];
var EXTRAS=[["greve","Grève (heures)","Grève AN"],["ga10","Informations syndicales","Informations syndicales (GA 10)"],["elec","Élection délégué personnel CE","Election Délégué Personnel CE"],["ga20","Heure de réunion","Heure de Réunion (GA 20)"],["ga80","Crédit d'heures","Crédit d'heures (GA 80)"],["g001","Réunion info vœux","Réunion Info vœux (G001)"]];
function defaultSettings(curKey){return{
  profil:{nom:"",matricule:"",poste:"",site:""},
  mails:{paye:"",resp:"",ccResp:true},
  regles:{seuil:2100,palier:480,taux1:25,taux2:50,nuit:100,nuitDebut:360,nuitFin:1200,panierMin:360,samTaux:50,maxJour:600,maxSem:2400,hsMode:"recup",hsCalc:"semaine"},
  comptes:{cp:420,c5:420,frac:420,anc:420,csup:420,recup:420,formation:420,ferie:420,maladie:420,greve:0,absence:0},
  horaires:[
    {id:"m1",label:"",team:"Matin",start:300,end:795,pause:0,theo:420,fri:null},
    {id:"m2",label:"",team:"Matin",start:360,end:795,pause:0,theo:420,fri:null},
    {id:"m3",label:"",team:"Matin",start:330,end:750,pause:0,theo:420,fri:null},
    {id:"s2",label:"",team:"Soir",start:730,end:1165,pause:0,theo:435,fri:{start:720,end:1080,pause:0,theo:360}},
    {id:"s3",label:"",team:"Soir",start:765,end:1215,pause:0,theo:420,fri:null},
    {id:"j",label:"",team:"Journée",start:420,end:930,pause:60,theo:450,fri:{start:420,end:720,pause:0,theo:300}}
  ],
  solde:{min:0,from:curKey||""},
  conges:{h:10500,j:5,from:curKey||""},
  theme:"auto"
}}
function hm(m,signed){if(m==null||isNaN(m))return"";var s=m<0?"-":(signed&&m>0?"+":"");m=Math.round(Math.abs(m));return s+Math.floor(m/60)+":"+String(m%60).padStart(2,"0")}
function toMin(v){if(v==null||v==="")return null;var p=String(v).split(":");if(p.length<2)return null;return(+p[0])*60+(+p[1])}
function toTime(m){if(m==null)return"";m=((m%1440)+1440)%1440;return String(Math.floor(m/60)).padStart(2,"0")+":"+String(m%60).padStart(2,"0")}
function span(s,e){if(s==null||e==null)return 0;var d=e-s;if(d<=0)d+=1440;return d}
function overlap(a,b,c,d){return Math.max(0,Math.min(b,d)-Math.max(a,c))}
function nightMin(s,e,R){if(s==null||e==null)return 0;var E=e<=s?e+1440:e,n=0;
  [[0,R.nuitDebut],[R.nuitFin,1440],[1440,1440+R.nuitDebut],[1440+R.nuitFin,2880]].forEach(function(w){n+=overlap(s,E,w[0],w[1])});return n}
function schedFor(st,id,idx){var h=null;st.horaires.forEach(function(x){if(x.id===id)h=x});if(!h)return null;
  var th=h.theo!=null?+h.theo:420;
  if(idx===4&&h.fri)return{label:h.label||autoLabel(h.fri.start,h.fri.end),team:h.team,start:h.fri.start,end:h.fri.end,pause:h.fri.pause||0,theo:h.fri.theo!=null?+h.fri.theo:th};
  return{label:h.label||autoLabel(h.start,h.end),team:h.team,start:h.start,end:h.end,pause:h.pause||0,theo:th}}
function fmtH(m){m=((m%1440)+1440)%1440;return Math.floor(m/60)+"h"+String(m%60).padStart(2,"0")}
function autoLabel(s,e){return fmtH(s)+" – "+fmtH(e)}
function schedName(h){return h.label||autoLabel(h.start,h.end)}
/* Jours fériés (France métropolitaine) */
function paques(y){var a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),mo=Math.floor((h+l-7*m+114)/31),da=((h+l-7*m+114)%31)+1;return new Date(y,mo-1,da)}
var FER_CACHE={};
function feries(y){if(FER_CACHE[y])return FER_CACHE[y];var r={},P=paques(y);
  function add(d,n){r[d.getFullYear()+"-"+(d.getMonth()+1)+"-"+d.getDate()]=n}
  function rel(n,l){var d=new Date(P);d.setDate(d.getDate()+n);add(d,l)}
  add(new Date(y,0,1),"Jour de l'an");rel(1,"Lundi de Pâques");add(new Date(y,4,1),"Fête du travail");add(new Date(y,4,8),"Victoire 1945");
  rel(39,"Ascension");rel(50,"Lundi de Pentecôte");add(new Date(y,6,14),"Fête nationale");add(new Date(y,7,15),"Assomption");
  add(new Date(y,10,1),"Toussaint");add(new Date(y,10,11),"Armistice");add(new Date(y,11,25),"Noël");
  return FER_CACHE[y]=r}
function ferieOf(d){return feries(d.getFullYear())[d.getFullYear()+"-"+(d.getMonth()+1)+"-"+d.getDate()]||null}
function isWork(d){return d&&(d.type==="perso"||/^sch:/.test(d.type||""))}
function dayCalc(d,idx,st){
  var R=st.regles,r={worked:0,counted:0,night:0,panier:0,team:"",label:"",abs:null,x:{},greveJour:0,formJour:0,theo:0,hsJour:0,recupH:0,congeH:0,sam:0,samedi:0};
  d=d||{};var x=d.x||{};EXTRAS.forEach(function(e){r.x[e[0]]=+x[e[0]]||0});
  if(isWork(d)){
    r.team=d.team||"";r.label=d.type==="perso"?"Perso":(d.label||"");
    r.recupP=+x.recupH||0;r.congeP=+x.congeH||0;r.congeK=x.congeK||"cp";
    r.worked=Math.max(0,span(d.start,d.end)-(+d.pause||0)-r.x.greve);
    r.night=nightMin(d.start,d.end,R);
    r.panier=(r.team==="Matin"||r.team==="Soir")&&r.worked>=R.panierMin?1:0;
    if(d.theo!=null)r.theo=+d.theo;else{var sc=/^sch:/.test(d.type)?schedFor(st,d.type.slice(4),idx):null;r.theo=sc?sc.theo:420}
    if(idx>=5)r.theo=0;
    r.recupH=r.recupP;r.congeH=r.congeP;
    r.counted=r.worked+r.recupH+r.congeH;
    r.hsJour=Math.max(0,r.worked-r.theo);
    if(idx===5){r.samedi=r.worked;r.counted=0;r.hsJour=0;if(r.worked>=R.panierMin){r.panier=1;r.sam=1}}
    r.alerte=r.worked>R.maxJour;
  }else if(d.type&&(ABS[d.type]||d.type==="conge"||d.type==="cjour")){
    r.abs=d.type;r.label=ABS[d.type];r.counted=d.dur!=null?+d.dur:(st.comptes[d.type]!=null?+st.comptes[d.type]:420);
    if(d.type==="greve")r.greveJour=d.dur!=null?+d.dur:420;
    if(d.type==="formation")r.formJour=r.counted;
  }
  return r}
function weekCalc(w,st){
  var R=st.regles,days=(w&&w.days)||[],t={days:[],worked:0,counted:0,night:0,panier:0,recupDays:0,recupAbs:0,recupH:0,congeH:0,x:{},sam:0,samedi:0,cjour:0,alertJours:0,greve:0,formation:0,conge:0,maladie:0,ferie:0,absence:0,hsDay:[]};
  EXTRAS.forEach(function(e){t.x[e[0]]=0});
  for(var i=0;i<7;i++){var c=dayCalc(days[i],i,st);t.days.push(c);
    t.worked+=c.worked;t.counted+=c.counted;t.night+=c.night;t.panier+=c.panier;t.sam+=c.sam;t.samedi+=c.samedi;if(c.alerte)t.alertJours++;if(CONGE_J[c.abs])t.cjour++;
    EXTRAS.forEach(function(e){t.x[e[0]]+=c.x[e[0]]});
    t.recupH+=c.recupH;t.congeH+=c.congeH;
    if(c.abs==="recup"){t.recupDays++;t.recupAbs+=c.counted}
    if(CONGE_H[c.abs])t.conge+=c.counted;if(c.abs==="maladie")t.maladie+=c.counted;if(c.abs==="ferie")t.ferie+=c.counted;if(c.abs==="absence")t.absence++;
    t.greve+=c.greveJour+c.x.greve;t.formation+=c.formJour;}
  t.conge+=t.congeH;
  t.hs=0;for(i=0;i<7;i++)if(i!==5)t.hs+=t.days[i].hsJour;
  if(R.hsCalc!=="jour")t.hs=Math.max(0,t.counted-t.recupH-t.congeH-R.seuil);
  t.pres=Math.max(0,t.counted-R.seuil);
  var hd=t.days.map(function(x,k){return k===5||!isWork(days[k]||{})?0:x.hsJour}),sm=hd.reduce(function(a,b){return a+b},0);
  if(sm>t.hs){var ex=sm-t.hs;for(i=6;i>=0&&ex>0;i--){var rr=Math.min(hd[i],ex);hd[i]-=rr;ex-=rr}}
  else if(sm<t.hs){for(i=6;i>=0;i--)if(i!==5&&isWork(days[i]||{})){hd[i]+=t.hs-sm;break}}
  t.hsDay=hd;
  t.hs1=Math.min(t.hs,R.palier);t.hs2=t.hs-t.hs1;
  t.majHs=t.hs1*R.taux1/100+t.hs2*R.taux2/100;
  t.majNuit=t.night*R.nuit/100;
  t.majSam=t.samedi*(+R.samTaux||0)/100;
  t.alertSem=t.worked>R.maxSem;
  t.recupMode=R.hsMode==="recup";
  t.gain=(t.recupMode?t.hs+t.majHs+t.samedi+t.majSam:0)+t.majNuit;
  t.debit=t.recupAbs+t.recupH;
  t.net=t.gain-t.debit;
  return t}
/* Semaines ISO */
function mondayOf(dt){var d=new Date(dt.getFullYear(),dt.getMonth(),dt.getDate());d.setDate(d.getDate()-((d.getDay()+6)%7));return d}
function keyOf(mon){var th=new Date(mon);th.setDate(th.getDate()+3);var y=th.getFullYear();var w1=mondayOf(new Date(y,0,4));var n=1+Math.round((mon-w1)/(7*864e5));return y+"-W"+String(n).padStart(2,"0")}
function monOfKey(k){var y=+k.slice(0,4),n=+k.slice(6);var d=mondayOf(new Date(y,0,4));d.setDate(d.getDate()+(n-1)*7);return d}
function shiftKey(k,n){var d=monOfKey(k);d.setDate(d.getDate()+7*n);return keyOf(d)}
function fmtD(d){return String(d.getDate()).padStart(2,"0")+"/"+String(d.getMonth()+1).padStart(2,"0")}
function ymdStr(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")}
function dayDate(k,i){var d=monOfKey(k);d.setDate(d.getDate()+i);return d}

export { DAYN, DAYL, ABS, ABSC, CONGE_H, CONGE_J, CPT_KEYS, EXTRAS, defaultSettings, hm, toMin, toTime, span, overlap, nightMin, schedFor, fmtH, autoLabel, schedName, paques, FER_CACHE, feries, ferieOf, isWork, dayCalc, weekCalc, mondayOf, keyOf, monOfKey, shiftKey, fmtD, ymdStr, dayDate };
