/**
 * ANALYSE DU CODE DE L'APPLI
 * --------------------------
 * L'appli n'est pas compilée : aucune machine ne signale donc une faute de frappe dans un nom,
 * un import oublié ou une fonction devenue inutile. Cet outil lit chaque module de js/ et relève :
 *
 *   - les noms utilisés qui n'existent nulle part (l'appli planterait à cet endroit) ;
 *   - les imports inutiles, ou qui désignent un nom que le module visé n'exporte pas ;
 *   - les exports que personne n'utilise (code mort) ;
 *   - les variables d'un autre module qu'on tenterait de modifier (interdit entre modules).
 *
 * Le test 7 s'appuie dessus. En ligne de commande :
 *     node tests/outils/analyse.js               affiche le rapport
 *     node tests/outils/analyse.js --corriger    réécrit les lignes « import » de chaque module
 *                                                d'après ce que le code utilise réellement
 */
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const acorn = require("acorn");

/** Noms fournis par le navigateur (ou par la bibliothèque ExcelJS chargée à part). */
const GLOBAUX = new Set(("window document navigator localStorage sessionStorage location history console caches crypto " +
  "Math JSON Date Object Array String Number Boolean RegExp Error Promise Set Map Symbol Blob File FileReader Image URL URLSearchParams " +
  "ClipboardItem AbortController MessageChannel ExcelJS fetch setTimeout clearTimeout setInterval clearInterval requestAnimationFrame " +
  "isNaN isFinite parseFloat parseInt encodeURIComponent decodeURIComponent getSelection undefined NaN Infinity").split(" "));

/** Ajoute à `noms` tous les identifiants déclarés par un motif (x, {a, b}, [a, b], x = 1, ...reste). */
function nomsDuMotif(motif, noms) {
  if (!motif) return;
  if (motif.type === "Identifier") noms.add(motif.name);
  else if (motif.type === "ObjectPattern") motif.properties.forEach((p) => nomsDuMotif(p.type === "RestElement" ? p.argument : p.value, noms));
  else if (motif.type === "ArrayPattern") motif.elements.forEach((e) => nomsDuMotif(e, noms));
  else if (motif.type === "AssignmentPattern") nomsDuMotif(motif.left, noms);
  else if (motif.type === "RestElement") nomsDuMotif(motif.argument, noms);
}

/** Relève les déclarations (var, let, const, function) d'un corps de fonction, sans entrer dans les fonctions imbriquées. */
function declarations(noeud, noms) {
  (function voir(n) {
    if (!n || typeof n.type !== "string") return;
    if (n.type === "FunctionDeclaration") { noms.add(n.id.name); return; }
    if (n.type === "FunctionExpression" || n.type === "ArrowFunctionExpression") return;
    if (n.type === "VariableDeclaration") n.declarations.forEach((d) => nomsDuMotif(d.id, noms));
    if (n.type === "ClassDeclaration") noms.add(n.id.name);
    for (const k in n) { const v = n[k]; if (k !== "type" && v && typeof v === "object") (Array.isArray(v) ? v : [v]).forEach(voir); }
  })(noeud);
}

/**
 * Analyse un module.
 * @param {string} code  Source du module.
 * @returns {{declares:Set<string>, exports:Set<string>, imports:Map<string,string[]>, libres:Map<string,{modifie:boolean}>}}
 *   declares : noms déclarés au premier niveau ; exports : noms exportés ; imports : module → noms importés ;
 *   libres : noms utilisés sans être déclarés dans le module (donc attendus d'un import ou du navigateur).
 */
