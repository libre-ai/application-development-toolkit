export const SCALE_STEPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
export type ScaleStep = (typeof SCALE_STEPS)[number];

export const COLOR_FAMILIES = [
  "neutral",
  "primary",
  "secondary",
  "red",
  "amber",
  "green",
  "blue",
] as const;
export type ColorFamily = (typeof COLOR_FAMILIES)[number];

export const SCORE_CRITERIA = [
  "singularity",
  "libreAiCoherence",
  "technicalCredibility",
  "accessibility",
  "darkReadability",
  "lightReadability",
  "documentationFit",
  "productFit",
  "publicCommunicationFit",
  "projectDifferentiation",
  "trendStability",
  "implementationMaintainability",
] as const;
export type ScoreCriterion = (typeof SCORE_CRITERIA)[number];

export const SCORE_LABELS: Readonly<Record<ScoreCriterion, string>> = {
  singularity: "Singularité",
  libreAiCoherence: "Cohérence avec Libre AI",
  technicalCredibility: "Crédibilité technique",
  accessibility: "Accessibilité",
  darkReadability: "Lisibilité en mode sombre",
  lightReadability: "Lisibilité en mode clair",
  documentationFit: "Adéquation à la documentation",
  productFit: "Adéquation à une interface produit",
  publicCommunicationFit: "Adéquation à la communication publique",
  projectDifferentiation: "Capacité à différencier plusieurs projets",
  trendStability: "Stabilité face aux tendances graphiques",
  implementationMaintainability: "Facilité d’implémentation et de maintenance",
};

export interface FamilySeed {
  hue: number;
  maximumChroma: number;
  label: string;
}

export interface PaletteDefinition {
  slug: string;
  name: string;
  intention: string;
  description: string;
  advantages: readonly string[];
  risks: readonly string[];
  culturalAssociations: readonly string[];
  forbiddenAssociations: readonly string[];
  families: Readonly<Record<ColorFamily, FamilySeed>>;
  scores: Readonly<Record<ScoreCriterion, number>>;
}

const statusFamilies = {
  red: { hue: 27, maximumChroma: 0.17, label: "Rouge terre" },
  amber: { hue: 82, maximumChroma: 0.15, label: "Ambre signal" },
  green: { hue: 148, maximumChroma: 0.14, label: "Vert validation" },
  blue: { hue: 245, maximumChroma: 0.15, label: "Bleu information" },
} as const;

