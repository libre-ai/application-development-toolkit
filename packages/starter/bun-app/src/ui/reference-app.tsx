import { ActionButton, SkipLink, StatusMessage, Surface } from "@libre-ai/ui";
import { useState } from "react";

export function ReferenceApp() {
  const [checks, setChecks] = useState(0);

  return (
    <>
      <SkipLink targetId="main-content" />
      <header className="lai-header lai-page lai-cluster">
        <a href="/" aria-label="Libre AI — accueil">
          Libre AI
        </a>
        <nav aria-label="Navigation principale" className="lai-cluster">
          <a href="#foundation">Fondation</a>
          <a href="/static">Version statique</a>
          <a href="/api/health">État JSON</a>
        </nav>
      </header>
      <main id="main-content" className="lai-main lai-page lai-stack" tabIndex={-1}>
        <section className="lai-hero" aria-labelledby="page-title">
          <p className="lai-eyebrow">Template canonique</p>
          <h1 id="page-title">Bun direct, React accessible, preuves locales</h1>
          <p>
            Cette référence sert le même contenu en SSR, avec hydratation et en sortie statique,
            sans framework web ni ressource distante.
          </p>
        </section>
        <Surface id="foundation" aria-labelledby="foundation-title">
          <div className="lai-stack">
            <h2 id="foundation-title">Interaction progressive</h2>
            <p>
              Le contenu et les liens restent utilisables sans JavaScript. Une fois hydraté, le
              bouton React Aria ajoute une confirmation annoncée aux technologies d’assistance.
            </p>
            <div className="lai-enhanced-only lai-stack">
              <div>
                <ActionButton onPress={() => setChecks((value) => value + 1)}>
                  Vérifier l’interaction
                </ActionButton>
              </div>
              <StatusMessage className="lai-status" data-testid="interaction-status">
                {checks === 0
                  ? "Aucune interaction vérifiée."
                  : `${checks} ${checks === 1 ? "interaction vérifiée" : "interactions vérifiées"}.`}
              </StatusMessage>
            </div>
          </div>
        </Surface>
      </main>
      <footer className="lai-footer lai-page">
        <p className="lai-muted text-sm">Aucun cookie, traceur, CDN ou actif distant.</p>
      </footer>
    </>
  );
}