function analyserModule(code) {
  const ast = acorn.parse(code, { ecmaVersion: 2022, sourceType: "module" });
  const declares = new Set(), exports = new Set(), imports = new Map(), importes = new Set(), libres = new Map();

  for (const n of ast.body) {
    if (n.type === "ImportDeclaration") {
      const noms = n.specifiers.map((s) => s.local.name);
      imports.set(n.source.value, noms); noms.forEach((x) => importes.add(x));
    } else if (n.type === "ExportNamedDeclaration") {
      if (n.declaration) { const s = new Set(); declarations({ type: "Program", body: [n.declaration] }, s); s.forEach((x) => { declares.add(x); exports.add(x); }); }
      n.specifiers.forEach((s) => exports.add(s.local.name));
    } else declarations({ type: "Program", body: [n] }, declares);
  }

  /** Parcourt le code en tenant la pile des portées ; `cible` est vrai quand le nom est à gauche d'une affectation. */
  function visiter(n, portees, cible) {
    if (!n || typeof n.type !== "string") return;
    const suite = (enfant, c) => visiter(enfant, portees, c);
    switch (n.type) {
      case "Identifier": {
        if (portees.some((p) => p.has(n.name))) return;
        if (!libres.has(n.name)) libres.set(n.name, { modifie: false });
        if (cible) libres.get(n.name).modifie = true;
        return;
      }
      case "FunctionDeclaration": case "FunctionExpression": case "ArrowFunctionExpression": {
        const p = new Set();
        n.params.forEach((x) => nomsDuMotif(x, p));
        if (n.type === "FunctionExpression" && n.id) p.add(n.id.name);
        if (n.body.type === "BlockStatement") declarations(n.body, p);
        const dedans = [p, ...portees];
        n.params.forEach((x) => { if (x.type === "AssignmentPattern") visiter(x.right, dedans, false); });
        visiter(n.body, dedans, false);
        return;
      }
      case "ImportDeclaration": return;
      case "ExportNamedDeclaration": if (n.declaration) suite(n.declaration, false); return;
      case "MemberExpression": suite(n.object, false); if (n.computed) suite(n.property, false); return;
      case "Property": if (n.computed) suite(n.key, false); suite(n.value, cible); return;
      case "VariableDeclarator": if (n.init) suite(n.init, false); return;
      case "AssignmentExpression": suite(n.left, n.left.type === "Identifier"); suite(n.right, false); return;
      case "UpdateExpression": suite(n.argument, n.argument.type === "Identifier"); return;
      case "CatchClause": { const p = new Set(); nomsDuMotif(n.param, p); visiter(n.body, [p, ...portees], false); return; }
      case "LabeledStatement": suite(n.body, false); return;
      case "BreakStatement": case "ContinueStatement": return;
      case "TemplateLiteral": n.expressions.forEach((e) => suite(e, false)); return;
    }
    for (const k in n) { const v = n[k]; if (k !== "type" && v && typeof v === "object") (Array.isArray(v) ? v : [v]).forEach((c) => suite(c, false)); }
  }
  // Première portée : ce que le module déclare lui-même. Les noms importés restent « libres » pour pouvoir les contrôler.
  ast.body.forEach((n) => visiter(n, [declares], false));
  return { declares, exports, imports, libres, importes, ast };
}

/**
 * Analyse tous les modules d'un dossier js/.
 * @param {string} dossier  Chemin du dossier js.
 * @returns {{problemes:string[], modules:Object}} Liste des problèmes en clair (vide si tout va bien) et détail par module.
 */
function analyser(dossier) {
  const modules = {}, problemes = [];
  for (const f of fs.readdirSync(dossier).filter((x) => x.endsWith(".js")).sort()) {
    modules["./" + f] = Object.assign(analyserModule(fs.readFileSync(path.join(dossier, f), "utf8")), { fichier: f });
  }
  const utilises = new Set(); // « module:nom » importés quelque part
  for (const [cle, m] of Object.entries(modules)) {
    for (const [source, noms] of m.imports) {
      const cible = modules[source];
      if (!cible) { problemes.push(`${m.fichier} : importe ${source}, qui n'existe pas`); continue; }
      for (const nom of noms) {
        utilises.add(source + ":" + nom);
        if (!cible.exports.has(nom)) problemes.push(`${m.fichier} : importe « ${nom} » de ${source}, qui ne l'exporte pas`);
        if (!m.libres.has(nom)) problemes.push(`${m.fichier} : import inutile « ${nom} »`);
      }
    }
    for (const [nom, info] of m.libres) {
      if (m.importes.has(nom)) { if (info.modifie) problemes.push(`${m.fichier} : modifie « ${nom} », variable d'un autre module`); continue; }
      if (!GLOBAUX.has(nom)) problemes.push(`${m.fichier} : nom inconnu « ${nom} »`);
    }
    for (const nom of m.exports) if (!m.declares.has(nom)) problemes.push(`${m.fichier} : exporte « ${nom} », qui n'est pas déclaré`);
    void cle;
  }
  for (const [cle, m] of Object.entries(modules)) {
    for (const nom of m.exports) if (!utilises.has(cle + ":" + nom)) problemes.push(`${m.fichier} : « ${nom} » est exporté mais utilisé nulle part ailleurs`);
  }
  return { problemes, modules };
}

