'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { login, getDashboardRoute } from '@/lib/auth';
import { LoginError } from '@/types/auth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { TurnstileWidget } from '@/components/auth/TurnstileWidget';
import { isTurnstileEnabled } from '@/lib/turnstile';
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

interface ActivationState {
  required: boolean;
  message: string;
}

export function LoginForm() {
  const turnstileEnabled = isTurnstileEnabled();
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaRefreshKey, setCaptchaRefreshKey] = useState(0);
  const [lockout, setLockout] = useState<LockoutState | null>(null);
  const [activation, setActivation] = useState<ActivationState | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const [mfaSetupToastShown, setMfaSetupToastShown] = useState(false);

  // Show success toast if returning from MFA setup
  useEffect(() => {
    if (searchParams.get('mfa_setup') === 'complete' && !mfaSetupToastShown) {
      toast.success('MFA Setup Complete!', {
        description: 'Please login again to verify your new security setup.',
      });
      setMfaSetupToastShown(true);
      // Clean URL
      router.replace('/');
    }
  }, [searchParams, router, mfaSetupToastShown]);

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
  }, [lockout?.locked, lockout?.seconds]);

  const onSubmit = async (data: LoginFormData) => {
    if (lockout?.locked) return;

    if (turnstileEnabled && !captchaToken) {
      toast.error('Captcha Required', {
        description: 'Please complete the captcha before logging in.',
      });
      return;
    }

    setLoading(true);
    toast.dismiss(); // Clear previous toasts
    setActivation(null);

    try {
      const trustedDeviceToken = typeof window !== 'undefined'
        ? localStorage.getItem('trusted_device_token') ?? undefined
        : undefined;

      const response = await login({
        ...data,
        turnstile_token: turnstileEnabled ? (captchaToken ?? '') : '',
        device_token: trustedDeviceToken,
      });

      if (response.must_change_password) {
        const usernameToUse = response.username || data.username;
        const query = new URLSearchParams({ username: usernameToUse });
        router.push(`/change-temporary-password?${query.toString()}`);
        return;
      }

      // Check if MFA is required (either setup or verification)
      if (response.mfa_required && response.user_id) {
        // Device token was not accepted by backend; remove stale fallback token.
        if (typeof window !== 'undefined') {
          localStorage.removeItem('trusted_device_token');
        }

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
          userEmail: response.user?.Email || data.username,
        }));
        router.push('/verify-mfa');
        return;
      }

      // No MFA required - login successful
      setLockout(null);
      toast.success('Login successful!', {
        description: `Welcome back, ${response.user?.FullName || response.user?.Username || 'User'}!`
      });

      // Redirect based on user role
      const dashboardRoute = getDashboardRoute(response.user?.Role, response.user?.UserRoleID);
      router.push(dashboardRoute);
    } catch (err: unknown) {
      const error = err as LoginError;
      setValue('password', '');

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
        toast.error('Invalid credentials', {
          description: `${error.attempts_remaining} attempt${error.attempts_remaining !== 1 ? 's' : ''} remaining before lockout.`
        });
      } else if (error.activation_required) {
        setActivation({
          required: true,
          message: error.message || 'Account activation required. Please check your email.'
        });
        toast.error('Activation Required', {
          description: 'Please open the activation email to continue.'
        });
      } else if (error.account_disabled) {
        toast.error('Account Disabled', {
          description: error.message || 'Please contact your GSO Admin.'
        });
      } else if (error.turnstile_failed) {
        toast.error('Captcha Failed', {
          description: error.message || 'Captcha verification failed. Please try again.',
        });
      } else {
        toast.error('Invalid credentials', {
          description: error.message || 'Invalid credentials. Please try again.'
        });
      }
    } finally {
      setLoading(false);
      setCaptchaRefreshKey((prev) => prev + 1);
      setCaptchaToken(null);
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

      {activation?.required && (
        <div className="mb-4 p-4 bg-amber-500/20 border border-amber-500 rounded-lg">
          <p className="text-amber-200 text-sm font-medium mb-1">
            Account activation required
          </p>
          <p className="text-slate-200 text-xs leading-relaxed">
            {activation.message}
          </p>
          <p className="text-slate-300 text-xs mt-2">
            Tip: Check Spam/Junk folder. If you still can’t find it, contact your admin to resend.
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
      <TurnstileWidget
        onTokenChange={setCaptchaToken}
        theme="dark"
        refreshKey={captchaRefreshKey}
        className="pt-2"
      />
      <div className="pt-2">
        <Button type="submit" disabled={loading || lockout?.locked || (turnstileEnabled && !captchaToken)}>
          {loading ? 'Authenticating...' : 'Login'}
        </Button>
      </div>
    </form>
  );
}