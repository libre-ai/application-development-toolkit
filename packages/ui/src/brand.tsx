import type { HTMLAttributes, SVGProps } from "react";

import { BRAND_MARK_PARTS, BRAND_MARK_VIEW_BOX } from "./brand-geometry";
import { ProjectStatus } from "./evidence";

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

export interface BrandMarkProps extends Omit<SVGProps<SVGSVGElement>, "aria-label"> {
  accessibleName: string | null;
}

export function BrandMark({
  accessibleName,
  className = "",
  height = "1.5em",
  width = "1.5em",
  ...props
}: BrandMarkProps) {
  const paths = BRAND_MARK_PARTS.map((path) => <path d={path} key={path} />);

  if (accessibleName === null) {
    return (
      <svg
        {...props}
        aria-hidden="true"
        className={`lai-brand-mark ${className}`.trim()}
        fill="currentColor"
        focusable="false"
        height={height}
        viewBox={BRAND_MARK_VIEW_BOX}
        width={width}
        xmlns="http://www.w3.org/2000/svg"
      >
        {paths}
      </svg>
    );
  }

  return (
    <svg
      {...props}
      aria-label={accessibleName}
      className={`lai-brand-mark ${className}`.trim()}
      fill="currentColor"
      height={height}
      role="img"
      viewBox={BRAND_MARK_VIEW_BOX}
      width={width}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{accessibleName}</title>
      {paths}
    </svg>
  );
}

export interface BrandLockupProps extends HTMLAttributes<HTMLSpanElement> {
  product: string | null;
}

export function BrandLockup({ className = "", product, ...props }: BrandLockupProps) {
  return (
    <span {...props} className={`lai-brand-lockup ${className}`.trim()}>
      <BrandMark accessibleName={null} />
      <span className="lai-brand-lockup__name">Libre AI</span>
      {product === null ? null : <span className="lai-brand-lockup__product">{product}</span>}
    </span>
  );
}

export interface ProductSignatureProps extends HTMLAttributes<HTMLElement> {
  maturity: string;
  name: string;
  sourceHref: string;
  status: string;
  summary: string;
  verifiedOn: string;
}

export function ProductSignature({
  className = "",
  maturity,
  name,
  sourceHref,
  status,
  summary,
  verifiedOn,
  ...props
}: ProductSignatureProps) {
  const safeSourceHref = requirePublicHttpsUrl(sourceHref);
  return (
    <article {...props} className={`lai-product-signature lai-open-frame ${className}`.trim()}>
      <h3>{name}</h3>
      <p>{summary}</p>
      <ProjectStatus maturity={maturity} status={status} verifiedOn={verifiedOn} />
      <a aria-label={`Source externe pour ${name}`} href={safeSourceHref}>
        Consulter la source
      </a>
    </article>
  );
}
