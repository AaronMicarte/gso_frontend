interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  children: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  const baseClasses = `
    inline-flex items-center justify-center rounded-lg font-semibold
    focus:outline-none focus:ring-2 focus:ring-offset-2 
    transition-all duration-200 
    disabled:opacity-50 disabled:cursor-not-allowed
  `;

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-6 py-3 text-sm w-full',
    lg: 'px-8 py-4 text-base w-full',
  };

  // Using CSS variables from globals.css - change there to update everywhere!
  const variantClasses = {
    primary: 'bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] focus:ring-[var(--primary)]',
    secondary: 'bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--border)] border border-[var(--border)]',
    danger: 'bg-[var(--error)] text-white hover:opacity-90 focus:ring-[var(--error)]',
    outline: 'bg-transparent border border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-gray-300',
    ghost: 'bg-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus:ring-gray-300',
    destructive: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
  };

  return (
    <button
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className || ''}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? 'Loading...' : children}
    </button>
  );
}