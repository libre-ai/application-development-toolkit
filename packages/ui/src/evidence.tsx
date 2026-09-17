import type { HTMLAttributes, PropsWithChildren, ReactNode } from "react";

function requirePublicHttpsUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("brand.public_https_url_required");
  }
  if (url.protocol !== "https:" || url.username !== "" || url.password !== "") {
    throw new Error("brand.public_https_url_required");
  }
  return url.href;
}

function requireIsoDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("brand.iso_date_required");
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error("brand.iso_date_required");
  }
  return value;
}

export interface EvidenceLabelProps {
  label: "SOURCE" | "ÉTAT" | "VÉRIFIÉ LE" | "VERSION" | "LIMITE";
  value: ReactNode;
}

export function EvidenceLabel({ label, value }: EvidenceLabelProps) {
  return (
    <div className="lai-evidence__row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export interface EvidencePanelProps extends HTMLAttributes<HTMLElement> {
  claim: string;
  limitation: string | null;
  mechanism: string;
  sourceHref: string;
  verifiedOn: string;
}

export function EvidencePanel({
  claim,
  className = "",
  limitation,
  mechanism,
  sourceHref,
  verifiedOn,
  ...props
}: EvidencePanelProps) {
  const safeSourceHref = requirePublicHttpsUrl(sourceHref);
  const safeVerifiedOn = requireIsoDate(verifiedOn);

  return (
    <article {...props} className={`lai-evidence lai-open-frame ${className}`.trim()}>
      <h3>{claim}</h3>
      <p>{mechanism}</p>
      <dl>
        <EvidenceLabel
          label="SOURCE"
          value={
            <a aria-label={`Source externe pour ${claim}`} href={safeSourceHref}>
              Consulter la source
            </a>
          }
        />
        <EvidenceLabel
          label="VÉRIFIÉ LE"
          value={<time dateTime={safeVerifiedOn}>{safeVerifiedOn}</time>}
        />
        {limitation === null ? null : <EvidenceLabel label="LIMITE" value={limitation} />}
      </dl>
    </article>
  );
}

export interface ProjectStatusProps extends HTMLAttributes<HTMLDListElement> {
  maturity: string;
  status: string;
  verifiedOn: string;
}

export function ProjectStatus({
  className = "",
  maturity,
  status,
  verifiedOn,
  ...props
}: ProjectStatusProps) {
  const safeVerifiedOn = requireIsoDate(verifiedOn);
  return (
    <dl {...props} className={`lai-project-status ${className}`.trim()}>
      <EvidenceLabel label="ÉTAT" value={status} />
      <EvidenceLabel label="VERSION" value={maturity} />
      <EvidenceLabel
        label="VÉRIFIÉ LE"
        value={<time dateTime={safeVerifiedOn}>{safeVerifiedOn}</time>}
      />
    </dl>
  );
}

export interface OpenFrameProps extends PropsWithChildren<HTMLAttributes<HTMLDivElement>> {}

export function OpenFrame({ className = "", ...props }: OpenFrameProps) {
  return <div {...props} className={`lai-open-frame ${className}`.trim()} />;
}
