'use client';

import Image from 'next/image';
import { LoginForm } from '@/components/auth/LoginForm';
import { Suspense } from 'react';

function LoginContent() {
  return (
    <>
      {/* Logo */}
      <div className="flex justify-center mb-8">
        <div className="relative w-[240px] h-[85px]">
          <Image
            src="/assets/images/login/elsal white logo.png"
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
    </>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen flex relative">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/assets/images/login/elsal bg.jpg"
          alt="El Salvador Background"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-black/40"></div>
      </div>

      {/* Left side - Empty space */}
      <div className="hidden lg:flex lg:flex-1 relative z-10"></div>

      {/* Right side - Login Container */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 min-h-screen relative z-10">
        <div className="w-full max-w-md bg-slate-800/95 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-slate-700">
          <Suspense fallback={<div className="text-white text-center">Loading...</div>}>
            <LoginContent />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
