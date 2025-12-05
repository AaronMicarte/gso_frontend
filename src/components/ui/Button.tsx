interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  isLoading?: boolean;
  children: React.ReactNode;
}

export function Button({
  variant = 'primary',
  isLoading = false,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  const baseClasses = `
    w-full px-6 py-3 rounded-lg font-semibold text-sm
    focus:outline-none focus:ring-2 focus:ring-offset-2 
    transition-all duration-200 
    disabled:opacity-50 disabled:cursor-not-allowed
  `;

  // Using CSS variables from globals.css - change there to update everywhere!
  const variantClasses = {
    primary: 'bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] focus:ring-[var(--primary)]',
    secondary: 'bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--border)] border border-[var(--border)]',
    danger: 'bg-[var(--error)] text-white hover:opacity-90 focus:ring-[var(--error)]',
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${className || ''}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? 'Loading...' : children}
    </button>
  );
}