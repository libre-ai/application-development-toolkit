<!-- SPDX-FileCopyrightText: 2026 Libre AI contributors -->
<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# Construire une application Libre AI

Des composants d'interface, des adaptateurs web et des outils de test partagés pour développer une application sans réécrire ces fondations.

| Paquet | Utilité |
| --- | --- |
| [`@libre-ai/ui`](packages/ui) | Composants React, états visuels et styles partagés. |
| [`@libre-ai/web-platform`](packages/web-platform) | Réponses serveur, document HTML et démarrage du client. |
| [`@libre-ai/testing`](packages/testing) | Base PostgreSQL compatible en mémoire pour les tests. |
| [Modèles d'application](packages/starter) | Exemples web à adapter à votre produit. |

## Paquets

| Paquet | Utilité |
| --- | --- |
| [`@libre-ai/ui`](packages/ui) | Composants React et styles partagés. |
| [`@libre-ai/web-platform`](packages/web-platform) | Réponses serveur, document HTML et démarrage du client. |
| [`@libre-ai/testing`](packages/testing) | Base PostgreSQL compatible en mémoire pour les tests. |
| [Modèles d'application](packages/starter) | Page web et journal avec authentification de développement. |

## Essayer localement

Placez les dépôts `project-governance`, `schemas-and-contracts`, `ai-work-supervision`, `organization-data-lifecycle` et `ai-model-policy` à côté de celui-ci. Les deux derniers fournissent les dépendances déclarées de l’espace de travail Auth. Utilisez Bun `1.4.0-canary.1` (révision `57f349f63`), puis :

```sh
bun install --cwd ../project-governance --frozen-lockfile --ignore-scripts
bun install --cwd ../schemas-and-contracts --frozen-lockfile --ignore-scripts
bun install --cwd ../ai-work-supervision --frozen-lockfile --ignore-scripts
bun install --frozen-lockfile --ignore-scripts
bun run check
bun run --cwd packages/starter/bun-app build
bun run --cwd packages/starter/bun-app start
```

Pour les parcours navigateur : `bun run check:e2e` (navigateurs Playwright installés).

Le code est en cours d'intégration ; aucun paquet n'est publié sur npm. Les modèles utilisent des services de développement : ils ne constituent pas une application prête pour des utilisateurs réels. L'utilisation publique des éléments de marque conserve son contrôle d'autorisation distinct.

[English](README.md)
