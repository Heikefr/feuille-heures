/* FICHE — la « fiche de travail & d'absences » envoyée au service paye, dessinée en image. */
import { ABSC, DAYL, EXTRAS, dayDate, ferieOf, fmtD, hm, isWork, monOfKey, toTime, weekCalc } from "./calculs.js";
import { S, week } from "./etat.js";
import { esc, h2m, toast } from "./outils.js";
import { saveWeek } from "./stockage.js";
import { addSnap } from "./sauvegardes.js";
import { render } from "./ecran-rendu.js";

function ficheHtml(w,c,st,sentAt,solde){var mon=monOfKey(S.cur),sun=new Date(mon);sun.setDate(sun.getDate()+6);
  var B="border:1px solid #000;",Y="background:#FFFFCC;",G="background:#D9D9D9;",F="font-family:Calibri,Arial,sans-serif;font-size:13px;color:#000;",C="text-align:center;",P="padding:3px 6px;";
  function td(v,s,a){return'<td'+(a||'')+' style="'+B+P+F+(s||'')+'">'+(v==null?'':v)+'</td>'}
  var days=w.days.map(function(d){return d||{}}),R=st.regles,rec=c.recupMode;
  function row(label,vals,tot,opt){opt=opt||{};var bg=opt.bg||Y,h='<tr>'+td(label,bg+(opt.bold?'font-weight:bold;':''),' colspan="2"');
    for(var i=0;i<7;i++)h+=td(vals[i]==null?'':vals[i],bg+C+(opt.bold?'font-weight:bold;':''));return h+td(tot==null?'':tot,bg+C+'font-weight:bold;')+'</tr>'}
  function vt(arr){return arr.map(function(v){return v?h2m(v):''})}
  function lbl(i){var d=days[i],dc=c.days[i];if(i>4&&dc.abs==="ferie")return'';return dc.abs?esc(dc.label):''}
  var h='<table cellspacing="0" cellpadding="0" style="border-collapse:collapse;'+F+'">';
  h+='<tr>'+td('<b style="font-size:17px">FICHE DE TRAVAIL &amp; ABSENCES</b>',G+C,' colspan="7"')+td('<b style="color:#833C0B">'+fmtD(mon)+' au '+fmtD(sun)+'</b>',G+C,' colspan="2"')+td('<b style="font-size:16px">'+sun.getFullYear()+'</b>',G+C)+'</tr>';
  h+='<tr>'+td('<b>MATRICULE:</b>',G+C)+td(esc(st.profil.matricule),Y+C,' colspan="2"')+td('<b>NOM:</b>',G+C)+td(esc(st.profil.nom),Y+C,' colspan="2"')+td('',G,' colspan="2"')+td('<b>SEMAINE:</b>',G+C)+td('<b style="font-size:16px">'+(+S.cur.slice(6))+'</b>',Y+C)+'</tr>';
  h+='<tr>'+td('',Y,' colspan="2"');["L","M","M","J","V","S","D"].forEach(function(l){h+=td('<b style="font-size:16px">'+l+'</b>',Y+C)});h+=td('',Y)+'</tr>';
  h+=row('<b>Horaire théorique</b>',c.days.map(function(dc,i){return isWork(days[i])&&dc.theo?h2m(dc.theo):''}),'<b>TOTAL</b>');
  h+='<tr>'+td('<b>Horaire décalé</b>',Y+C,' rowspan="2"')+td('<b>DEBUT --&gt;</b>',Y+C);
  for(var i=0;i<7;i++)h+=td(isWork(days[i])?toTime(days[i].start):'',Y+C);h+=td('',Y)+'</tr><tr>'+td('<b>FIN--&gt;</b>',Y+C);
  for(i=0;i<7;i++)h+=td(isWork(days[i])?toTime(days[i].end):'<b>'+lbl(i)+'</b>',Y+C);h+=td('',Y)+'</tr>';
  h+=row('<b>Nombre total d\'heures de travail</b>',vt(c.days.map(function(x){return x.worked})),c.worked?h2m(c.worked):'',{});
  var hsTot=c.hs+c.samedi;
  h+=row('Heures suppl. à récupérer',rec?vt(c.days.map(function(x){return x.hsJour})):[],rec&&hsTot?h2m(hsTot):'');
  h+=row('Heures suppl. à payer',!rec?vt(c.days.map(function(x){return x.hsJour})):[],!rec&&hsTot?h2m(hsTot):'');
  h+=row('<b>HEURE DE NUIT</b>',vt(c.days.map(function(x){return x.night})),h2m(c.night),{bg:G});
  h+=row('Prime de panier 3001',c.days.map(function(x){return x.panier||''}),c.panier||'');
  h+=row('Prime d\'équipe 3008',c.days.map(function(x){return x.panier||''}),c.panier||'');
  h+=row('Indemnité de Samedi 3006',c.days.map(function(x){return x.sam||''}),c.sam||'');
  h+=row('Formation permanente (GA 40)',vt(c.days.map(function(x){return x.formJour})),c.formation?h2m(c.formation):'');
  h+=row('Grève AN',vt(c.days.map(function(x){return x.greveJour+x.x.greve})),c.greve?h2m(c.greve):'');
  EXTRAS.slice(1).forEach(function(e){h+=row(e[2],vt(c.days.map(function(x){return x.x[e[0]]})),c.x[e[0]]?h2m(c.x[e[0]]):'')});
  h+='<tr>'+td('<b>Equipe</b>',Y+'text-align:right;',' colspan="2"');for(i=0;i<6;i++)h+=td('<b>'+(isWork(days[i])?esc(c.days[i].team):lbl(i))+'</b>',Y+C);
  h+=td('<b>Majoration</b>',Y+C)+td('<b>'+h2m(c.majHs+c.majSam)+'</b>',Y+C)+'</tr>';
  h+='<tr>'+td('<b>OBSERVATION :</b>',Y+C+'height:46px;',' colspan="2"')+td(esc(w.obs||'').replace(/\n/g,'<br>'),'background:#FFFFCC;vertical-align:top;',' colspan="8"')+'</tr></table>';
  // bilan
  var bl=[["Total de la semaine (absences comprises)",h2m(c.counted)],["Heures sup ("+R.taux1+" % jusqu'à "+hm(R.seuil+R.palier)+", "+R.taux2+" % au-delà)",h2m(c.hs)+(c.hs2?' (dont '+h2m(c.hs2)+' à '+R.taux2+' %)':'')]];
  if(c.samedi)bl.push(["Heures du samedi (majorées "+R.samTaux+" %)",h2m(c.samedi)]);
  bl.push(["Majoration heures sup"+(c.samedi?" et samedi":""),h2m(c.majHs+c.majSam)],["Heures de nuit · majoration "+R.nuit+" %",h2m(c.night)+' · '+h2m(c.majNuit)],
    ["Total à récupérer cette semaine",h2m(c.gain)]);
  if(c.debit)bl.push(["Récupération prise",h2m(c.debit)]);
  bl.push(["Solde du compteur de récupération",(solde<0?'-':'')+h2m(Math.abs(solde))]);
  h+='<br><table cellspacing="0" cellpadding="0" style="border-collapse:collapse;'+F+'"><tr>'+td('<b>BILAN DE LA SEMAINE</b>',G,' colspan="2"')+'</tr>';
  bl.forEach(function(r,j){h+='<tr>'+td(r[0],Y)+td('<b>'+r[1]+'</b>',Y+C)+'</tr>'});
  h+='</table>';
  if(sentAt)h+='<p style="'+F+'color:#555;font-style:italic">Envoyé le '+esc(sentAt)+'</p>';
  return h}
