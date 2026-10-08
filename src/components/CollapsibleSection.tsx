import type { ReactNode } from 'react';

interface CollapsibleSectionProps {
  title: string;
  /** Short text shown next to the title, e.g. a count. */
  hint?: string;
  defaultOpen?: boolean;
  /** "sub" is a lighter block nested inside a section. */
  level?: 'section' | 'sub';
  children: ReactNode;
}

/** Native <details>: no JS state, works offline, large tap target. */
export function CollapsibleSection({
  title,
  hint,
  defaultOpen = false,
  level = 'section',
  children,
}: CollapsibleSectionProps) {
  return (
    <details className={`collapsible collapsible-${level}`} open={defaultOpen}>
      <summary className="collapsible-summary">
        <span>{title}</span>
        {hint && <span className="collapsible-hint">{hint}</span>}
      </summary>
      <div className="collapsible-body">{children}</div>
    </details>
  );
}