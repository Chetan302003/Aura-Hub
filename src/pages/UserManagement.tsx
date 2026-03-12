import { useState, useEffect } from 'react';
import { useAuth, AppRole } from '@/hooks/useAuth';
import { useTruckersMP } from '@/hooks/useTruckersMP';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { GlassCard } from '@/components/layout/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  Users, 
  Search, 
  CheckCircle, 
  XCircle, 
  Shield,
  Clock,
  UserCheck,
  UserX,
  Loader2,
  RefreshCw,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Mail,
  Key,
  Image,
  Calendar
} from 'lucide-react';
import { format } from 'date-fns';

interface UserProfile {
  id: string;
  user_id: string;
  username: string;
  email: string;
  tmp_id: string | null;
  avatar_url: string | null;
  approval_status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  roles: AppRole[];
}

const ROLES: AppRole[] = ['developer', 'superadmin', 'founder', 'management', 'hr', 'event_team', 'media', 'driver'];

export default function UserManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editForm, setEditForm] = useState({
    username: '',
    email: '',
    password: '',
    avatar_url: '',
    tmp_id: '',
    roles: [] as AppRole[],
  });
  const [showPassword, setShowPassword] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<UserProfile | null>(null);
  
  const { user, hasRole } = useAuth();
  const { fetchPlayerAvatar, isValidTMPId } = useTruckersMP();
  const { toast } = useToast();

  const canManageRoles = hasRole('developer') || hasRole('superadmin') || hasRole('founder') || hasRole('hr');
  const canDeleteUsers = hasRole('developer') || hasRole('superadmin') || hasRole('founder') || hasRole('hr');

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      const usersWithRoles = (profiles || []).map(profile => ({
        ...profile,
        roles: (rolesData || [])
          .filter(r => r.user_id === profile.user_id)
          .map(r => r.role as AppRole),
      }));

      setUsers(usersWithRoles);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleApprove = async (userId: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ approval_status: 'approved' })
      .eq('user_id', userId);

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } else {
      toast({ title: 'User Approved', description: 'User can now access the system.' });
      
      await supabase.from('system_logs').insert({
        actor_id: user?.id,
        action_type: 'user_approved',
        target_user_id: userId,
        details: { action: 'approved' },
      });
      
      fetchUsers();
    }
  };

  const handleReject = async (userId: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ approval_status: 'rejected' })
      .eq('user_id', userId);

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } else {
      toast({ title: 'User Rejected', description: 'User access has been denied.' });
      
      await supabase.from('system_logs').insert({
        actor_id: user?.id,
        action_type: 'user_rejected',
        target_user_id: userId,
        details: { action: 'rejected' },
      });
      
      fetchUsers();
    }
  };

  const openEditDialog = (u: UserProfile) => {
    setEditingUser(u);
    setEditForm({
      username: u.username,
      email: u.email,
      password: '',
      avatar_url: u.avatar_url || '',
      tmp_id: u.tmp_id || '',
      roles: [...u.roles],
    });
    setShowPassword(false);
  };

  const handleRoleToggle = (role: AppRole) => {
    setEditForm(prev => {
      if (prev.roles.includes(role)) {
        return { ...prev, roles: prev.roles.filter(r => r !== role) };
      } else {
        return { ...prev, roles: [...prev.roles, role] };
      }
    });
  };

  const fetchTMPAvatar = async () => {
    if (!editForm.tmp_id || !isValidTMPId(editForm.tmp_id)) {
      toast({ variant: 'destructive', title: 'Invalid TMP ID', description: 'Please enter a valid TruckersMP ID' });
      return;
    }
    
    setActionLoading(true);
    const avatar = await fetchPlayerAvatar(editForm.tmp_id);
    if (avatar) {
      setEditForm(prev => ({ ...prev, avatar_url: avatar }));
      toast({ title: 'Avatar Fetched', description: 'TruckersMP avatar has been loaded.' });
    } else {
      toast({ variant: 'destructive', title: 'Failed', description: 'Could not fetch TMP avatar.' });
    }
    setActionLoading(false);
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    
    setActionLoading(true);
    try {
      const updates: any = {};
      
      // Update profile fields
      if (editForm.username !== editingUser.username) {
        updates.username = editForm.username;
      }
      if (editForm.avatar_url !== (editingUser.avatar_url || '')) {
        updates.avatar_url = editForm.avatar_url || null;
      }
      if (editForm.tmp_id !== (editingUser.tmp_id || '')) {
        updates.tmp_id = editForm.tmp_id || null;
      }
      
      // Update profile in database
      if (Object.keys(updates).length > 0) {
        await supabase.functions.invoke('manage-user', {
          body: { action: 'update_profile', userId: editingUser.user_id, data: updates },
        });
      }
      
      // Update email if changed
      if (editForm.email !== editingUser.email) {
        await supabase.functions.invoke('manage-user', {
          body: { action: 'update_email', userId: editingUser.user_id, data: { email: editForm.email } },
        });
      }
      
      // Update password if provided
      if (editForm.password) {
        await supabase.functions.invoke('manage-user', {
          body: { action: 'update_password', userId: editingUser.user_id, data: { password: editForm.password } },
        });
      }
      
      // Update roles if changed
      const rolesChanged = JSON.stringify([...editForm.roles].sort()) !== JSON.stringify([...editingUser.roles].sort());
      if (rolesChanged) {
        await supabase.functions.invoke('manage-user', {
          body: { action: 'set_roles', userId: editingUser.user_id, data: { roles: editForm.roles } },
        });
      }
      
      toast({ title: 'User Updated', description: 'User information has been saved.' });
      setEditingUser(null);
      fetchUsers();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteConfirm) return;
    
    setActionLoading(true);
    try {
      await supabase.functions.invoke('manage-user', {
        body: { action: 'delete_user', userId: deleteConfirm.user_id },
      });
      
      toast({ title: 'User Deleted', description: 'User has been removed from the system.' });
      setDeleteConfirm(null);
      fetchUsers();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setActionLoading(false);
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.username.toLowerCase().includes(search.toLowerCase()) ||
                         u.email.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' || u.approval_status === filter;
    return matchesSearch && matchesFilter;
  });

  const pendingCount = users.filter(u => u.approval_status === 'pending').length;

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold gradient-text">User Management</h1>
            <p className="text-muted-foreground mt-1">Manage driver accounts, roles, and permissions</p>
          </div>
          <div className="flex items-center gap-4">
            {pendingCount > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-warning/20 text-warning">
                <Clock size={18} />
                <span>{pendingCount} pending</span>
              </div>
            )}
            <Button onClick={fetchUsers} variant="outline" className="rounded-full gap-2">
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Filters */}
        <GlassCard>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <Input
                placeholder="Search by username or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 glass-input"
              />
            </div>
            <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
              <SelectTrigger className="w-[180px] glass-input">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </GlassCard>

        {/* Users Table */}
        <GlassCard noPadding>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users size={48} className="mx-auto mb-4 opacity-50" />
              <p>No users found matching your criteria.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/30">
                    <th className="text-left py-4 px-6 text-muted-foreground font-medium">User</th>
                    <th className="text-left py-4 px-6 text-muted-foreground font-medium">Email</th>
                    <th className="text-left py-4 px-6 text-muted-foreground font-medium">Roles</th>
                    <th className="text-left py-4 px-6 text-muted-foreground font-medium">Status</th>
                    <th className="text-left py-4 px-6 text-muted-foreground font-medium">Joined</th>
                    <th className="text-right py-4 px-6 text-muted-foreground font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          {u.avatar_url ? (
                            <img 
                              src={u.avatar_url} 
                              alt={u.username}
                              className="w-10 h-10 rounded-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                              {u.username.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="font-medium">{u.username}</p>
                            <p className="text-xs text-muted-foreground">TMP: {u.tmp_id || '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-sm">{u.email}</span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex flex-wrap gap-1">
                          {u.roles.map(role => (
                            <span key={role} className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs">
                              {role.replace('_', ' ')}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          u.approval_status === 'approved' ? 'bg-primary/20 text-primary' :
                          u.approval_status === 'pending' ? 'bg-warning/20 text-warning' :
                          'bg-destructive/20 text-destructive'
                        }`}>
                          {u.approval_status === 'approved' ? <CheckCircle size={12} /> :
                           u.approval_status === 'pending' ? <Clock size={12} /> :
                           <XCircle size={12} />}
                          {u.approval_status}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(u.created_at), 'MMM dd, yyyy HH:mm')}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center justify-end gap-2">
                          {u.approval_status === 'pending' && canManageRoles && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleApprove(u.user_id)}
                                className="text-primary hover:text-primary hover:bg-primary/20"
                              >
                                <UserCheck size={18} />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleReject(u.user_id)}
                                className="text-destructive hover:text-destructive hover:bg-destructive/20"
                              >
                                <UserX size={18} />
                              </Button>
                            </>
                          )}
                          {u.approval_status === 'rejected' && canManageRoles && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleApprove(u.user_id)}
                              className="text-primary hover:text-primary hover:bg-primary/20"
                            >
                              <UserCheck size={18} />
                            </Button>
                          )}
                          {canManageRoles && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openEditDialog(u)}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <Edit size={18} />
                            </Button>
                          )}
                          {canDeleteUsers && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDeleteConfirm(u)}
                              className="text-destructive hover:text-destructive hover:bg-destructive/20"
                            >
                              <Trash2 size={18} />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>
      </div>

      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information, credentials, and roles.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-username">Username</Label>
              <Input
                id="edit-username"
                value={editForm.username}
                onChange={(e) => setEditForm(prev => ({ ...prev, username: e.target.value }))}
                className="glass-input"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <Input
                  id="edit-email"
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                  className="pl-10 glass-input"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-password">New Password (leave empty to keep current)</Label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <Input
                  id="edit-password"
                  type={showPassword ? 'text' : 'password'}
                  value={editForm.password}
                  onChange={(e) => setEditForm(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="••••••••"
                  className="pl-10 pr-10 glass-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-tmp-id">TruckersMP ID</Label>
                <Input
                  id="edit-tmp-id"
                  value={editForm.tmp_id}
                  onChange={(e) => setEditForm(prev => ({ ...prev, tmp_id: e.target.value }))}
                  className="glass-input"
                />
              </div>
              <div className="space-y-2">
                <Label>Avatar</Label>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={fetchTMPAvatar}
                  disabled={actionLoading}
                  className="w-full"
                >
                  <Image size={16} className="mr-2" />
                  Fetch TMP Avatar
                </Button>
              </div>
            </div>
            
            {editForm.avatar_url && (
              <div className="flex items-center gap-4 p-3 rounded-xl bg-muted/30">
                <img 
                  src={editForm.avatar_url} 
                  alt="Avatar preview"
                  className="w-12 h-12 rounded-full object-cover"
                />
                <span className="text-sm text-muted-foreground truncate flex-1">{editForm.avatar_url}</span>
              </div>
            )}
            
            <div className="space-y-2">
              <Label>Roles</Label>
              <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-muted/30">
                {ROLES.map(role => (
                  <label key={role} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={editForm.roles.includes(role)}
                      onCheckedChange={() => handleRoleToggle(role)}
                    />
                    <span className="text-sm capitalize">{role.replace('_', ' ')}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={actionLoading} className="neon-glow">
              {actionLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deleteConfirm?.username}</strong>? 
              This action cannot be undone and will remove all their data.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteUser} 
              disabled={actionLoading}
            >
              {actionLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Delete User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
