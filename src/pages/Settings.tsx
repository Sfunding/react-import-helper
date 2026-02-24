import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserPlus, Trash2, KeyRound, Users } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface UserProfile {
  id: string;
  username: string;
  full_name: string | null;
  created_at: string;
  roles: string[];
}

export default function SettingsPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);

  // Create user form
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Reset password
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: { action: 'list' }
      });
      if (error) throw error;
      setUsers(data.users || []);
    } catch (err: any) {
      toast({ title: 'Error', description: 'Failed to load users', variant: 'destructive' });
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword.trim()) return;
    if (newPassword.length < 6) {
      toast({ title: 'Error', description: 'Password must be at least 6 characters', variant: 'destructive' });
      return;
    }

    setIsCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: { action: 'create', username: newUsername, password: newPassword, fullName: newFullName || newUsername }
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      toast({ title: 'User created', description: `${newUsername} has been added.` });
      setNewUsername('');
      setNewPassword('');
      setNewFullName('');
      fetchUsers();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to create user', variant: 'destructive' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetUserId || !resetPassword.trim()) return;
    if (resetPassword.length < 6) {
      toast({ title: 'Error', description: 'Password must be at least 6 characters', variant: 'destructive' });
      return;
    }

    setIsResetting(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: { action: 'reset-password', userId: resetUserId, newPassword: resetPassword }
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      toast({ title: 'Password reset', description: 'Password has been updated.' });
      setResetUserId(null);
      setResetPassword('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to reset password', variant: 'destructive' });
    } finally {
      setIsResetting(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    setIsDeletingId(userId);
    try {
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: { action: 'delete', userId }
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      toast({ title: 'User deleted', description: 'The user has been removed.' });
      fetchUsers();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to delete user', variant: 'destructive' });
    } finally {
      setIsDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="w-6 h-6" />
          User Management
        </h1>

        {/* Create User */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserPlus className="w-5 h-5" />
              Create New User
            </CardTitle>
            <CardDescription>Add a new user who can access the calculator</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateUser} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="new-username">Username</Label>
                <Input id="new-username" value={newUsername} onChange={e => setNewUsername(e.target.value)} placeholder="username" />
              </div>
              <div>
                <Label htmlFor="new-fullname">Full Name</Label>
                <Input id="new-fullname" value={newFullName} onChange={e => setNewFullName(e.target.value)} placeholder="Full Name" />
              </div>
              <div>
                <Label htmlFor="new-password">Password</Label>
                <div className="flex gap-2">
                  <Input id="new-password" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min 6 chars" />
                  <Button type="submit" disabled={isCreating} className="shrink-0">
                    {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add'}
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Users List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">All Users</CardTitle>
            <CardDescription>{users.length} user(s) registered</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingUsers ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-3">
                {users.map(user => (
                  <div key={user.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div>
                      <div className="font-medium">{user.full_name || user.username}</div>
                      <div className="text-sm text-muted-foreground">
                        @{user.username} · {user.roles.includes('admin') ? 'Admin' : 'User'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Reset Password */}
                      <AlertDialog open={resetUserId === user.id} onOpenChange={(open) => { if (!open) { setResetUserId(null); setResetPassword(''); } }}>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" onClick={() => setResetUserId(user.id)}>
                            <KeyRound className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Reset Password for @{user.username}</AlertDialogTitle>
                            <AlertDialogDescription>
                              Enter a new password for this user.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <div className="py-2">
                            <Input
                              type="password"
                              value={resetPassword}
                              onChange={e => setResetPassword(e.target.value)}
                              placeholder="New password (min 6 chars)"
                            />
                          </div>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <Button onClick={handleResetPassword} disabled={isResetting || resetPassword.length < 6}>
                              {isResetting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                              Reset Password
                            </Button>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>

                      {/* Delete (not for admins) */}
                      {!user.roles.includes('admin') && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete @{user.username}?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete this user and all their data. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteUser(user.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                {isDeletingId === user.id ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
