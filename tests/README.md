# Tests automatiques

Ces tests garantissent que la refonte vers la 1.0 ne change ni les calculs, ni la fiche envoyée, ni les écrans, sauf ce qui a été décidé.

## Le principe : comparer à la 0.10

Le dossier `reference/0.10/` contient une copie figée de l'appli 0.10. Chaque test ouvre cette copie et la version en cours dans le même navigateur, leur donne les mêmes données, à la même date (vendredi 13/11/2026 à 10h00), et exige le même résultat.

| Fichier | Ce qui est vérifié | Exigence |
| --- | --- | --- |
| `1-calculs.test.js` | Chaque semaine, compteurs à dix dates, solde de récup, bilan annuel, analyse des relevés compta et des soldes. Plus des valeurs attendues écrites à la main, règle par règle. | Égalité stricte, à la minute |
| `2-fiche.test.js` | La fiche de chaque semaine, aux quatre tailles d'envoi. | Identique pixel pour pixel |
| `3-ecrans.test.js` | Une trentaine d'écrans sur iPhone, fenêtre PC étroite et PC plein écran, thèmes clair et sombre. | Identique, à l'arrondi du navigateur près |

## Les données

- `donnees/jeu-invente.js` : semaines fictives, une par règle de calcul. Public.
- Les vraies données (historique, profil, relevés compta, récapitulatif des soldes) ne sont **jamais** dans le dépôt. Elles sont fournies aux tests par le secret GitHub `FH_DONNEES_PRIVEES`. Les tests n'écrivent alors que l'emplacement d'un écart, jamais une valeur, et n'enregistrent aucune image.

Pour fabriquer le contenu du secret à partir d'un dossier contenant les fichiers d'origine :

```
node tests/outils/donnees.js emballer <dossier> > paquet.prive.txt
```

## Lancer les tests

Sur GitHub, ils se lancent seuls à chaque envoi de code (`.github/workflows/tests.yml`).

Sur un PC avec Node.js 22 :

```
npm install
npx playwright install chromium
npm test
```

Avec les vraies données : `FH_DOSSIER_PRIVE=<dossier> npm test`.

Quand un test échoue, les images « référence » et « actuelle » sont rangées dans `tests/resultats/` (dossier non publié).

## Quand un changement d'affichage est voulu

Inscrire le scénario dans `CHANGEMENTS_VOULUS` (en tête de `3-ecrans.test.js`) avec la raison. Les calculs et la fiche n'ont pas d'équivalent : ils ne doivent jamais changer.
