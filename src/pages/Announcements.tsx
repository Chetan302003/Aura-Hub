import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { GlassCard } from '@/components/layout/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
  Megaphone, 
  Plus, 
  Edit, 
  Trash2, 
  Loader2,
  AlertTriangle,
  Bell,
  Calendar
} from 'lucide-react';
import { format } from 'date-fns';

interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  created_by: string;
  created_at: string;
  expires_at: string | null;
  is_active: boolean;
}

export default function Announcements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [form, setForm] = useState({
    title: '',
    content: '',
    priority: 'normal' as 'low' | 'normal' | 'high' | 'urgent',
  });
  const [actionLoading, setActionLoading] = useState(false);
  
  const { user, hasRole } = useAuth();
  const { toast } = useToast();

  const canManage = hasRole('developer') || hasRole('superadmin') || hasRole('founder') || hasRole('management');

  const fetchAnnouncements = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAnnouncements((data || []) as Announcement[]);
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
    fetchAnnouncements();
  }, []);

  const handleCreate = async () => {
    if (!form.title || !form.content) {
      toast({ variant: 'destructive', title: 'Error', description: 'Title and content are required' });
      return;
    }

    setActionLoading(true);
    try {
      const { error } = await supabase.from('announcements').insert({
        title: form.title,
        content: form.content,
        priority: form.priority,
        created_by: user?.id,
      });

      if (error) throw error;

      await supabase.from('system_logs').insert({
        actor_id: user?.id,
        action_type: 'announcement_created',
        details: { title: form.title, priority: form.priority },
      });

      toast({ title: 'Announcement Created', description: 'Your announcement is now live.' });
      setShowCreateDialog(false);
      setForm({ title: '', content: '', priority: 'normal' });
      fetchAnnouncements();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingAnnouncement) return;

    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('announcements')
        .update({
          title: form.title,
          content: form.content,
          priority: form.priority,
        })
        .eq('id', editingAnnouncement.id);

      if (error) throw error;

      toast({ title: 'Announcement Updated' });
      setEditingAnnouncement(null);
      setForm({ title: '', content: '', priority: 'normal' });
      fetchAnnouncements();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setActionLoading(true);
    try {
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) throw error;

      toast({ title: 'Announcement Deleted' });
      fetchAnnouncements();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setActionLoading(false);
    }
  };

  const toggleActive = async (announcement: Announcement) => {
    try {
      const { error } = await supabase
        .from('announcements')
        .update({ is_active: !announcement.is_active })
        .eq('id', announcement.id);

      if (error) throw error;
      fetchAnnouncements();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  const openEditDialog = (announcement: Announcement) => {
    setEditingAnnouncement(announcement);
    setForm({
      title: announcement.title,
      content: announcement.content,
      priority: announcement.priority,
    });
  };

  const priorityColors = {
    low: 'bg-muted/50 border-muted-foreground/30 text-muted-foreground',
    normal: 'bg-primary/10 border-primary/30 text-primary',
    high: 'bg-warning/20 border-warning/50 text-warning',
    urgent: 'bg-destructive/20 border-destructive/50 text-destructive',
  };

  if (!canManage) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <GlassCard className="max-w-md text-center">
            <AlertTriangle size={48} className="mx-auto text-warning mb-4" />
            <h2 className="text-xl font-bold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">
              Only management and above can access this page.
            </p>
          </GlassCard>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold gradient-text">Announcements</h1>
            <p className="text-muted-foreground mt-1">Create and manage announcements for all users</p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)} className="rounded-full neon-glow gap-2">
            <Plus size={18} />
            New Announcement
          </Button>
        </div>

        {/* Announcements List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : announcements.length === 0 ? (
          <GlassCard className="text-center py-12">
            <Megaphone size={48} className="mx-auto text-muted-foreground opacity-50 mb-4" />
            <p className="text-muted-foreground">No announcements yet. Create one to get started.</p>
          </GlassCard>
        ) : (
          <div className="space-y-4">
            {announcements.map((announcement) => (
              <GlassCard 
                key={announcement.id} 
                className={`border ${priorityColors[announcement.priority]} ${!announcement.is_active ? 'opacity-50' : ''}`}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-2 rounded-full shrink-0 ${
                    announcement.priority === 'urgent' ? 'bg-destructive/20 text-destructive' :
                    announcement.priority === 'high' ? 'bg-warning/20 text-warning' :
                    'bg-primary/20 text-primary'
                  }`}>
                    <Megaphone size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold">{announcement.title}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs uppercase ${priorityColors[announcement.priority]}`}>
                        {announcement.priority}
                      </span>
                      {!announcement.is_active && (
                        <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground mt-2 whitespace-pre-wrap">{announcement.content}</p>
                    <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {format(new Date(announcement.created_at), 'MMM dd, yyyy HH:mm')}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleActive(announcement)}
                      className="text-muted-foreground"
                    >
                      {announcement.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEditDialog(announcement)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Edit size={16} />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(announcement.id)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/20"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog || !!editingAnnouncement} onOpenChange={() => {
        setShowCreateDialog(false);
        setEditingAnnouncement(null);
        setForm({ title: '', content: '', priority: 'normal' });
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingAnnouncement ? 'Edit Announcement' : 'New Announcement'}</DialogTitle>
            <DialogDescription>
              {editingAnnouncement ? 'Update the announcement details.' : 'Create a new announcement visible to all users.'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Announcement title"
                className="glass-input"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="content">Content</Label>
              <Textarea
                id="content"
                value={form.content}
                onChange={(e) => setForm(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Write your announcement here..."
                rows={4}
                className="glass-input resize-none"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select value={form.priority} onValueChange={(v: any) => setForm(prev => ({ ...prev, priority: v }))}>
                <SelectTrigger className="glass-input">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowCreateDialog(false);
              setEditingAnnouncement(null);
              setForm({ title: '', content: '', priority: 'normal' });
            }}>
              Cancel
            </Button>
            <Button 
              onClick={editingAnnouncement ? handleUpdate : handleCreate} 
              disabled={actionLoading}
              className="neon-glow"
            >
              {actionLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {editingAnnouncement ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