export const PALETTES: readonly PaletteDefinition[] = [
  {
    slug: "libre-tech",
    name: "Libre Tech",
    intention:
      "Une ingénierie ouverte, calme et précise, rendue habitable par un iris minéral et un jade discret.",
    description:
      "Le graphite légèrement chaud porte la documentation et les outils. L’iris désaturé structure l’action sans reprendre le violet électrique des produits IA ; le jade signale l’ouverture et les communs sans basculer dans le vert hacker.",
    advantages: [
      "Équilibre entre crédibilité technique, personnalité et lisibilité éditoriale.",
      "Neutralité chaude adaptée aux longues lectures et aux diagrammes complexes.",
      "Iris et jade suffisamment distincts pour différencier marque, produit et statut.",
    ],
    risks: [
      "Un iris trop chromatique redeviendrait immédiatement un code de startup IA.",
      "Le jade doit rester secondaire pour ne pas rappeler les interfaces terminales vertes sur noir.",
    ],
    culturalAssociations: [
      "Édition technique européenne",
      "Atelier scientifique",
      "Objets industriels précis mais réparables",
    ],
    forbiddenAssociations: [
      "Dégradé iris-cyan",
      "Iris lumineux sur noir absolu",
      "Jade fluorescent ou utilisé pour tout état positif",
    ],
    families: {
      neutral: { hue: 68, maximumChroma: 0.014, label: "Graphite chaud" },
      primary: { hue: 292, maximumChroma: 0.095, label: "Iris minéral" },
      secondary: { hue: 164, maximumChroma: 0.105, label: "Jade calme" },
      ...statusFamilies,
    },
    scores: {
      singularity: 9,
      libreAiCoherence: 9,
      technicalCredibility: 9,
      accessibility: 9,
      darkReadability: 9,
      lightReadability: 9,
      documentationFit: 10,
      productFit: 9,
      publicCommunicationFit: 8,
      projectDifferentiation: 9,
      trendStability: 9,
      implementationMaintainability: 9,
    },
  },
  {
    slug: "commun-vivant",
    name: "Commun vivant",
    intention:
      "Une infrastructure publique et humaine où l’encre, le violet civique, le jade et un corail rare rendent la contribution visible.",
    description:
      "Cette direction rapproche les outils de leurs communautés. Les surfaces restent sobres, mais la couleur accompagne davantage les appels à contribuer, les corrections et les récits publics.",
    advantages: [
      "Chaleur et capacité narrative supérieures pour la communication publique.",
      "Bon potentiel de distinction entre projets communautaires et outils d’ingénierie.",
      "Le corail rare apporte une présence humaine sans devenir une couleur d’action principale.",
    ],
    risks: [
      "Le violet est culturellement proche des codes IA et doit rester mat, jamais en dégradé.",
      "Le corail peut entrer en collision avec le danger s’il est utilisé sans libellé ni forme.",
      "La palette demande davantage de discipline pour ne pas devenir décorative.",
    ],
    culturalAssociations: [
      "Maison des communs",
      "Édition civique",
      "Culture contributive et coopérative",
    ],
    forbiddenAssociations: [
      "Dégradé violet-bleu",
      "Corail utilisé pour une erreur ou une suppression",
      "Accumulation simultanée du violet, du jade et du corail dans un composant",
    ],
    families: {
      neutral: { hue: 268, maximumChroma: 0.016, label: "Encre ardoisée" },
      primary: { hue: 307, maximumChroma: 0.115, label: "Violet civique" },
      secondary: { hue: 161, maximumChroma: 0.115, label: "Jade commun" },
      red: { hue: 29, maximumChroma: 0.17, label: "Corail d’alerte" },
      amber: { hue: 78, maximumChroma: 0.15, label: "Ambre attention" },
      green: { hue: 148, maximumChroma: 0.14, label: "Vert validation" },
      blue: { hue: 238, maximumChroma: 0.145, label: "Bleu information" },
    },
    scores: {
      singularity: 9,
      libreAiCoherence: 9,
      technicalCredibility: 8,
      accessibility: 8,
      darkReadability: 8,
      lightReadability: 9,
      documentationFit: 8,
      productFit: 8,
      publicCommunicationFit: 10,
      projectDifferentiation: 10,
      trendStability: 8,
      implementationMaintainability: 7,
    },
  },
  {
    slug: "infrastructure-europeenne",
    name: "Infrastructure européenne",
    intention:
      "Une infrastructure minérale, fiable et lisible, activée par un cobalt mesuré et un turquoise technique.",
    description:
      "La palette assume une posture de fondation et de confiance sans reprendre le bleu institutionnel européen. Les gris minéraux organisent les surfaces ; cobalt et turquoise sont réservés aux actions, flux et preuves.",
    advantages: [
      "Très forte crédibilité pour l’ingénierie, l’exploitation et la sécurité.",
      "Excellente lisibilité des interfaces denses, diagrammes et journaux.",
      "Progression perceptuelle simple à maintenir entre thèmes.",
    ],
    risks: [
      "Peut sembler distante ou institutionnelle dans la communication publique.",
      "Le couple cobalt-turquoise est fréquent dans les logiciels B2B et cloud.",
      "Une saturation excessive ferait dériver la direction vers le SaaS bleu classique.",
    ],
    culturalAssociations: [
      "Infrastructure ferroviaire et énergétique",
      "Normalisation technique",
      "Service public numérique européen",
    ],
    forbiddenAssociations: [
      "Bleu drapeau associé à des étoiles",
      "Dégradé cobalt-turquoise",
      "Turquoise lumineux sur fond noir",
    ],
    families: {
      neutral: { hue: 235, maximumChroma: 0.013, label: "Gris minéral" },
      primary: { hue: 258, maximumChroma: 0.135, label: "Cobalt structure" },
      secondary: { hue: 191, maximumChroma: 0.105, label: "Turquoise flux" },
      red: { hue: 26, maximumChroma: 0.165, label: "Rouge incident" },
      amber: { hue: 80, maximumChroma: 0.145, label: "Ambre vigilance" },
      green: { hue: 151, maximumChroma: 0.13, label: "Vert opérationnel" },
      blue: { hue: 238, maximumChroma: 0.15, label: "Bleu information" },
    },
    scores: {
      singularity: 7,
      libreAiCoherence: 8,
      technicalCredibility: 10,
      accessibility: 9,
      darkReadability: 10,
      lightReadability: 9,
      documentationFit: 9,
      productFit: 9,
      publicCommunicationFit: 7,
      projectDifferentiation: 8,
      trendStability: 9,
      implementationMaintainability: 10,
    },
  },
  {
    slug: "atelier-libre",
    name: "Atelier libre",
    intention:
      "Un atelier logiciel constructif où le carbone végétal, le jade et l’ambre rendent les assemblages et les prises visibles.",
    description:
      "Cette direction privilégie l’action, la réparation et l’assemblage. Le jade n’est pas fluorescent et l’ambre évoque l’outil, le matériau et le chantier plutôt que la magie.",
    advantages: [
      "Lien direct avec le logiciel libre, la fabrication et la capacité d’agir.",
      "Identité mémorable sans recourir au violet ou au bleu SaaS.",
      "Très adaptée aux interfaces de build, d’agents, de preuves et de maintenance.",
    ],
    risks: [
      "Le fond carbone vert peut rappeler le hacker si le contraste ou la saturation dérivent.",
      "L’ambre est déjà nécessaire au rôle warning et ne peut pas porter seul la marque.",
      "Moins naturelle pour les contenus civiques ou éditoriaux très grand public.",
    ],
    culturalAssociations: [
      "Atelier de fabrication",
      "Établi logiciel",
      "Mouvement du logiciel libre et culture maker européenne",
    ],
    forbiddenAssociations: [
      "Vert pur sur noir pur",
      "Ambre utilisé sans distinction avec warning",
      "Textures de terminal rétro ou esthétique Matrix",
    ],
    families: {
      neutral: { hue: 157, maximumChroma: 0.018, label: "Carbone végétal" },
      primary: { hue: 158, maximumChroma: 0.12, label: "Jade outil" },
      secondary: { hue: 82, maximumChroma: 0.14, label: "Ambre atelier" },
      red: { hue: 25, maximumChroma: 0.17, label: "Rouge arrêt" },
      amber: { hue: 73, maximumChroma: 0.15, label: "Ambre vigilance" },
      green: { hue: 145, maximumChroma: 0.135, label: "Vert validation" },
      blue: { hue: 235, maximumChroma: 0.135, label: "Bleu information" },
    },
    scores: {
      singularity: 10,
      libreAiCoherence: 10,
      technicalCredibility: 9,
      accessibility: 8,
      darkReadability: 8,
      lightReadability: 9,
      documentationFit: 8,
      productFit: 10,
      publicCommunicationFit: 8,
      projectDifferentiation: 9,
      trendStability: 9,
      implementationMaintainability: 8,
    },
  },
] as const;

