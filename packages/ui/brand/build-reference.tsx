import { join } from "node:path";

import { renderToStaticMarkup } from "react-dom/server";

import { BrandLockup, BrandMark, ProductSignature } from "../src/brand";
import { EvidencePanel, OpenFrame } from "../src/evidence";
import { ActionButton, SkipLink } from "../src/primitives";

const proofs = [
  {
    claim: "Logiciels ouverts",
    mechanism: "Code et licences sont publics, versionnés et inspectables.",
    sourceHref: "https://github.com/libre-ai",
    verifiedOn: "2026-09-09",
    limitation: "La présence d'un dépôt ne prouve ni disponibilité ni parité fonctionnelle.",
  },
  {
    claim: "Souveraineté",
    mechanism: "Les choix d'hébergement, dépendances et mécanismes de réversibilité sont publiés.",
    sourceHref: "https://github.com/libre-ai/governance",
    verifiedOn: "2026-09-09",
    limitation: "Aucun déploiement non prouvé n'est présenté comme actif.",
  },
  {
    claim: "Explicabilité",
    mechanism: "Décisions, états et limites sont reliés à des sources versionnées.",
    sourceHref: "https://github.com/libre-ai/governance",
    verifiedOn: "2026-09-09",
    limitation: "La traçabilité ne rend pas toute sortie de modèle causalement explicable.",
  },
] as const;

function renderBody(): string {
  return renderToStaticMarkup(
    <>
      <SkipLink targetId="content" />
      <header className="lai-header lai-page">
        <BrandLockup product={null} />
      </header>
      <main className="lai-main lai-page lai-stack" id="content">
        <section className="lai-hero" aria-labelledby="promise">
          <p className="lai-eyebrow">Les plateformes propriétaires vous louent le produit.</p>
          <h1 id="promise">Possédez la fabrique.</h1>
          <p>
            Libre AI réunit les logiciels, la méthode et les preuves pour construire des outils d'IA
            que vous pouvez vérifier, modifier et déployer où vous le décidez.
          </p>
          <div className="lai-cluster">
            <ActionButton>Prenez les clés.</ActionButton>
            <ActionButton tone="quiet">Voir les preuves.</ActionButton>
          </div>
        </section>

        <section className="lai-stack" aria-labelledby="identity">
          <h2 id="identity">Identity</h2>
          <div className="lai-cluster">
            <BrandMark accessibleName="Libre AI" style={{ width: 96, height: 96 }} />
            <img
              alt=""
              aria-hidden="true"
              height="96"
              src="../src/assets/libre-ai-mark.svg"
              width="96"
            />
            <BrandLockup product="Memo" />
            <BrandLockup product="Forge" />
          </div>
        </section>

        <section className="lai-stack" aria-labelledby="proof">
          <h2 id="proof">Proof</h2>
          {proofs.map((proof) => (
            <EvidencePanel {...proof} key={proof.claim} />
          ))}
        </section>

        <section className="lai-stack" aria-labelledby="products">
          <h2 id="products">Products</h2>
          <ProductSignature
            maturity="usable"
            name="Libre AI Memo"
            sourceHref="https://github.com/libre-ai/memo"
            status="Actif"
            summary="Mémoire locale, inspectable et versionnée."
            verifiedOn="2026-09-09"
          />
        </section>

        <section className="lai-stack" aria-labelledby="light">
          <h2 id="light">Light</h2>
          <OpenFrame>Surface claire qualifiée par les tokens actifs.</OpenFrame>
        </section>

        <section className="lai-stack" aria-labelledby="dark">
          <h2 id="dark">Dark</h2>
          <OpenFrame>Le même contenu est vérifié avec le schéma sombre du navigateur.</OpenFrame>
        </section>

        <section className="lai-stack" aria-labelledby="forced-colors">
          <h2 id="forced-colors">Forced colors</h2>
          <OpenFrame>Les bordures conservent les couleurs système en contraste forcé.</OpenFrame>
        </section>

        <section className="lai-stack" aria-labelledby="small-size">
          <h2 id="small-size">Small size</h2>
          <div className="lai-cluster">
            {[16, 24, 48, 96].map((size) => (
              <BrandMark accessibleName={`${size} pixels`} height={size} key={size} width={size} />
            ))}
          </div>
          <p>
            Texte long de reflow : la preuve reste lisible et ne dépend jamais d'une largeur fixe,
            même lorsque le viewport est étroit ou que le zoom agrandit fortement le contenu.
          </p>
        </section>

        <section className="lai-stack" aria-labelledby="do-not-use">
          <h2 id="do-not-use">Do not use</h2>
          <p>
            Ne pas fermer ni déformer le portique. Réserver le jade au bloc de contrôle dans les
            déclinaisons colorées. Ne pas combiner jade et iris dans un dégradé.
          </p>
        </section>
      </main>
    </>,
  );
}

export function renderReferencePage(): string {
  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Libre AI — Brand reference</title>
    <link rel="stylesheet" href="../src/styles.css">
  </head>
  <body>
${renderBody()}
  </body>
</html>
`;
}

async function main(): Promise<void> {
  const destination = join(import.meta.dir, "reference.html");
  const expected = renderReferencePage();

  if (process.argv.includes("--check")) {
    const current = await Bun.file(destination).text();
    if (current !== expected) throw new Error("brand.reference_drift");
    console.log("Brand reference is current.");
    return;
  }

  await Bun.write(destination, expected);
  console.log("Generated brand/reference.html.");
}

if (import.meta.main) {
  await main();
}
