/* OUTILS — petites fonctions communes : échappement HTML, messages, formats, partage de fichier. */
import { toMin } from "./calculs.js";
import { S } from "./etat.js";

var ICON={chart:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20h16"/><rect x="5.5" y="11" width="3" height="6" rx="1"/><rect x="10.5" y="6" width="3" height="11" rx="1"/><rect x="15.5" y="13" width="3" height="4" rx="1"/></svg>',
  check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3 8-8"/><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"/></svg>',
  mail:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
  eye:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 9h16M9 9v11"/></svg>',
  pen:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 20h4l10-10-4-4L4 16z"/></svg>',
  save:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/></svg>',
  prev:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  next:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>',
  week:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
  bank:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/></svg>',
  gear:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>',
  moon:'<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>'
};
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function deepMerge(a,b){if(!b||typeof b!=="object")return a;Object.keys(b).forEach(function(k){if(b[k]&&typeof b[k]==="object"&&!Array.isArray(b[k])&&a[k]&&typeof a[k]==="object"&&!Array.isArray(a[k]))deepMerge(a[k],b[k]);else a[k]=b[k]});return a}
function toast(m){S.toast=m;renderToast();clearTimeout(toast.t);toast.t=setTimeout(function(){S.toast=null;renderToast()},2600)}
function renderToast(){var el=document.getElementById("toast");if(el)el.remove();if(!S.toast)return;el=document.createElement("div");el.id="toast";el.className="toast";el.textContent=S.toast;document.body.appendChild(el)}
function mailList(s){return String(s||"").split(/[;,\s]+/).filter(Boolean)}
function copyLine(l,v){return'<div class="field"><span class="lbl">'+l+'</span><div class="copyline"><code>'+esc(v||"(à renseigner dans Réglages)")+'</code><button class="btn small" data-act="copy" data-v="'+esc(v||"")+'">Copier</button></div></div>'}
function fmtJ(j){return String(Math.round(j*10)/10).replace(".",",")}
function parseHM(v){v=String(v||"").trim().replace("h",":");var neg=/^-/.test(v);v=v.replace(/^[-+]/,"");var m=/^\d+$/.test(v)?+v*60:toMin(v);return m==null?null:(neg?-m:m)}
function setPath(o,path,v){var p=path.split("."),t=o;for(var i=0;i<p.length-1;i++){if(t[p[i]]==null)t[p[i]]={};t=t[p[i]]}t[p[p.length-1]]=v}
function selectCode(el){var c=el.parentNode.querySelector("code");if(!c)return;var r=document.createRange();r.selectNodeContents(c);var s=getSelection();s.removeAllRanges();s.addRange(r);toast("Texte sélectionné : copie-le")}
function fmtDT(iso){try{return new Date(iso).toLocaleString("fr-FR",{dateStyle:"short",timeStyle:"short"})}catch(e){return iso}}
/* ----- Fiche dans le corps du mail ----- */
function h2m(m){if(!m&&m!==0)return"";m=Math.round(m);return String(Math.floor(m/60)).padStart(2,"0")+":"+String(m%60).padStart(2,"0")}
/* ----- Fichiers ----- */
async function shareFile(blob,name,title,text){
  try{var file=new File([blob],name,{type:blob.type});
    if(navigator.canShare&&navigator.canShare({files:[file]})){await navigator.share({files:[file],title:title||name,text:text||""});return true}
  }catch(e){if(e&&e.name==="AbortError")return false}
  var url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url)},4000);return true}

export { ICON, esc, deepMerge, toast, renderToast, mailList, copyLine, fmtJ, parseHM, setPath, selectCode, fmtDT, h2m, shareFile };