function ficheText(w,c,st){var lines=["FICHE DE TRAVAIL & ABSENCES – Semaine "+(+S.cur.slice(6))+" – "+st.profil.nom+" ("+st.profil.matricule+")"];
  for(var i=0;i<7;i++){var d=w.days[i]||{},dc=c.days[i],dt=dayDate(S.cur,i);if(isWork(d))lines.push(DAYL[i]+" "+fmtD(dt)+" : "+dc.team+" "+toTime(d.start)+"-"+toTime(d.end)+" = "+h2m(dc.worked)+(dc.night?" (nuit "+h2m(dc.night)+")":""));else if(dc.abs&&!(i>4&&dc.abs==="ferie"))lines.push(DAYL[i]+" "+fmtD(dt)+" : "+dc.label)}
  lines.push("Total travaillé : "+h2m(c.worked)+" · Heures sup : "+h2m(c.hs+c.samedi)+" · Nuit : "+h2m(c.night)+" · Majoration : "+h2m(c.majHs+c.majSam)+" · Primes panier/équipe : "+c.panier);
  if(w.obs)lines.push("Observation : "+w.obs);return lines.join("\n")}
function copyRich(html,text){
  var full='<div style="font-family:Calibri,Arial,sans-serif;font-size:14px">'+html+'</div>';
  try{if(navigator.clipboard&&window.ClipboardItem){return navigator.clipboard.write([new ClipboardItem({"text/html":new Blob([full],{type:"text/html"}),"text/plain":new Blob([text],{type:"text/plain"})})]).then(function(){return true},function(){return legacyCopy(full)})}}catch(e){}
  return Promise.resolve(legacyCopy(full))}
