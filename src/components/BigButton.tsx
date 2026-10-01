import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';

type Variant = 'primary' | 'secondary';

interface BigButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function BigButton({ variant = 'primary', type = 'button', ...rest }: BigButtonProps) {
  return <button type={type} className={`btn btn-${variant}`} {...rest} />;
}

interface BigLinkProps {
  to: string;
  variant?: Variant;
  children: ReactNode;
}

export function BigLink({ to, variant = 'primary', children }: BigLinkProps) {
  return (
    <Link to={to} className={`btn btn-${variant}`}>
      {children}
    </Link>
  );
}