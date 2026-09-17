# Système de couleurs Libre AI

**Statut : Envol constructif est adopté ; les quatre directions initiales restent des explorations non normatives.**

Ce système sépare strictement :

1. les primitives OKLCH et leurs replis sRGB ;
2. les rôles sémantiques indépendants des noms de couleur ;
3. les tokens de composants ;
4. les projections CSS, DTCG et Tailwind 4.3.

Seule la convergence Envol constructif génère les tokens de production dans `src/tokens.css`. Les quatre explorations ne sont jamais importées par les composants.

## Propositions

- [Libre Tech](./libre-tech/README.md) — Une ingénierie ouverte, calme et précise, rendue habitable par un iris minéral et un jade discret.
- [Commun vivant](./commun-vivant/README.md) — Une infrastructure publique et humaine où l’encre, le violet civique, le jade et un corail rare rendent la contribution visible.
- [Infrastructure européenne](./infrastructure-europeenne/README.md) — Une infrastructure minérale, fiable et lisible, activée par un cobalt mesuré et un turquoise technique.
- [Atelier libre](./atelier-libre/README.md) — Un atelier logiciel constructif où le carbone végétal, le jade et l’ambre rendent les assemblages et les prises visibles.

## Méthode

- OKLCH est l’espace de conception ; chaque couleur hors gamut est ramenée honnêtement par réduction de chroma, sans modifier artificiellement sa luminosité pour annoncer une conformité.
- Toutes les valeurs sont exportées en OKLCH, HEX et RGB.
- Les couleurs alpha existent pour surfaces claires et sombres mais ne portent aucun élément critique.
- Les ratios WCAG 2.2 sont calculés sur les replis sRGB opaques.
- Les modes sombre et contraste renforcé remappent les rôles, jamais les composants.
- Les tests daltonisme sont une présélection matricielle ; labels, formes, motifs et styles de ligne restent obligatoires.
- Les mécanismes étudiés reprennent les principes de systèmes reconnus, jamais leurs valeurs ni leur apparence.
- Budget visuel de revue : 85–92 % de surfaces neutres, 5–10 % de primaire, 1–4 % de secondaire ; ce n’est pas un quota CSS.
- La couleur secondaire de marque n’est jamais le bouton secondaire : celui-ci reste neutre et structurel.

## Tableau comparatif

| Critère | Libre Tech | Commun vivant | Infrastructure européenne | Atelier libre |
| --- | ---: | ---: | ---: | ---: |
| Singularité | 9 | 9 | 7 | 10 |
| Cohérence avec Libre AI | 9 | 9 | 8 | 10 |
| Crédibilité technique | 9 | 8 | 10 | 9 |
| Accessibilité | 9 | 8 | 9 | 8 |
| Lisibilité en mode sombre | 9 | 8 | 10 | 8 |
| Lisibilité en mode clair | 9 | 9 | 9 | 9 |
| Adéquation à la documentation | 10 | 8 | 9 | 8 |
| Adéquation à une interface produit | 9 | 8 | 9 | 10 |
| Adéquation à la communication publique | 8 | 10 | 7 | 8 |
| Capacité à différencier plusieurs projets | 9 | 10 | 8 | 9 |
| Stabilité face aux tendances graphiques | 9 | 8 | 9 | 9 |
| Facilité d’implémentation et de maintenance | 9 | 7 | 10 | 8 |
| **Moyenne** | **9.00** | **8.50** | **8.75** | **8.83** |

## Classement argumenté

1. **Libre Tech — 9.00/10 :** meilleur équilibre entre singularité, documentation, accessibilité et stabilité.
2. **Atelier libre — 8.83/10 :** identité la plus distinctive et la plus actionnable, avec un risque hacker à surveiller.
3. **Infrastructure européenne — 8.75/10 :** meilleure rigueur opérationnelle, mais apparence plus B2B et institutionnelle.
4. **Commun vivant — 8.50/10 :** meilleure chaleur publique et communautaire, mais complexité et proximité du violet IA.

Les notes sont une aide à la décision, pas une vérité de marque. Elles doivent être confrontées aux prototypes et aux publics.

## Éléments combinables

- **Libre Tech :** graphite chaud, discipline éditoriale et iris minéral.
- **Atelier libre :** jade outil, langage de construction et capacité d’action.
- **Infrastructure européenne :** cartographie des surfaces sombres et contraste renforcé.
- **Commun vivant :** chaleur des contenus publics et usage extrêmement rare du corail, hors statuts critiques.

Ne pas combiner les palettes en additionnant leurs couleurs. La convergence retient un rôle précis de chaque direction.

## Palette de convergence

[Envol constructif](./convergence/README.md) combine le graphite chaud de Libre Tech, le jade constructif d’Atelier libre et un iris ardoise secondaire. Le cobalt/turquoise et le corail ne deviennent pas des accents de marque : ils restent disponibles dans les familles fonctionnelles information/danger ou dans la visualisation avec redondance.

## Décisions d’adoption

1. Le **jade** porte la marque et l’action primaire ; l’**iris** reste une différenciation secondaire rare.
2. Le graphite chaud porte les surfaces claires et sombres sans noir absolu.
3. Les produits ne reçoivent aucune couleur permanente assimilable à un état.
4. Les familles corail, ambre, vert et bleu restent fonctionnelles.
5. Jade et iris ne forment jamais un dégradé.
6. La reproduction CMJN/PDF-X reste hors de la preuve numérique actuelle et exige une qualification physique séparée.

## Qualification après adoption

- Test de reconnaissance sans logo : page d’accueil, documentation et agent board mélangés à des références concurrentes.
- Test de compréhension des états avec achromatopsie simulée et sans légende couleur.
- Parcours clavier/lecteur d’écran et forced-colors sur les composants réels.
- Comparaison sur appareils LCD/OLED, luminosité basse et forte lumière ambiante.
- Revue des six aperçus avec contributeurs techniques, publics non techniques et mainteneurs.
- Test de 8 séries catégorielles sous protanopie, deutéranopie et tritanopie ; réduire à 6 catégories si les formes ne suffisent pas.
- Épreuve papier réelle avant toute promesse print.
- Test longitudinal : reconnaître la direction après retrait des effets, illustrations et motion.

## Limites de conformité

Les audits couvrent les associations de tokens listées. Ils ne constituent ni certification WCAG globale, ni validation d’un composant, ni preuve de lisibilité d’une page complète. Les aperçus doivent être remplacés par des tests multi-moteurs après adoption dans les composants.

## Tailwind CSS

Chaque proposition fournit un fichier `tailwind.css` CSS-first pour Tailwind 4.3. Il importe le thème puis expose uniquement les rôles sémantiques via `@theme inline`. Les primitives ne deviennent donc pas des utilitaires de composants. Cette syntaxe suit la documentation officielle `/tailwindlabs/tailwindcss.com`.
