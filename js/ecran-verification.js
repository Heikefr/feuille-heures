/* ÉCRAN VÉRIFICATION — résultats de la comparaison avec la compta (semaines et soldes). */
import { dayDate, fmtD } from "./calculs.js";
import { S, week } from "./etat.js";
import { esc, mailList, toast } from "./outils.js";
import { saveWeek } from "./stockage.js";
import { compareCompta, compareSoldes, parseCompta, parseSoldes } from "./compta.js";
import { render } from "./ecran-rendu.js";

function soldesCard(){var x=S.sres.res,d=x.date.split("-").reverse().join("/");
  var h='<div class="vres"><div class="vhd '+(x.bad?'ko':'ok')+'"><span>Soldes au '+d+'</span><span>'+(x.bad?'✗ '+x.bad+' écart'+(x.bad>1?'s':''):'✓ tout correspond')+'</span></div>'+
    '<table class="vtab"><tr><th>Élément</th><th>Appli</th><th>Compta</th><th></th></tr>'+x.items.map(function(y){return'<tr class="'+(y.ok?'':'bad')+'"><td>'+esc(y.l)+(y.fav||y.hint?'<br><small style="font-weight:600">'+(y.hint?esc(y.hint):y.fav>0?'en ta faveur':'en ta défaveur')+'</small>':'')+'</td><td>'+esc(y.a)+'</td><td>'+esc(y.b)+'</td><td>'+(y.ok?'✓':'✗')+'</td></tr>'}).join("")+'</table>'+
    '<div class="tiny" style="padding:6px 10px">Acquis, pris et prévu ne sont affichés qu\'en cas d\'écart.'+(x.info.length?' Absent du récapitulatif, non vérifié : '+esc(x.info.join(", "))+'.':'')+(x.late.length?' Attention : '+esc(x.late.join(", "))+' corrigé'+(x.late.length>1?'s':'')+' après le '+d+', colle un récapitulatif plus récent.':'')+'</div>';
  if(x.bad)h+='<div class="pad"><div class="tiny" style="margin-bottom:8px">Si la compta a raison, recale tes compteurs sur ses chiffres. Une sauvegarde est faite avant.</div><button class="btn small primary" data-act="srecal" style="width:100%">Recaler mes compteurs sur la compta</button></div>';
  return h+'</div>'}
function runVerif(){var ta=document.getElementById("vtxt"),txt=ta?ta.value:"",SP=parseSoldes(txt),P=SP?[]:parseCompta(txt);S.vres=[];S.sres=null;
  if(SP){S.sres={P:SP,res:compareSoldes(SP)};S.vtxt="";render();toast("Soldes vérifiés");return}
  if(!P.length){toast("Rien de reconnu : copie toute la page (Ctrl+A puis Ctrl+C)");return}
  P.forEach(function(p){var w=S.weeks[p.key];if(!w||!(w.days||[]).some(function(d){return d&&d.type})){S.vres.push({key:p.key,missing:true});return}
    w.check=compareCompta(w,S.settings,p);saveWeek(p.key);S.vres.push({key:p.key})});
  S.vtxt="";S.vopen=null;render();toast(P.length+" semaine(s) vérifiée(s)")}
function verifMsg(k){var w=S.weeks[k],bad=w.check.items.filter(function(x){return!x.ok}),p=S.settings.profil;
  return"Bonjour,\n\nEn comparant ma feuille d'heures de la semaine "+(+k.slice(6))+" (du "+fmtD(dayDate(k,0))+" au "+fmtD(dayDate(k,6))+") avec le logiciel, je trouve "+(bad.length>1?"ces écarts":"cet écart")+" :\n"+
    bad.map(function(x){return"- "+x.l+" : ma fiche "+x.a+", le logiciel "+x.b+(x.fav?(x.fav>0?" (en ma faveur)":" (en ma défaveur)"):"")}).join("\n")+"\n\nPouvez-vous vérifier ?\nMerci,\n"+(p.nom||"")}
function verifCard(k){var w=S.weeks[k],ch=w.check,open=S.vopen?S.vopen===k:(!S.vres||S.vres.length===1);
  var h='<div class="vres"><button class="vhd '+(ch.bad?'ko':'ok')+'" data-act="vopen" data-k="'+k+'" data-open="'+(open?1:0)+'"><span>S'+(+k.slice(6))+' · '+fmtD(dayDate(k,0))+' – '+fmtD(dayDate(k,6))+'</span><span>'+(ch.bad?'✗ '+ch.bad+' écart'+(ch.bad>1?'s':''):'✓ tout correspond')+'</span></button>';
  if(open){h+='<table class="vtab"><tr><th>Élément</th><th>Appli</th><th>Compta</th><th></th></tr>'+ch.items.map(function(x){return'<tr class="'+(x.ok?'':'bad')+'"><td>'+esc(x.l)+(x.fav?'<br><small style="font-weight:600">'+(x.fav>0?'en ta faveur':'en ta défaveur')+'</small>':'')+'</td><td>'+esc(x.a)+'</td><td>'+esc(x.b)+'</td><td>'+(x.ok?'✓':'✗')+'</td></tr>'}).join("")+'</table>'+
    '<div class="tiny" style="padding:6px 10px">Vérifiée le '+esc(ch.at)+(ch.info.length?' · non vérifié : '+esc(ch.info.join(", ")):'')+'</div>';
    if(ch.bad){var st=S.settings,to=mailList(st.mails.paye),subj="Écart de pointage semaine "+(+k.slice(6))+(st.profil.nom?" – "+st.profil.nom:"");
      h+='<div class="pad"><div class="vmsg">'+esc(verifMsg(k))+'</div><div class="btns"><button class="btn small primary" data-act="vcopy" data-k="'+k+'">Copier le message</button><a class="btn small" style="text-align:center;text-decoration:none" href="'+esc("ms-outlook://compose?to="+to.map(encodeURIComponent).join(";")+"&subject="+encodeURIComponent(subj)+"&body="+encodeURIComponent(verifMsg(k)))+'">Ouvrir Outlook</a></div></div>'}}
  return h+'</div>'}
function viewVerif(){var out='<div class="card pad vbox"><b style="font-size:17px">Vérifier avec la compta</b><div class="tiny">Dans le logiciel de la compta, ouvre la semaine <b>ou</b> le récapitulatif des soldes, fais <b>Ctrl+A</b> puis <b>Ctrl+C</b>, et colle ici. L\'appli reconnaît seule ce que tu as collé. Tu peux coller plusieurs semaines à la suite.</div>'+
    '<textarea id="vtxt" data-act="vtxt" placeholder="Colle ici la page de la compta…">'+esc(S.vtxt||"")+'</textarea><button class="btn primary" data-act="vrun">Vérifier</button></div>';
  if(S.sres)return out+'<div class="card" style="overflow:hidden">'+soldesCard()+'</div>';
  var keys=(S.vres||[]).map(function(r){return r.key});if(!keys.length&&week().check)keys=[S.cur];
  (S.vres||[]).filter(function(r){return r.missing}).forEach(function(r){out+='<div class="remind on"><b>S'+(+r.key.slice(6))+' : semaine vide dans l\'appli</b><span>Saisis-la d\'abord, puis vérifie à nouveau.</span></div>'});
  keys.filter(function(k){return S.weeks[k]&&S.weeks[k].check}).forEach(function(k){out+=verifCard(k)});
  return out}

export { runVerif, verifMsg, viewVerif };
