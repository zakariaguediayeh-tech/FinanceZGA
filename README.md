# Mes Finances v2 — Gestion budgétaire personnelle

PWA de gestion financière : suivi dépenses/revenus, historique mensuel complet avec
navigation entre les mois, graphes de comparaison (revenus vs dépenses sur 12 mois),
budgets par catégorie mémorisés avec alertes, objectifs d'épargne, page Paramètres
(allocation du budget, thème clair/sombre, devise, sauvegarde/restauration),
et section investissement éducative. Données stockées localement, fonctionne hors-ligne.

## Nouveautés v2

- **Navigation entre les mois** : flèches ‹ › dans l'en-tête pour consulter les
  dépenses, revenus et budgets de n'importe quel mois passé.
- **Comparaison mensuelle** : carte « Comparaison avec le mois précédent »
  (revenus, dépenses, solde, plus grandes variations par catégorie).
- **Graphe 12 mois** : revenus et dépenses côte à côte ; appuie sur un mois pour l'ouvrir.
- **Allocation du budget mémorisée** : saisie une fois (onglet Budgets ou ⚙️ Paramètres),
  conservée pour tous les mois jusqu'à modification.
- **Page ⚙️ Paramètres** : allocation du budget, thème sombre/clair, devise,
  export/import de sauvegarde (.json), export CSV, réinitialisation.
- **Modification des transactions** : appuie sur une transaction pour la modifier ou la supprimer.
- **Recherche** dans les transactions.
- **Stockage persistant** demandé au navigateur (protège les données contre l'effacement automatique).
- Corrections : lien manifest réparé (`manifestt.json` → `manifest.json`),
  service worker réécrit (les mises à jour de l'app arrivent maintenant automatiquement).

## Déploiement (GitHub Pages)

1. Uploader TOUS les fichiers de ce dossier À LA RACINE du repo (pas dans un sous-dossier)
2. **Supprimer l'ancien fichier `manifestt.json`** (remplacé par `manifest.json`)
3. Settings > Pages > Source: main / root > Save
4. URL : <https://USER.github.io/REPO/>
5. Coller l'URL dans pwabuilder.com pour générer l'APK

Les données existantes des utilisateurs sont conservées : l'app migre automatiquement
l'ancien stockage (v1) vers le nouveau format.
