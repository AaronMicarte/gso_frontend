interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className, ...props }: InputProps) {
  return (
    <div className="mb-6">
      {label && (
        <label className="block text-sm font-semibold text-white mb-2 uppercase tracking-wide">
          {label}
        </label>
      )}
      <input
        className={`w-full px-4 py-3 bg-gray-50 border-2 border-gray-300 text-gray-900 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400 transition-all duration-200 ${error ? 'border-red-400 focus:ring-red-400 focus:border-red-400' : ''} ${className || ''}`}
        {...props}
      />
      {error && <p className="mt-2 text-sm text-red-600 font-medium">{error}</p>}
    </div>
  );
}