export const CONVERGENCE: PaletteDefinition = {
  slug: "convergence",
  name: "Envol constructif",
  intention: "Le calme éditorial de Libre Tech rencontre la capacité d’action d’Atelier libre.",
  description:
    "Un graphite chaud accueille les contenus longs ; un jade minéral porte l’action et la continuité de marque ; un iris ardoise différencie produits, preuves et contributions sans devenir un dégradé IA.",
  advantages: [
    "Continuité par le jade sans conserver le vert de framework historique.",
    "Système crédible pour la documentation comme pour les interfaces d’exploitation.",
    "Secondaire iris assez rare pour différencier le portefeuille sans fragmenter la marque.",
  ],
  risks: [
    "L’équilibre jade/iris doit être testé sur la communication publique réelle.",
    "Le jade ne doit jamais devenir fluorescent en thème sombre.",
    "L’iris doit rester secondaire et ne jamais être associé à un dégradé cyan.",
  ],
  culturalAssociations: [
    "Atelier technique ouvert",
    "Édition européenne contemporaine",
    "Infrastructure réparable et documentée",
  ],
  forbiddenAssociations: [
    "Dégradé jade-iris",
    "Vert sur noir absolu",
    "Iris utilisé comme halo magique ou effet IA",
  ],
  families: {
    neutral: { hue: 70, maximumChroma: 0.015, label: "Graphite chaud" },
    primary: { hue: 160, maximumChroma: 0.112, label: "Jade minéral" },
    secondary: { hue: 292, maximumChroma: 0.09, label: "Iris ardoise" },
    red: { hue: 26, maximumChroma: 0.17, label: "Rouge arrêt" },
    amber: { hue: 78, maximumChroma: 0.15, label: "Ambre vigilance" },
    green: { hue: 145, maximumChroma: 0.135, label: "Vert validation" },
    blue: { hue: 240, maximumChroma: 0.14, label: "Bleu information" },
  },
  scores: {
    singularity: 10,
    libreAiCoherence: 10,
    technicalCredibility: 9,
    accessibility: 9,
    darkReadability: 9,
    lightReadability: 9,
    documentationFit: 10,
    productFit: 10,
    publicCommunicationFit: 9,
    projectDifferentiation: 10,
    trendStability: 9,
    implementationMaintainability: 9,
  },
};
