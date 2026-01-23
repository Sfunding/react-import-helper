import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAppAuth } from '@/hooks/useAppAuth';
import { Calculator, Loader2, Lock } from 'lucide-react';

const passwordSchema = z.object({
  password: z.string().min(1, 'Password is required')
});

export default function Login() {
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const { login } = useAppAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = passwordSchema.safeParse({ password });
    if (!validation.success) {
      setError(validation.error.errors[0].message);
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      const result = await login(password);
      
      if (result.success) {
        toast({
          title: 'Welcome!',
          description: 'Successfully logged in.'
        });
        navigate('/');
      } else {
        setError(result.error || 'Incorrect password');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Calculator className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="flex items-center justify-center gap-2">
            <Lock className="w-5 h-5" />
            Sign In
          </CardTitle>
          <CardDescription>
            Enter the password to access the calculator
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className={error ? 'border-destructive' : ''}
                autoFocus
              />
              {error && (
                <p className="text-sm text-destructive mt-1">{error}</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Signing In...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