function legacyCopy(html){var d=document.createElement("div");d.contentEditable="true";d.style.cssText="position:fixed;left:-9999px;top:0;background:#fff";d.innerHTML=html;document.body.appendChild(d);
  var r=document.createRange();r.selectNodeContents(d);var s=getSelection();s.removeAllRanges();s.addRange(r);var ok=false;try{ok=document.execCommand("copy")}catch(e){}s.removeAllRanges();d.remove();return ok}
function sendHtml(validate){var w=week(),st=S.settings,now=new Date();
  var sentAt=fmtD(now)+"/"+now.getFullYear()+" à "+String(now.getHours()).padStart(2,"0")+":"+String(now.getMinutes()).padStart(2,"0");
  var c=weekCalc(w,st),bp=ficheBlob(w,c,st),done=function(ok){
    if(validate){w.validated=true;w.sentAt=sentAt;saveWeek();addSnap("Fiche S"+(+S.cur.slice(6))+" validée",true)}
    S.lastExport=S.cur;render();toast(ok?(validate?"Semaine validée, image de la fiche copiée":"Image de la fiche copiée"):"Copie impossible : fais un appui long sur l'image pour la copier")};
  try{if(navigator.clipboard&&window.ClipboardItem){navigator.clipboard.write([new ClipboardItem({"image/png":bp})]).then(function(){done(true)},function(){done(false)});return}}catch(e){}
  done(false)}
/* ----- Fiche papier en image ----- */
function ficheData(w,c,st){var days=w.days.map(function(d){return d||{}}),F={matricule:st.profil.matricule||"",nom:st.profil.nom||"",semaine:+S.cur.slice(6)};
  function v(f){return c.days.map(function(x,i){var r=f(x,i);return r?r:""})}
  F.theo=v(function(x,i){return isWork(days[i])&&x.theo?h2m(x.theo):""});
  F.debut=v(function(x,i){return isWork(days[i])?toTime(days[i].start):(x.abs&&!(i>4&&x.abs==="ferie")?ABSC[x.abs]:"")});
  F.fin=v(function(x,i){return isWork(days[i])?toTime(days[i].end):(x.abs&&!(i>4&&x.abs==="ferie")?ABSC[x.abs]:"")});
  F.trav=v(function(x){return x.worked?hm(x.worked):""});F.travTot=c.worked?hm(c.worked):"";
  var hs=c.hsDay.slice();hs[5]=c.days[5].samedi;var hsT=c.hs+c.samedi;
  F.hsr=c.recupMode?hs.map(function(m){return m?h2m(m):""}):[];F.hsrTot=c.recupMode&&hsT?h2m(hsT):"";
  F.hsp=!c.recupMode?hs.map(function(m){return m?h2m(m):""}):[];F.hspTot=!c.recupMode&&hsT?h2m(hsT):"";
  F.nuit=v(function(x){return x.night?h2m(x.night):""});F.nuitTot=c.night?h2m(c.night):"";
  F.panier=v(function(x){return x.panier?"1":""});F.equipe=F.panier;F.sam=v(function(x){return x.sam?"1":""});
  F.ga40=v(function(x){return x.formJour?h2m(x.formJour):""});F.greve=v(function(x){var g=x.greveJour+x.x.greve;return g?h2m(g):""});
  ["ga10","elec","ga20","ga80","g001"].forEach(function(k){F[k]=v(function(x){return x.x[k]?h2m(x.x[k]):""})});
  var obs=[];for(var i=0;i<7;i++){var dt=dayDate(S.cur,i),fn=ferieOf(dt),x=c.days[i];
    if(fn&&i<5&&x.abs==="ferie")obs.push(DAYL[i]+" "+fmtD(dt)+" : férié ("+fn+").");
    if(x.recupP)obs.push(DAYL[i]+" "+fmtD(dt)+" : départ à "+toTime(days[i].end)+", "+hm(x.recupP)+" d'heures à récupérer posée.");
    if(x.congeP)obs.push(DAYL[i]+" "+fmtD(dt)+" : "+hm(x.congeP)+" de congé payé posé.");}
  String(w.obs||"").split(/\n/).forEach(function(l){if(l.trim())obs.push(l.trim())});
  F.obs=obs.slice(0,6);F.net=c.net;return F}
