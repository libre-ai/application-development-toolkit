import { SkipLink, StatusMessage, Surface } from "@libre-ai/ui";
import { useCallback, useEffect, useState } from "react";

interface SessionState {
  readonly authenticated: boolean;
  readonly userId?: string;
  readonly tenantId?: string;
}

interface JournalNote {
  readonly id: number;
  readonly text: string;
  readonly createdAt: string;
}

interface CsrfToken {
  readonly csrfToken: string;
}

interface SchemaResponse {
  readonly data: readonly string[];
}

interface NotesResponse {
  readonly data: readonly JournalNote[];
}

interface ValidationResponse {
  readonly ok?: boolean;
  readonly issues?: readonly unknown[];
}

interface MessageState {
  readonly type: "info" | "error" | "success";
  readonly text: string;
}

// Hydration parity: the store parameter is undefined on SSR and present on client.
// No store-dependent data is rendered, so SSR and first client render are byte-identical.
// All authenticated state is fetched post-hydration via effects.
export function JournalApp() {
  // Client-only state: fetched after hydration, not rendered during SSR
  const [session, setSession] = useState<SessionState>({ authenticated: false });
  const [notes, setNotes] = useState<readonly JournalNote[]>([]);
  const [schemas, setSchemas] = useState<readonly string[]>([]);
  const [message, setMessage] = useState<MessageState | null>(null);

  // Form state
  const [noteText, setNoteText] = useState("");
  const [schemaName, setSchemaName] = useState("");
  const [documentJson, setDocumentJson] = useState("");
  const [csrfToken, setCsrfToken] = useState<string | null>(null);

  // Post-hydration: fetch session state
  useEffect(() => {
    async function fetchSession() {
      try {
        const res = await fetch("/api/session");
        const data = (await res.json()) as SessionState;
        setSession(data);

        // If authenticated, fetch notes and schemas in parallel
        if (data.authenticated) {
          const [notesRes, schemasRes] = await Promise.all([
            fetch("/api/notes"),
            fetch("/api/schemas"),
          ]);

          if (notesRes.ok) {
            const notesData = (await notesRes.json()) as NotesResponse;
            setNotes(notesData.data);
          }

          if (schemasRes.ok) {
            const schemasData = (await schemasRes.json()) as SchemaResponse;
            setSchemas(schemasData.data);
          }

          // Fetch CSRF token for the session
          try {
            const csrfRes = await fetch("/e2e/csrf");
            if (csrfRes.ok) {
              const csrfData = (await csrfRes.json()) as CsrfToken;
              setCsrfToken(csrfData.csrfToken);
            }
          } catch {
            // CSRF endpoint may not be available in production
          }
        }
      } catch (error) {
        console.error("Failed to fetch session:", error);
        setMessage({
          type: "error",
          text: "Impossible de charger l'état de session.",
        });
      }
    }

    fetchSession();
  }, []);

  const handleAddNote = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!noteText.trim()) {
        setMessage({
          type: "error",
          text: "Veuillez entrer du texte pour la note.",
        });
        return;
      }

      try {
        // ISO 8601 UTC seconds format (YYYY-MM-DDTHH:mm:ssZ) without milliseconds
        const createdAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };

        if (csrfToken) {
          headers["X-CSRF-Token"] = csrfToken;
        }

        const res = await fetch("/api/notes", {
          method: "POST",
          headers,
          body: JSON.stringify({ text: noteText, createdAt }),
        });

        if (!res.ok) {
          const errorData = (await res.json()) as { error?: { code?: string } };
          setMessage({
            type: "error",
            text:
              errorData.error?.code === "starter.note_invalid"
                ? "La note n'est pas valide (trop longue ou vide)."
                : "Impossible d'ajouter la note.",
          });
          return;
        }

        // Refresh notes
        const notesRes = await fetch("/api/notes");
        if (notesRes.ok) {
          const notesData = (await notesRes.json()) as NotesResponse;
          setNotes(notesData.data);
        }

        setNoteText("");
        setMessage({
          type: "success",
          text: "Note ajoutée avec succès.",
        });
      } catch (error) {
        console.error("Failed to add note:", error);
        setMessage({
          type: "error",
          text: "Erreur lors de l'ajout de la note.",
        });
      }
    },
    [noteText, csrfToken],
  );

  const handleValidate = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!schemaName) {
        setMessage({
          type: "error",
          text: "Veuillez sélectionner un schéma.",
        });
        return;
      }

      try {
        let document: unknown;
        try {
          document = JSON.parse(documentJson || "{}");
        } catch {
          setMessage({
            type: "error",
            text: "Le JSON est invalide.",
          });
          return;
        }

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };

        if (csrfToken) {
          headers["X-CSRF-Token"] = csrfToken;
        }

        const res = await fetch("/api/validate", {
          method: "POST",
          headers,
          body: JSON.stringify({ schemaName, document }),
        });

        if (!res.ok) {
          const errorData = (await res.json()) as { error?: { code?: string } };
          setMessage({
            type: "error",
            text: `Erreur: ${errorData.error?.code || "Validation échouée."}`,
          });
          return;
        }

        const result = (await res.json()) as ValidationResponse;
        if (result.ok) {
          setMessage({
            type: "success",
            text: "Document valide.",
          });
        } else {
          setMessage({
            type: "error",
            text: `Document invalide: ${result.issues?.length || 0} problème(s).`,
          });
        }
      } catch (error) {
        console.error("Failed to validate:", error);
        setMessage({
          type: "error",
          text: "Erreur lors de la validation.",
        });
      }
    },
    [schemaName, documentJson, csrfToken],
  );

  const handleLogout = useCallback(async () => {
    try {
      await fetch("/v1/auth/session", { method: "DELETE" });
      // Redirect to home
      window.location.href = "/";
    } catch (error) {
      console.error("Failed to logout:", error);
      setMessage({
        type: "error",
        text: "Impossible de se déconnecter.",
      });
    }
  }, []);

  const handleLogin = useCallback(async () => {
    try {
      // Fetch the authorization URL from the login endpoint (POST required)
      const response = await fetch("/v1/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": `idem_${"e".repeat(16)}`,
          "If-Match": '"0"',
        },
        body: JSON.stringify({ returnPath: "/" }),
      });

      if (!response.ok) {
        throw new Error(`Login failed: ${response.status}`);
      }

      const data = (await response.json()) as { authorizationUrl: string };
      // Navigate to the authorization endpoint
      window.location.href = data.authorizationUrl;
    } catch (error) {
      console.error("Failed to initiate login:", error);
      setMessage({
        type: "error",
        text: "Impossible de démarrer le flux de connexion.",
      });
    }
  }, []);

  return (
    <>
      <SkipLink targetId="main-content" />
      <header className="lai-header lai-page lai-cluster">
        <a href="/" aria-label="Libre AI — Accueil">
          Libre AI
        </a>
      </header>
      <main
        id="main-content"
        data-testid="journal-root"
        className="lai-main lai-page lai-stack"
        tabIndex={-1}
      >
        <section className="lai-hero" aria-labelledby="page-title">
          <h1 id="page-title">Journal souverain</h1>
          <p>Un journal personnel souverain avec validation de contrats.</p>
          <div className="lai-notice">
            <p className="text-sm">
              <strong>Connexion de démonstration</strong> — émetteur local, jamais en production.
            </p>
          </div>
        </section>

        {!session.authenticated ? (
          <Surface className="lai-stack">
            <h2>Accès au journal</h2>
            <p>Authentifiez-vous pour accéder à votre journal personnel.</p>
            <div className="lai-enhanced-only">
              <button type="button" onClick={handleLogin}>
                Se connecter
              </button>
            </div>
          </Surface>
        ) : (
          <>
            <Surface className="lai-stack">
              <h2>Mes notes</h2>
              <div className="lai-enhanced-only lai-stack">
                <form onSubmit={handleAddNote} className="lai-stack">
                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.currentTarget.value)}
                    placeholder="Entrez votre note…"
                    className="text-sm"
                  />
                  <button type="submit">Ajouter la note</button>
                </form>

                {message && (
                  <StatusMessage
                    className="lai-status"
                    data-testid="message"
                    politeness={message.type === "error" ? "assertive" : "polite"}
                  >
                    {message.text}
                  </StatusMessage>
                )}

                {notes.length === 0 ? (
                  <p className="text-sm lai-muted">Aucune note pour l'instant.</p>
                ) : (
                  <div data-testid="note-list" className="lai-stack">
                    {notes.map((note) => (
                      <div key={note.id} className="lai-note">
                        <p>{note.text}</p>
                        <p className="text-sm lai-muted">
                          {new Date(note.createdAt).toLocaleString("fr-FR")}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Surface>

            <Surface
              as="section"
              aria-labelledby="validation-title"
              className="lai-enhanced-only lai-stack"
            >
              <h2 id="validation-title">Valider un document</h2>
              <form onSubmit={handleValidate} className="lai-stack">
                <div>
                  <label htmlFor="schema-select">Schéma:</label>
                  <select
                    id="schema-select"
                    value={schemaName}
                    onChange={(e) => setSchemaName(e.currentTarget.value)}
                  >
                    <option value="">Sélectionner un schéma…</option>
                    {schemas.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="document-json">Document JSON:</label>
                  <textarea
                    id="document-json"
                    value={documentJson}
                    onChange={(e) => setDocumentJson(e.currentTarget.value)}
                    placeholder="{}"
                    className="text-sm"
                  />
                </div>
                <button type="submit">Valider</button>
              </form>
            </Surface>

            <div className="lai-enhanced-only">
              <button type="button" onClick={handleLogout}>
                Déconnexion
              </button>
            </div>
          </>
        )}
      </main>
      <footer className="lai-footer lai-page">
        <p className="lai-muted text-sm">Aucun cookie distant, traceur ou CDN.</p>
      </footer>
    </>
  );
}
