import type { HTMLAttributes, PropsWithChildren, ReactNode } from "react";
import {
  Button as AriaButton,
  type ButtonProps as AriaButtonProps,
} from "react-aria-components/Button";

export interface ActionButtonProps extends Omit<AriaButtonProps, "className"> {
  className?: string;
  tone?: "primary" | "quiet";
}

export function ActionButton({ className = "", tone = "primary", ...props }: ActionButtonProps) {
  return <AriaButton {...props} className={`lai-button lai-button--${tone} ${className}`.trim()} />;
}

export interface SkipLinkProps {
  children?: ReactNode;
  targetId: string;
}

export function SkipLink({ children = "Aller au contenu", targetId }: SkipLinkProps) {
  return (
    <a className="lai-skip-link" href={`#${targetId}`}>
      {children}
    </a>
  );
}

export interface SurfaceProps extends PropsWithChildren<HTMLAttributes<HTMLElement>> {
  as?: "article" | "section";
}

export function Surface({ as: Element = "section", className = "", ...props }: SurfaceProps) {
  return <Element {...props} className={`lai-surface ${className}`.trim()} />;
}

export interface StatusMessageProps extends HTMLAttributes<HTMLParagraphElement> {
  politeness?: "polite" | "assertive";
}

export function StatusMessage({ politeness = "polite", ...props }: StatusMessageProps) {
  return <p {...props} aria-live={politeness} role="status" />;
}
