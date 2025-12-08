'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { login } from '@/lib/auth';
import { LoginError } from '@/types/auth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from 'sonner';

// Zod schema for login validation
const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

interface LockoutState {
  locked: boolean;
  seconds: number;
  contact?: string;
}

export function LoginForm() {
  const [loading, setLoading] = useState(false);
  const [lockout, setLockout] = useState<LockoutState | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  // Show success toast if returning from MFA setup
  useEffect(() => {
    if (searchParams.get('mfa_setup') === 'complete') {
      toast.success('MFA Setup Complete!', {
        description: 'Please login again to verify your new security setup.',
      });
      // Clean URL
      router.replace('/');
    }
  }, [searchParams, router]);

  // Countdown timer effect
  useEffect(() => {
    if (lockout?.locked && lockout.seconds > 0) {
      timerRef.current = setInterval(() => {
        setLockout((prev) => {
          if (!prev || prev.seconds <= 1) {
            // Timer finished - clear lockout
            if (timerRef.current) clearInterval(timerRef.current);
            toast.dismiss();
            toast.success('Lockout Expired', {
              description: 'You can try logging in again.'
            });
            return null;
          }
          return { ...prev, seconds: prev.seconds - 1 };
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [lockout?.locked]);

  // Get dashboard route based on user role
  const getDashboardRoute = (role: string): string => {
    const normalizedRole = role.toLowerCase();

    switch (normalizedRole) {
      case 'admin':
        return '/admin/dashboard';
      case 'gso staff':
        return '/staff/dashboard';
      case 'property custodian':
        return '/custodian/dashboard';
      case 'department head':
        return '/department/dashboard';
      case 'end user':
        return '/user/dashboard';
      default:
        // Fallback for unknown roles - redirect to admin
        return '/admin/dashboard';
    }
  };

  const onSubmit = async (data: LoginFormData) => {
    if (lockout?.locked) return;

    setLoading(true);
    toast.dismiss(); // Clear previous toasts

    try {
      const response = await login(data);

      // Check if MFA is required (either setup or verification)
      if (response.mfa_required && response.user_id) {
        const isSetupRequired = response.mfa_setup_required === true;

        // If MFA setup required, redirect to dedicated setup page
        if (isSetupRequired) {
          sessionStorage.setItem('mfa_setup_pending', JSON.stringify({
            userId: response.user_id,
            userRole: response.user?.Role,
          }));
          router.push('/setup-mfa');
          return;
        }

        // MFA already enabled, redirect to verification page
        sessionStorage.setItem('mfa_verify_pending', JSON.stringify({
          userId: response.user_id,
          userName: response.user?.FullName || response.user?.Username || 'User',
          userRole: response.user?.Role || 'User',
        }));
        router.push('/verify-mfa');
        return;
      }

      // No MFA required - login successful
      setLockout(null);
      toast.success('Login successful!', {
        description: `Welcome back, ${response.user.FullName || response.user.Username}!`
      });

      // Redirect based on user role
      const dashboardRoute = getDashboardRoute(response.user.Role);
      router.push(dashboardRoute);
    } catch (err: unknown) {
      const error = err as LoginError;

      if (error.locked) {
        setLockout({
          locked: true,
          seconds: error.seconds_remaining || 10,
          contact: error.contact
        });
        toast.error('Account Locked', {
          description: `Too many failed attempts. Try again in ${error.seconds_remaining || 10} seconds.`
        });
      } else if (error.attempts_remaining !== undefined) {
        // Show remaining attempts
        toast.error('Invalid Credentials', {
          description: `${error.attempts_remaining} attempt${error.attempts_remaining !== 1 ? 's' : ''} remaining before lockout.`
        });
      } else {
        toast.error('Login Failed', {
          description: error.message || 'Invalid credentials. Please try again.'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-1">
      {/* Lockout Warning */}
      {lockout?.locked && (
        <div className="mb-4 p-4 bg-red-500/20 border border-red-500 rounded-lg">
          <p className="text-red-400 text-sm font-medium mb-2">
            🔒 Account temporarily locked ({lockout.seconds}s remaining)
          </p>
          <p className="text-slate-300 text-xs">
            {lockout.contact}
          </p>
        </div>
      )}

      <Input
        label="Username"
        type="text"
        placeholder="Enter your username"
        error={errors.username?.message}
        dark
        {...register('username')}
      />
      <Input
        label="Password"
        type="password"
        placeholder="Enter your password"
        error={errors.password?.message}
        dark
        {...register('password')}
      />
      <div className="pt-2">
        <Button type="submit" disabled={loading || lockout?.locked}>
          {loading ? 'Authenticating...' : 'Login'}
        </Button>
      </div>
    </form>
  );
}