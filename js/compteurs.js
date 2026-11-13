/* COMPTEURS — récup, congés (principal, 5e semaine, fractionnement, ancienneté, supplémentaires), CET. */
import { dayCalc, dayDate, keyOf, mondayOf, weekCalc, ymdStr } from "./calculs.js";

var CET_MAX=8400,CET_SRC=["recup","c5","frac","anc","csup"];
var CPT_DEF={recup:{n:"Heures à récupérer",u:"h"},cp:{n:"Congé principal (4 semaines)",u:"h"},c5:{n:"5e semaine",u:"h"},frac:{n:"Fractionnement",u:"h"},anc:{n:"Ancienneté",u:"j"},csup:{n:"Congés supplémentaires",u:"j"}};
function cpPeriod(today){var y=today.getMonth()>=5?today.getFullYear():today.getFullYear()-1;return{a:y+"-06-01",b:(y+1)+"-05-31",label:"01/06/"+y+" – 31/05/"+(y+1)}}
/* Les compteurs sont recalculés à chaque affichage : on garde les 4 derniers résultats.
   La clé couvre tout ce dont dépend le calcul (date, réglages utiles, semaines), donc le cache ne peut pas être périmé. */
var CPT_MEMO=[];
function counters(st,weeks,today){today=today||new Date();
  var key=ymdStr(today)+"|"+JSON.stringify([st.cpt,st.regles,st.horaires,st.comptes])+"|"+JSON.stringify(weeks);
  for(var i=0;i<CPT_MEMO.length;i++)if(CPT_MEMO[i].k===key)return CPT_MEMO[i].v;
  var v=countersRaw(st,weeks,today);CPT_MEMO.unshift({k:key,v:v});if(CPT_MEMO.length>4)CPT_MEMO.pop();return v}
function countersRaw(st,weeks,today){var td=ymdStr(today),C=st.cpt||{},out={},per=cpPeriod(today),yr=today.getFullYear();
  Object.keys(CPT_DEF).forEach(function(k){var b=C[k]||{},o={k:k,n:CPT_DEF[k].n,u:CPT_DEF[k].u,acq:0,pris:0,prevu:0,gain:0};
    if(k==="recup"){o.period={a:yr+"-01-01",b:yr+"-12-31",label:"01/01 – 31/12/"+yr};
      if(+b.year===yr){o.acq=+b.acq||0;o.pris=+b.pris||0;o.ref=b.ref||(yr-1)+"-12-31";o.from=b.from||keyOf(mondayOf(new Date(yr,0,4)));o.set=true}
      else{o.ref=(yr-1)+"-12-31";o.from=keyOf(mondayOf(new Date(yr,0,4)))}}
    else{o.period=per;if(b.per===per.a){o.acq=+b.acq||0;o.pris=+b.pris||0;o.ref=b.ref||per.a;o.set=true}else{var pd=new Date(+per.a.slice(0,4),5,0);o.ref=ymdStr(pd)}}
    if(k==="frac")((b.adds)||[]).forEach(function(x){if(x.per===per.a)o.acq+=+x.min||0});
    out[k]=o});
  Object.keys(weeks).forEach(function(wk){var w=weeks[wk];if(!w)return;var days=w.days||[];
    for(var i=0;i<7;i++){var d=days[i];if(!d||!d.type)continue;var ds=ymdStr(dayDate(wk,i)),dc=dayCalc(d,i,st);
      var add=function(key,val){var o=out[key];if(!o||!val||!o.period)return;if(ds<=o.ref||ds<o.period.a||ds>o.period.b)return;if(ds<=td)o.pris+=val;else o.prevu+=val};
      if(dc.abs){var key=dc.abs==="conge"?"cp":dc.abs==="cjour"?"csup":dc.abs;if(out[key])add(key,out[key].u==="j"?(Math.round(dc.counted/420*2)/2||1):dc.counted)}
      if(dc.recupH)add("recup",dc.recupH);if(dc.congeH)add(dc.congeK,dc.congeH)}
    var r=out.recup;if(w.validated&&wk>=r.from&&dayDate(wk,3).getFullYear()===yr){var g=weekCalc(w,st).gain;r.acq+=g;r.gain+=g}});
  var ce=C.cet||{},cet={k:"cet",n:"CET court terme",solde:+ce.solde||0,ref:ce.ref||"",refT:+ce.refT||0,max:CET_MAX,moves:[]};
  (ce.moves||[]).forEach(function(m){var mt=+m.t||0,ds=m.date,src=out[m.src];
    if(mt>cet.refT&&ds<=td){cet.solde+=+m.min||0}
    if(src&&ds<=td&&ds>=src.period.a&&ds<=src.period.b&&mt>refT(C[m.src],src)){src.pris+=src.u==="j"?(+m.qty||0):(+m.min||0);src.cet=(src.cet||0)+(src.u==="j"?(+m.qty||0):(+m.min||0))}
    cet.moves.push(m)});
  cet.moves.sort(function(a,b){return(+b.t||0)-(+a.t||0)});out.cet=cet;
  Object.keys(out).forEach(function(k){var o=out[k];if(k==="cet")return;o.dispo=o.acq-o.pris;o.reste=o.acq-o.pris-o.prevu});
  return out}
function refT(b,o){if(b&&b.refT)return+b.refT;var d=(b&&b.ref)||o.ref;if(!d)return 0;var x=new Date(+d.slice(0,4),+d.slice(5,7)-1,+d.slice(8,10)+1);return x.getTime()}
function soldeCalc(st,weeks){var c=counters(st,weeks),r=c.recup,rows=[],tot=r.acq-r.gain-r.pris;
  Object.keys(weeks).sort().forEach(function(k){var w=weeks[k];if(!w||!w.validated||k<r.from||dayDate(k,3).getFullYear()!==new Date().getFullYear())return;var x=weekCalc(w,st);tot+=x.gain;rows.push({k:k,c:x,after:tot})});
  return{solde:r.dispo,reste:r.reste,rows:rows}}

export { CET_MAX, CET_SRC, CPT_DEF, cpPeriod, CPT_MEMO, counters, countersRaw, refT, soldeCalc };
