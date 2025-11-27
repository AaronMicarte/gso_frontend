'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { login, setToken } from '@/lib/auth';
import { LoginCredentials } from '@/types/auth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import toast from 'react-hot-toast';

export function LoginForm() {
  const [credentials, setCredentials] = useState<LoginCredentials>({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await login(credentials);
      setToken(response.token);
      toast.success('Login successful! Redirecting...');
      setTimeout(() => router.push('/dashboard'), 500);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Invalid credentials. Please try again.';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCredentials({ ...credentials, [e.target.name]: e.target.value });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-1">
      <Input
        label="Username"
        type="text"
        name="username"
        value={credentials.username}
        onChange={handleChange}
        required
        placeholder="Enter your username"
      />
      <Input
        label="Password"
        type="password"
        name="password"
        value={credentials.password}
        onChange={handleChange}
        required
        placeholder="Enter your password"
      />
      <div className="pt-2">
        <Button type="submit" disabled={loading}>
          {loading ? 'Authenticating...' : ' Login'}
        </Button>
      </div>
    </form>
  );
}