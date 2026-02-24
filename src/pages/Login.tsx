import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Lock, UserPlus } from 'lucide-react';
import avionLogo from '@/assets/avion-logo.png';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const { login, needsSetup, setupAdmin, isLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Username and password are required');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      if (needsSetup) {
        const result = await setupAdmin(username, password, fullName || username);
        if (result.success) {
          toast({ title: 'Welcome!', description: 'Admin account created successfully.' });
          navigate('/');
        } else {
          setError(result.error || 'Setup failed');
        }
      } else {
        const result = await login(username, password);
        if (result.success) {
          toast({ title: 'Welcome!', description: 'Successfully signed in.' });
          navigate('/');
        } else {
          setError(result.error || 'Invalid credentials');
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-6">
            <img src={avionLogo} alt="Avion Funding" className="h-12 w-auto mx-auto" />
          </div>
          <CardTitle className="flex items-center justify-center gap-2">
            {needsSetup ? <UserPlus className="w-5 h-5 text-primary" /> : <Lock className="w-5 h-5 text-primary" />}
            {needsSetup ? 'Create Admin Account' : 'Sign In'}
          </CardTitle>
          <CardDescription>
            {needsSetup
              ? 'Set up your admin account to get started'
              : 'Enter your credentials to access the calculator'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                className={error ? 'border-destructive' : ''}
                autoFocus
                autoComplete="username"
              />
            </div>
            {needsSetup && (
              <div>
                <Label htmlFor="fullName">Full Name (optional)</Label>
                <Input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                />
              </div>
            )}
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className={error ? 'border-destructive' : ''}
                autoComplete={needsSetup ? 'new-password' : 'current-password'}
              />
              {error && <p className="text-sm text-destructive mt-1">{error}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {needsSetup ? 'Creating Account...' : 'Signing In...'}
                </>
              ) : (
                needsSetup ? 'Create Admin Account' : 'Sign In'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
