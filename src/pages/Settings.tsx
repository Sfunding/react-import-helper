import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserPlus, Trash2, KeyRound, Users, ChevronDown, ChevronUp, Shield } from 'lucide-react';
import { AuditLogViewer } from '@/components/AuditLogViewer';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

interface UserPermissions {
  can_export: boolean;
  can_delete_deals: boolean;
  can_view_others: boolean;
}

interface UserProfile {
  id: string;
  username: string;
  full_name: string | null;
  created_at: string;
  roles: string[];
  permissions: UserPermissions | null;
}

export default function SettingsPage() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

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

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: { action: 'update-role', userId, role: newRole }
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      toast({ title: 'Role updated' });
      fetchUsers();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to update role', variant: 'destructive' });
    }
  };

  const handlePermissionChange = async (userId: string, currentPerms: UserPermissions | null, key: keyof UserPermissions, value: boolean) => {
    const updated = {
      can_export: currentPerms?.can_export ?? true,
      can_delete_deals: currentPerms?.can_delete_deals ?? true,
      can_view_others: currentPerms?.can_view_others ?? false,
      [key]: value,
    };

    // Optimistic update
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, permissions: updated } : u));

    try {
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: { action: 'update-permissions', userId, permissions: updated }
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to update permissions', variant: 'destructive' });
      fetchUsers(); // Revert
    }
  };

  const getUserRole = (u: UserProfile) => {
    if (u.roles.includes('admin')) return 'admin';
    if (u.roles.includes('manager')) return 'manager';
    return 'user';
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
                {users.map(user => {
                  const isCurrentUser = user.id === currentUser?.id;
                  const role = getUserRole(user);
                  const isExpanded = expandedUserId === user.id;

                  return (
                    <div key={user.id} className="rounded-lg border bg-card">
                      <div className="flex items-center justify-between p-3">
                        <div className="flex items-center gap-3">
                          <div>
                            <div className="font-medium">{user.full_name || user.username}</div>
                            <div className="text-sm text-muted-foreground">@{user.username}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Role selector */}
                          <Select
                            value={role}
                            onValueChange={(v) => handleRoleChange(user.id, v)}
                            disabled={isCurrentUser}
                          >
                            <SelectTrigger className="w-28 h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="manager">Manager</SelectItem>
                              <SelectItem value="user">User</SelectItem>
                            </SelectContent>
                          </Select>

                          {/* Expand permissions */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpandedUserId(isExpanded ? null : user.id)}
                            title="Permissions"
                          >
                            <Shield className="w-4 h-4 mr-1" />
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </Button>

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
                                <AlertDialogDescription>Enter a new password for this user.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <div className="py-2">
                                <Input type="password" value={resetPassword} onChange={e => setResetPassword(e.target.value)} placeholder="New password (min 6 chars)" />
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

                          {/* Delete */}
                          {!isCurrentUser && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete @{user.username}?</AlertDialogTitle>
                                  <AlertDialogDescription>This will permanently delete this user and all their data.</AlertDialogDescription>
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

                      {/* Expanded permissions panel */}
                      {isExpanded && (
                        <div className="border-t px-3 py-3 bg-muted/30 space-y-3">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Permissions</p>
                          <div className="grid gap-3">
                            <div className="flex items-center justify-between">
                              <Label className="text-sm">Can Export (Excel/PDF)</Label>
                              <Switch
                                checked={user.permissions?.can_export ?? true}
                                onCheckedChange={(v) => handlePermissionChange(user.id, user.permissions, 'can_export', v)}
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <Label className="text-sm">Can Delete Deals</Label>
                              <Switch
                                checked={user.permissions?.can_delete_deals ?? true}
                                onCheckedChange={(v) => handlePermissionChange(user.id, user.permissions, 'can_delete_deals', v)}
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <Label className="text-sm">Can View Others' Deals</Label>
                              <Switch
                                checked={user.permissions?.can_view_others ?? false}
                                onCheckedChange={(v) => handlePermissionChange(user.id, user.permissions, 'can_view_others', v)}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Audit Log */}
        <AuditLogViewer />
      </div>
    </div>
  );
}
