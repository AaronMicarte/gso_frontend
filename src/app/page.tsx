import Image from 'next/image';
import { LoginForm } from '@/components/auth/LoginForm';

export default function Home() {
  return (
    <div className="min-h-screen flex bg-white">
      {/* Left side - Empty white space */}
      <div className="hidden lg:flex lg:flex-1"></div>

      {/* Right side - Login Container */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 min-h-screen">
        <div className="w-full max-w-md bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <div className="relative w-[240px] h-[85px]">
              <Image
                src="/assets/images/city of el salvador logo.png"
                alt="City of El Salvador Logo"
                fill
                sizes="240px"
                className="object-contain"
                loading="eager"
              />
            </div>
          </div>

          {/* Header */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white mb-2">
              Login
            </h2>
            <p className="text-slate-300 text-sm">
              Enter your credentials to access the IAMS
            </p>
          </div>

          {/* Login Form */}
          <LoginForm />

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-slate-700">
            <p className="text-xs text-center text-slate-400">
              This system is for authorized government personnel only.
              <br />
              Unauthorized access is prohibited and may result in legal action.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
