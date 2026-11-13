# Feuille d'heures

Application web pour déclarer ses heures de travail à la semaine : horaires matin / soir / journée, congés, récup, formation, grève, calcul des heures sup, des heures de nuit et des primes, compteurs de récupération et de congés, et fiche à coller dans le mail du service paye.

Ouvrir : https://heikefr.github.io/feuille-heures/

## Synchronisation iPhone ↔ PC

Sans synchronisation, les données restent sur l'appareil. Pour avoir les mêmes données sur l'iPhone et le PC, l'appli les range dans un Google Sheet de **ton compte Google perso**, protégé par un code d'accès. C'est le même principe que l'appli de réception HACCP.

### Étape 1 — Le Google Sheet et le script (sur le PC, une seule fois, environ 10 minutes)

1. Sur drive.google.com, crée un **Google Sheet** vide nommé **Feuille d'heures — données**.
2. Menu **Extensions > Apps Script**.
3. Efface le contenu de `Code.gs`, colle tout le fichier [`Code.gs`](Code.gs) de ce dépôt, puis enregistre (icône disquette).
4. En haut, choisis la fonction **installer**, puis **Exécuter**. Google demande des autorisations : accepte. Si tu vois « Google n'a pas validé cette appli », clique sur **Paramètres avancés > Accéder au projet**. C'est normal pour un script perso.
5. Reviens dans le Sheet : un onglet **Code d'accès** est apparu. Note le code (16 caractères).
6. Dans Apps Script : **Déployer > Nouveau déploiement**. Clique sur la roue dentée et choisis **Application Web**.
   - Exécuter en tant que : **Moi**
   - Qui a accès : **Tout le monde** (le code d'accès protège les données)
   - **Déployer**, puis copie l'**adresse de l'application Web** (elle finit par `/exec`).

### Étape 2 — Connecter l'appli

1. Sur l'appareil qui a déjà tes données (l'iPhone), ouvre l'appli : **Réglages › Synchronisation**.
2. Colle l'adresse `/exec` et le code d'accès, puis **Connecter**. Tes données partent dans le Sheet.
3. Dans la même page, l'appli affiche un **lien de connexion**. Ouvre-le sur le PC : il se connecte et récupère tout.

Ensuite, chaque modification part toute seule, et chaque appareil récupère les nouveautés à l'ouverture et toutes les minutes. Hors réseau, l'appli continue de marcher et envoie les modifications au retour du réseau.

### Bon à savoir

- Si la même semaine est modifiée sur les deux appareils, c'est la dernière modification qui gagne.
- Le code d'accès et l'adresse sont des secrets : ne les partage pas. Pour changer de code, dans Apps Script : **Paramètres du projet > Propriétés du script**, supprime `cle`, relance **installer**, puis reconnecte les appareils.
- Une sauvegarde automatique est créée dans l'appli juste avant la première connexion.

## Organisation du code (depuis la 1.0)

L'appli est servie telle quelle par GitHub Pages, sans étape de compilation.

| Fichier | Rôle |
| --- | --- |
| `index.html` | Structure de la page |
| `css/style.css` | Mise en forme (iPhone, PC, thèmes clair et sombre) |
| `js/calculs.js`, `js/compteurs.js` | Règles de calcul (heures, heures sup, nuit, primes, samedi) et compteurs |
| `js/fiche.js` | La fiche envoyée au service paye, dessinée en image |
| `js/compta.js` | Vérification avec la compta par copier-coller |
| `js/stockage.js`, `js/sauvegardes.js`, `js/secours.js` | Données de l'appareil, sauvegardes, mode secours |
| `js/synchro.js` | Échanges avec le Google Sheet |
| `js/ecran-*.js`, `js/actions.js` | Écrans et gestes |
| `js/appareil.js`, `js/accessibilite.js`, `js/mise-a-jour.js`, `js/excel.js`, `js/outils.js`, `js/etat.js` | Préférences de l'appareil, clavier et lecteur d'écran, mises à jour, exports, fonctions communes, état |
| `sw.js` | Fonctionnement hors ligne |
| `Code.gs` | Script Google Apps Script de synchronisation (à coller dans le Sheet, voir plus haut) |
| `tests/` | Tests automatiques (voir `tests/README.md`) |

Le format des données et le dialogue avec `Code.gs` sont ceux de la 0.10 : rien à reconnecter ni à redéployer.

## Publier une nouvelle version

1. Changer `BUILD` dans `sw.js` **et** dans `js/etat.js` (même valeur), et `VERSION` + `CHANGELOG` dans `js/etat.js`.
2. Si un fichier a été ajouté dans `js/` ou `css/`, l'ajouter à la liste `FICHIERS` de `sw.js`.
3. Envoyer le code sur une branche : GitHub lance les tests. Une fois verts, fusionner dans `main`.
4. GitHub relance les tests sur `main` puis met le site en ligne. Un test rouge bloque la publication.

Sur chaque appareil, la nouvelle version s'installe en arrière-plan et le bandeau « Nouvelle version prête » propose de recharger.
