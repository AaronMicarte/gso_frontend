import Image from 'next/image';
import { LoginForm } from '@/components/auth/LoginForm';

export default function Home() {
  return (
    <div className="min-h-screen flex">
      {/* Full screen background */}
      <div className="flex-1"></div>

      {/* Right side - Logo and Login Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8 bg-white min-h-screen">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="relative w-[280px] h-[100px]">
            <Image
              src="/assets/images/city of el salvador logo.png"
              alt="City of El Salvador Logo"
              fill
              sizes="280px"
              className="object-contain"
              loading="eager"
            />
          </div>
        </div>

        {/* Login Container */}
        <div className="w-full max-w-lg bg-white p-10 rounded-xl shadow-2xl border border-gray-200">
          {/* Header */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-800 mb-2">
              Login
            </h2>
            <p className="text-gray-700 text-sm">
              Enter your credentials to access the IAMS
            </p>
          </div>

          {/* Login Form */}
          <LoginForm />

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-xs text-center text-gray-500">
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