var FT={s:[0.9,"Petite"],m:[1.2,"Moyenne"],l:[1.5,"Grande"],xl:[2,"Très grande"]};
function ficheScale(st){return(FT[st.ficheT]||FT.l)[0]}
function ficheCanvas(w,c,st,sc){var cv=document.createElement("canvas"),F=ficheData(w,c,st);
  var W=1000,H=720,SC=sc||2;cv.width=W*SC;cv.height=H*SC;var x=cv.getContext("2d");x.scale(SC,SC);
  var Y="#FFFDB0",LINE="#555",GRAY="#D6D6CC",SERIF='"Times New Roman",Times,serif',SANS='Arial,Helvetica,sans-serif';
  x.fillStyle=Y;x.fillRect(0,0,W,H);
  function rect(a,b,w,h,fill){if(fill){x.fillStyle=fill;x.fillRect(a,b,w,h)}x.strokeStyle=LINE;x.lineWidth=1;x.strokeRect(a+.5,b+.5,w,h)}
  function txt(s,a,b,o){o=o||{};x.fillStyle=o.color||"#111";x.font=(o.it?"italic ":"")+(o.bold?"bold ":"")+(o.size||12)+"px "+(o.font||SANS);x.textAlign=o.align||"left";x.textBaseline="middle";x.fillText(s,a,b)}
  rect(38,30,924,660);x.fillStyle=GRAY;x.fillRect(39,31,923,30);txt("FICHE DE TRAVAIL & D'ABSENCES",500,47,{bold:1,size:22,font:SERIF,align:"center"});
  txt("Matricule :",48,84,{bold:1,size:17,font:SERIF});rect(160,70,200,26,"#FFFFD6");txt(F.matricule,260,84,{size:17,align:"center"});
  txt("NOM :",430,84,{bold:1,size:17,font:SERIF});rect(490,70,280,26,"#FFFFD6");txt(F.nom,630,84,{size:17,it:1,bold:1,color:"#1b2a7a",align:"center",font:SERIF});
  txt("Semaine",800,84,{bold:1,size:17,font:SERIF});rect(890,58,60,38,"#FFFFE8");txt(String(F.semaine),920,77,{size:20,bold:1,color:"#1b2a7a",align:"center"});
  var L0=48,LW=180,CW=64,X0=L0+LW,TW=90,XT=X0+7*CW,y=104;
  function row(h,label,vals,tot,o){o=o||{};var n=o.n||7;rect(L0,y,LW,h,o.fill);
    (Array.isArray(label)?label:[label]).forEach(function(l,i,a){txt(l,o.center?L0+LW/2:L0+8,y+h/2+(i-(a.length-1)/2)*14,{bold:o.bold,size:o.ls||11.5,align:o.center?"center":"left"})});
    for(var i=0;i<n;i++){rect(X0+i*CW,y,CW,h,o.fill);var v=vals&&vals[i];if(v)txt(v,X0+i*CW+CW/2,y+h/2,{size:o.vs||15,bold:o.vb,align:"center"})}
    if(!o.noTot){rect(XT,y,TW,h,o.fill);if(tot)txt(tot,XT+TW/2,y+h/2,{size:o.ts||15,bold:1,align:"center"})}y+=h}
  rect(L0,y,LW,26);["L","M","M","J","V","S","D"].forEach(function(d,i){rect(X0+i*CW,y,CW,26);txt(d,X0+i*CW+CW/2,y+13,{bold:1,size:16,align:"center"})});rect(XT,y,TW,26);txt("TOTAL",XT+TW/2,y+13,{size:15,align:"center"});y+=26;
  row(32,"HORAIRE Théorique",F.theo,"35 Heures",{bold:1,ts:12});
  rect(L0,y,LW,48);txt("HORAIRE",L0+24,y+17,{bold:1,size:11});txt("DECALE",L0+24,y+31,{bold:1,size:11});
  txt("DEBUT ➡",L0+LW-8,y+12,{bold:1,size:10.5,align:"right"});txt("FIN ➡",L0+LW-8,y+36,{bold:1,size:10.5,align:"right"});
  for(var i=0;i<7;i++){rect(X0+i*CW,y,CW,24);rect(X0+i*CW,y+24,CW,24);var a=F.debut[i],b=F.fin[i];
    if(a)txt(a,X0+i*CW+CW/2,y+12,{size:a.length>5?12:14.5,bold:a.length>5,align:"center"});else if(i>4)txt("H",X0+i*CW+CW/2,y+12,{size:9,align:"center",color:"#555"});
    if(b)txt(b,X0+i*CW+CW/2,y+36,{size:b.length>5?12:14.5,bold:b.length>5,align:"center"});else if(i>4)txt("H",X0+i*CW+CW/2,y+36,{size:9,align:"center",color:"#555"})}
  rect(XT,y,TW,24);rect(XT,y+24,TW,24);y+=48;
  row(54,["Nombre total d'heure de","TRAVAIL  (G000)    ➡"],F.trav,F.travTot?"➡  "+F.travTot:"",{bold:1,ls:12.5,vs:16,center:1,ts:19});
  row(24,"Heures suppl à récupérer",F.hsr,F.hsrTot,{vb:1});row(24,"Heures suppl à payer",F.hsp,F.hspTot,{vb:1});
  var yn=y;row(24,"HEURES DE NUIT",F.nuit,F.nuitTot,{bold:1,center:1,fill:GRAY,ls:11});x.fillStyle=GRAY;x.fillRect(XT+TW+1,yn+1,962-XT-TW-2,23);rect(XT+TW,yn,962-XT-TW,24);
  row(24,"Prime de panier  3001",F.panier,null,{n:6,noTot:1});row(24,"Prime d'équipe  3008",F.equipe,null,{n:6,noTot:1});row(24,"Indemnité de Samedi  3006",F.sam,null,{n:6,noTot:1});
  [["Formation permanente (GA 40)",F.ga40],["Grève AN",F.greve],["Informations syndicales (GA 10)",F.ga10],["Election Délégué Personnel CE",F.elec],["Heures de Réunion  (GA 20)",F.ga20],["Crédit d'heures       (GA 80)",F.ga80],["Réunion info vœux   (G001)",F.g001]].forEach(function(r){row(21,r[0],r[1],null,{n:5,noTot:1,ls:10.5,vs:13})});
  y+=14;txt("OBSERVATIONS :",L0+40,y+12,{bold:1,size:12});
  F.obs.forEach(function(l,i){txt(l,L0+170,y+12+i*18,{size:13,color:"#1b2a7a"})});
  return cv}
/* Dessiner la fiche coûte ~45 ms : l'image affichée est gardée en cache tant que son contenu (ficheData) ne change pas. */
var FICHE_MEMO={k:null,u:null};
function ficheURL(w,c,st){var k=JSON.stringify(ficheData(w,c,st));if(FICHE_MEMO.k!==k){FICHE_MEMO.k=k;FICHE_MEMO.u=ficheCanvas(w,c,st).toDataURL("image/png")}return FICHE_MEMO.u}
function ficheBlob(w,c,st){var cv=ficheCanvas(w,c,st,ficheScale(st));return new Promise(function(res){cv.toBlob(function(b){res(b)},"image/png")})}

export { ficheHtml, ficheText, copyRich, legacyCopy, sendHtml, ficheData, FT, ficheScale, ficheCanvas, FICHE_MEMO, ficheURL, ficheBlob };
