import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/hooks/useAuth';
import { GlassCard } from '@/components/layout/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Truck, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const signupSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').max(20, 'Username too long'),
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
  tmpId: z.string().optional(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

const resetPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

const newPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type LoginForm = z.infer<typeof loginSchema>;
type SignupForm = z.infer<typeof signupSchema>;
type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;
type NewPasswordForm = z.infer<typeof newPasswordSchema>;

type AuthView = 'login' | 'signup' | 'forgot-password' | 'reset-password';

export default function Auth() {
  const [view, setView] = useState<AuthView>('login');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { signIn, signUp, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const signupForm = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    defaultValues: { username: '', email: '', password: '', confirmPassword: '', tmpId: '' },
  });

  const resetPasswordForm = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { email: '', password: '', confirmPassword: '' },
  });

  const newPasswordForm = useForm<NewPasswordForm>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  useEffect(() => {
    if (user && !authLoading) {
      navigate('/dashboard');
    }
  }, [user, authLoading, navigate]);

  // Check for password recovery event
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setView('reset-password');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async (data: LoginForm) => {
    setLoading(true);
    const { error } = await signIn(data.email, data.password);
    
    if (error) {
      toast({
        variant: 'destructive',
        title: 'Login Failed',
        description: error.message === 'Invalid login credentials' 
          ? 'Invalid email or password. Please try again.'
          : error.message,
      });
    } else {
      toast({
        title: 'Welcome back!',
        description: 'Successfully logged in to Aura VTC Hub.',
      });
      navigate('/dashboard');
    }
    setLoading(false);
  };

  const handleSignup = async (data: SignupForm) => {
    setLoading(true);
    const { error } = await signUp(data.email, data.password, data.username, data.tmpId);
    
    if (error) {
      let message = error.message;
      if (message.includes('already registered')) {
        message = 'This email is already registered. Please log in instead.';
      }
      toast({
        variant: 'destructive',
        title: 'Signup Failed',
        description: message,
      });
    } else {
      toast({
        title: 'Account Created!',
        description: 'Your account is pending approval from HR. You\'ll be notified when approved.',
      });
      setView('login');
    }
    setLoading(false);
  };

  const handleForgotPassword = async (data: ResetPasswordForm) => {
    setLoading(true);
    
    try {
      const { data: result, error } = await supabase.functions.invoke('reset-password', {
        body: { email: data.email, password: data.password },
      });
      
      if (error) {
        toast({
          variant: 'destructive',
          title: 'Reset Failed',
          description: error.message || 'Failed to reset password',
        });
      } else if (result?.error) {
        toast({
          variant: 'destructive',
          title: 'Reset Failed',
          description: result.error,
        });
      } else {
        toast({
          title: 'Password Reset!',
          description: 'Your password has been updated. You can now sign in.',
        });
        setView('login');
        resetPasswordForm.reset();
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Reset Failed',
        description: 'An unexpected error occurred',
      });
    }
    
    setLoading(false);
  };

  const handleNewPassword = async (data: NewPasswordForm) => {
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: data.password });
    
    if (error) {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: error.message,
      });
    } else {
      toast({
        title: 'Password Updated!',
        description: 'Your password has been successfully changed.',
      });
      navigate('/dashboard');
    }
    setLoading(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo - Replace with your Aura logo */}
        <div className="text-center mb-8">
          {/* ===== AURA LOGO PLACEHOLDER ===== */}
          {/* Replace this div with your custom logo:
              <img src="./app-icon.png" alt="Aura VTC" className="w-20 h-20 mx-auto mb-4" />
          */}
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/20 mb-4 neon-pulse">
            {/* Replace Truck icon with Aura logo image */}
            <Truck className="w-10 h-10 text-primary" />
          </div>
          {/* ===== END LOGO PLACEHOLDER ===== */}
          <h1 className="text-3xl font-bold text-white tracking-wide">AURA VTC HUB</h1>
          <p className="text-muted-foreground mt-2">Fleet Management System</p>
        </div>

        <GlassCard className="p-8">
          {/* Tab switcher - only show for login/signup */}
          {(view === 'login' || view === 'signup') && (
            <div className="flex mb-8 p-1 bg-muted/30 rounded-full">
              <button
                onClick={() => setView('login')}
                className={`flex-1 py-2 px-4 rounded-full text-sm font-medium transition-all ${
                  view === 'login' ? 'bg-primary text-primary-foreground neon-glow' : 'text-muted-foreground'
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => setView('signup')}
                className={`flex-1 py-2 px-4 rounded-full text-sm font-medium transition-all ${
                  view === 'signup' ? 'bg-primary text-primary-foreground neon-glow' : 'text-muted-foreground'
                }`}
              >
                Sign Up
              </button>
            </div>
          )}

          {/* Back button for forgot/reset password */}
          {(view === 'forgot-password' || view === 'reset-password') && (
            <button
              onClick={() => setView('login')}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
            >
              <ArrowLeft size={18} />
              <span>Back to Sign In</span>
            </button>
          )}

          {view === 'login' && (
            <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="driver@aura-vtc.com"
                  className="glass-input"
                  {...loginForm.register('email')}
                />
                {loginForm.formState.errors.email && (
                  <p className="text-destructive text-sm">{loginForm.formState.errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <button
                    type="button"
                    onClick={() => setView('forgot-password')}
                    className="text-xs text-primary hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="glass-input pr-10"
                    {...loginForm.register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {loginForm.formState.errors.password && (
                  <p className="text-destructive text-sm">{loginForm.formState.errors.password.message}</p>
                )}
              </div>

              <Button 
                type="submit" 
                className="w-full rounded-full neon-glow"
                disabled={loading}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Sign In
              </Button>
            </form>
          )}

          {view === 'signup' && (
            <form onSubmit={signupForm.handleSubmit(handleSignup)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  placeholder="YourDriverName"
                  className="glass-input"
                  {...signupForm.register('username')}
                />
                {signupForm.formState.errors.username && (
                  <p className="text-destructive text-sm">{signupForm.formState.errors.username.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  placeholder="driver@aura-vtc.com"
                  className="glass-input"
                  {...signupForm.register('email')}
                />
                {signupForm.formState.errors.email && (
                  <p className="text-destructive text-sm">{signupForm.formState.errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="tmpId">TruckersMP ID (Optional)</Label>
                <Input
                  id="tmpId"
                  placeholder="Your TMP ID for avatar"
                  className="glass-input"
                  {...signupForm.register('tmpId')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-password">Password</Label>
                <div className="relative">
                  <Input
                    id="signup-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="glass-input pr-10"
                    {...signupForm.register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {signupForm.formState.errors.password && (
                  <p className="text-destructive text-sm">{signupForm.formState.errors.password.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  className="glass-input"
                  {...signupForm.register('confirmPassword')}
                />
                {signupForm.formState.errors.confirmPassword && (
                  <p className="text-destructive text-sm">{signupForm.formState.errors.confirmPassword.message}</p>
                )}
              </div>

              <Button 
                type="submit" 
                className="w-full rounded-full neon-glow"
                disabled={loading}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Create Account
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                New accounts require HR approval before access is granted.
              </p>
            </form>
          )}

          {view === 'forgot-password' && (
            <form onSubmit={resetPasswordForm.handleSubmit(handleForgotPassword)} className="space-y-6">
              <div className="text-center mb-4">
                <h2 className="text-xl font-semibold">Reset Password</h2>
                <p className="text-muted-foreground text-sm mt-1">
                  Enter your email and new password
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reset-email">Email</Label>
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="driver@aura-vtc.com"
                  className="glass-input"
                  {...resetPasswordForm.register('email')}
                />
                {resetPasswordForm.formState.errors.email && (
                  <p className="text-destructive text-sm">{resetPasswordForm.formState.errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="reset-password">New Password</Label>
                <div className="relative">
                  <Input
                    id="reset-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="glass-input pr-10"
                    {...resetPasswordForm.register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {resetPasswordForm.formState.errors.password && (
                  <p className="text-destructive text-sm">{resetPasswordForm.formState.errors.password.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="reset-confirm-password">Confirm New Password</Label>
                <Input
                  id="reset-confirm-password"
                  type="password"
                  placeholder="••••••••"
                  className="glass-input"
                  {...resetPasswordForm.register('confirmPassword')}
                />
                {resetPasswordForm.formState.errors.confirmPassword && (
                  <p className="text-destructive text-sm">{resetPasswordForm.formState.errors.confirmPassword.message}</p>
                )}
              </div>

              <Button 
                type="submit" 
                className="w-full rounded-full neon-glow"
                disabled={loading}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Reset Password
              </Button>
            </form>
          )}

          {view === 'reset-password' && (
            <form onSubmit={newPasswordForm.handleSubmit(handleNewPassword)} className="space-y-6">
              <div className="text-center mb-4">
                <h2 className="text-xl font-semibold">Set New Password</h2>
                <p className="text-muted-foreground text-sm mt-1">
                  Enter your new password below
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="glass-input pr-10"
                    {...newPasswordForm.register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {newPasswordForm.formState.errors.password && (
                  <p className="text-destructive text-sm">{newPasswordForm.formState.errors.password.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-new-password">Confirm Password</Label>
                <Input
                  id="confirm-new-password"
                  type="password"
                  placeholder="••••••••"
                  className="glass-input"
                  {...newPasswordForm.register('confirmPassword')}
                />
                {newPasswordForm.formState.errors.confirmPassword && (
                  <p className="text-destructive text-sm">{newPasswordForm.formState.errors.confirmPassword.message}</p>
                )}
              </div>

              <Button 
                type="submit" 
                className="w-full rounded-full neon-glow"
                disabled={loading}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Update Password
              </Button>
            </form>
          )}
        </GlassCard>
      </div>
    </div>
  );
}