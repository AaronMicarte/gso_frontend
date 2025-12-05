import { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  dark?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, dark = false, className, ...props }, ref) => {
    return (
      <div className="mb-4">
        {label && (
          <label className={`block text-sm font-medium mb-1.5 ${dark ? 'text-white' : 'text-[var(--foreground)]'}`}>
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`
            w-full px-4 py-2.5 
            bg-white border-2 rounded-lg
            text-[var(--foreground)] placeholder-[var(--muted)]
            focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)]
            transition-all duration-200
            ${error
              ? 'border-[var(--error)] focus:ring-[var(--error)] focus:border-[var(--error)]'
              : 'border-[var(--border)]'
            }
            ${className || ''}
          `}
          {...props}
        />
        {error && (
          <p className="mt-1.5 text-sm text-[var(--error)]">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';