/**
 * Réécrit les lignes « import » de chaque module d'après les noms réellement utilisés,
 * et réduit chaque liste « export { … } » finale aux noms dont un autre module a besoin.
 * @param {string} dossier  Chemin du dossier js.
 * @param {string[]} ordre  Ordre souhaité des modules dans les imports (les autres suivent, par ordre alphabétique).
 */
function corrigerImports(dossier, ordre = []) {
  const { modules } = analyser(dossier);
  const proprietaire = {};
  for (const [cle, m] of Object.entries(modules)) for (const nom of m.exports) proprietaire[nom] = cle;
  const rang = (cle) => { const i = ordre.indexOf(cle); return i < 0 ? 1000 : i; };
  for (const m of Object.values(modules)) {
    const f = path.join(dossier, m.fichier);
    let code = fs.readFileSync(f, "utf8");
    const besoins = {};
    for (const nom of m.libres.keys()) {
      const p = proprietaire[nom];
      if (p && p !== "./" + m.fichier && !m.declares.has(nom)) (besoins[p] = besoins[p] || []).push(nom);
    }
    const lignes = Object.keys(besoins).sort((a, b) => rang(a) - rang(b) || a.localeCompare(b))
      .map((p) => `import { ${besoins[p].sort().join(", ")} } from "${p}";`);
    // Les imports « pour effet » (import "./x.js";) sont conservés tels quels.
    const effets = m.ast.body.filter((n) => n.type === "ImportDeclaration" && !n.specifiers.length).map((n) => code.slice(n.start, n.end));
    const anciens = m.ast.body.filter((n) => n.type === "ImportDeclaration");
    for (const n of anciens.reverse()) code = code.slice(0, n.start) + code.slice(n.end).replace(/^\n/, "");
    // Les imports se placent juste après le commentaire d'en-tête du fichier.
    const finEntete = /^\s*\/\*/.test(code) ? code.indexOf("*/") + 2 : 0;
    const bloc = [...lignes, ...effets].join("\n");
    code = code.slice(0, finEntete) + (finEntete ? "\n" : "") + (bloc ? bloc + "\n" : "") + code.slice(finEntete).replace(/^\n+/, "\n");
    // La liste « export { … } » de fin de fichier est réduite à ce que d'autres modules utilisent vraiment.
    const utilisesAilleurs = new Set();
    for (const autre of Object.values(modules)) for (const [source, noms] of autre.imports) if (source === "./" + m.fichier) noms.forEach((x) => utilisesAilleurs.add(x));
    for (const autre of Object.values(modules)) if (autre !== m) for (const nom of autre.libres.keys()) if (proprietaire[nom] === "./" + m.fichier) utilisesAilleurs.add(nom);
    code = code.replace(/\nexport \{([^}]*)\};\s*$/, (tout, liste) => {
      const garde = liste.split(",").map((x) => x.trim()).filter((x) => x && utilisesAilleurs.has(x));
      return garde.length ? "\nexport { " + garde.join(", ") + " };\n" : "\n";
    });
    fs.writeFileSync(f, code);
  }
}

module.exports = { analyser, corrigerImports };

if (require.main === module) {
  const dossier = path.resolve(__dirname, "..", "..", "js");
  if (process.argv.includes("--corriger")) {
    corrigerImports(dossier, ["./calculs.js", "./compteurs.js", "./etat.js", "./outils.js", "./stockage.js", "./synchro.js", "./sauvegardes.js", "./fiche.js", "./compta.js", "./excel.js", "./secours.js", "./mise-a-jour.js"]);
  }
  const { problemes } = analyser(dossier);
  console.log(problemes.length ? problemes.join("\n") : "Aucun problème.");
  process.exitCode = problemes.length ? 1 : 0;
}
