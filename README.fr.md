<!-- SPDX-FileCopyrightText: 2026 Libre AI contributors -->
<!-- SPDX-License-Identifier: CC-BY-4.0 -->

# Construire une application Libre AI

Des composants d'interface, des adaptateurs web et des outils de test partagés pour développer une application sans réécrire ces fondations.

## Paquets

| Paquet | Utilité |
| --- | --- |
| [`@libre-ai/ui`](packages/ui) | Composants React et styles partagés. |
| [`@libre-ai/web-platform`](packages/web-platform) | Réponses serveur, document HTML et démarrage du client. |
| [`@libre-ai/testing`](packages/testing) | Base PostgreSQL compatible en mémoire pour les tests. |
| [Modèles d'application](packages/starter) | Page web et journal avec authentification de développement. |

## Essayer localement

Suivez le [guide commun de composition locale](https://github.com/libre-ai/project-governance/blob/main/docs/LOCAL-COMPOSITION.md) avec la cible `application-development-toolkit` et le SHA à vérifier. Il prépare tous les voisins et construit UI avant les installations des consommateurs. Depuis la racine du toolkit ainsi préparé :

```sh
bun run --cwd packages/starter/bun-app build
bun run --cwd packages/starter/bun-app start
```

Pour les parcours navigateur : `bun run check:e2e` (navigateurs Playwright installés).

Le code est en cours d'intégration ; aucun paquet n'est publié sur npm. Les modèles utilisent des services de développement : ils ne constituent pas une application prête pour des utilisateurs réels. L'utilisation publique des éléments de marque conserve son contrôle d'autorisation distinct.

[English](README.md)
