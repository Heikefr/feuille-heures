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
