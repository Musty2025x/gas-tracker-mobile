import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  KeyboardAvoidingView, Platform, Alert,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useAuth } from '../../lib/auth-context';
import { staffApi, StaffMember } from '../../lib/api';
import { Input, Button, Card, SectionHeader, EmptyState } from '../../components/ui';
import { Colors, Spacing, FontSize, Radius } from '../../constants/theme';

const ROLES = [
  { key: 'manager', label: '👔 Manager', desc: 'Can view all data, manage entries' },
  { key: 'attendant', label: '⛽ Attendant', desc: 'Can submit daily meter entries only' },
];

const ROLE_COLORS: Record<string, string> = {
  manager: Colors.info,
  attendant: Colors.success,
  owner: Colors.primary,
};

export default function StaffScreen() {
  const { stationId, user } = useAuth();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetTarget, setResetTarget] = useState<StaffMember | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: 'attendant',
    password: '',
    confirmPassword: '',
  });

  const set = (key: string) => (val: string) => setForm(f => ({ ...f, [key]: val }));

  const loadStaff = useCallback(async () => {
    if (!stationId) return;
    try {
      const data = await staffApi.getByStation(stationId);
      // Exclude the owner from staff list
      setStaff(data.filter(s => s.role !== 'owner'));
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }, [stationId]);

  useEffect(() => { loadStaff(); }, [loadStaff]);

  const handleCreate = async () => {
    if (!stationId) return;
    if (!form.firstName || !form.lastName || !form.email || !form.password) {
      Alert.alert('Required', 'Fill in all required fields');
      return;
    }
    if (form.password !== form.confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    if (form.password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setSaving(true);
    try {
      await staffApi.create({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email.trim().toLowerCase(),
        phone: form.phone,
        role: form.role as 'manager' | 'attendant',
        stationId,
        password: form.password,
      });
      setForm({ firstName: '', lastName: '', email: '', phone: '', role: 'attendant', password: '', confirmPassword: '' });
      setShowForm(false);
      loadStaff();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to create staff member');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (member: StaffMember) => {
    if (!stationId) return;
    const action = member.isActive ? 'deactivate' : 'activate';
    Alert.alert(
      `${action.charAt(0).toUpperCase() + action.slice(1)} Staff`,
      `${action.charAt(0).toUpperCase() + action.slice(1)} ${member.firstName}? They ${member.isActive ? 'will not be able to login' : 'will regain access'}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action.charAt(0).toUpperCase() + action.slice(1),
          style: member.isActive ? 'destructive' : 'default',
          onPress: async () => {
            try {
              await staffApi.toggleActive(member.id, stationId);
              loadStaff();
            } catch (e: any) { Alert.alert('Error', e.message); }
          },
        },
      ],
    );
  };

  const handleDelete = (member: StaffMember) => {
    Alert.alert(
      'Remove Staff Member',
      `Remove ${member.firstName} ${member.lastName}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await staffApi.delete(member.id, stationId!);
              loadStaff();
            } catch (e: any) { Alert.alert('Error', e.message); }
          },
        },
      ],
    );
  };

  const handleResetPassword = async () => {
    if (!resetTarget || !stationId) return;
    if (newPassword.length < 6) { Alert.alert('Error', 'Password must be at least 6 characters'); return; }
    try {
      await staffApi.resetPassword(resetTarget.id, stationId, newPassword);
      setResetTarget(null);
      setNewPassword('');
      Alert.alert('Success', 'Password updated successfully');
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const isOwner = user?.role === 'owner';

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: Colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* Summary bar */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryNum}>{staff.length}</Text>
            <Text style={styles.summaryLabel}>Total Staff</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryNum, { color: Colors.success }]}>
              {staff.filter(s => s.isActive).length}
            </Text>
            <Text style={styles.summaryLabel}>Active</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryNum, { color: Colors.danger }]}>
              {staff.filter(s => !s.isActive).length}
            </Text>
            <Text style={styles.summaryLabel}>Inactive</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryNum, { color: Colors.info }]}>
              {staff.filter(s => s.role === 'manager').length}
            </Text>
            <Text style={styles.summaryLabel}>Managers</Text>
          </View>
        </View>

        {/* Add staff button — owners only */}
        {isOwner && (
          <Button
            title={showForm ? '✕ Cancel' : '+ Add Staff Member'}
            onPress={() => setShowForm(v => !v)}
            variant={showForm ? 'outline' : 'primary'}
            style={{ marginBottom: Spacing.md }}
          />
        )}

        {/* Add staff form */}
        {showForm && (
          <Card style={{ marginBottom: Spacing.md }}>
            <Text style={styles.formTitle}>👤 New Staff Member</Text>

            <View style={styles.nameRow}>
              <Input
                label="First Name"
                value={form.firstName}
                onChangeText={set('firstName')}
                placeholder="e.g. Emeka"
                style={{ flex: 1, marginRight: Spacing.sm }}
              />
              <Input
                label="Last Name"
                value={form.lastName}
                onChangeText={set('lastName')}
                placeholder="e.g. Okafor"
                style={{ flex: 1 }}
              />
            </View>

            <Input label="Email Address" value={form.email} onChangeText={set('email')} placeholder="staff@example.com" keyboardType="email-address" autoCapitalize="none" />
            <Input label="Phone (optional)" value={form.phone} onChangeText={set('phone')} placeholder="+234 800 000 0000" keyboardType="phone-pad" />

            {/* Role selector */}
            <Text style={styles.roleLabel}>Role</Text>
            <View style={styles.roleGrid}>
              {ROLES.map(r => (
                <TouchableOpacity
                  key={r.key}
                  onPress={() => set('role')(r.key)}
                  style={[styles.roleCard, form.role === r.key && { borderColor: ROLE_COLORS[r.key], backgroundColor: ROLE_COLORS[r.key] + '18' }]}
                >
                  <Text style={[styles.roleCardTitle, form.role === r.key && { color: ROLE_COLORS[r.key] }]}>{r.label}</Text>
                  <Text style={styles.roleCardDesc}>{r.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Input label="Password" value={form.password} onChangeText={set('password')} placeholder="Min. 6 characters" secureTextEntry />
            <Input label="Confirm Password" value={form.confirmPassword} onChangeText={set('confirmPassword')} placeholder="Repeat password" secureTextEntry />

            <Button title={saving ? 'Creating...' : 'Create Staff Member'} onPress={handleCreate} loading={saving} />
          </Card>
        )}

        {/* Password reset modal */}
        {resetTarget && (
          <Card style={[styles.resetCard]}>
            <Text style={styles.formTitle}>🔑 Reset Password</Text>
            <Text style={styles.resetFor}>For: {resetTarget.firstName} {resetTarget.lastName}</Text>
            <Input label="New Password" value={newPassword} onChangeText={setNewPassword} placeholder="Min. 6 characters" secureTextEntry />
            <View style={styles.resetActions}>
              <Button title="Cancel" onPress={() => { setResetTarget(null); setNewPassword(''); }} variant="outline" style={{ flex: 1, marginRight: Spacing.sm }} />
              <Button title="Reset" onPress={handleResetPassword} style={{ flex: 1 }} />
            </View>
          </Card>
        )}

        {/* Staff list */}
        <SectionHeader title={`Staff (${staff.length})`} />

        {staff.length === 0 ? (
          <EmptyState icon="👥" title="No staff members yet" sub="Add your first manager or attendant above" />
        ) : (
          staff.map(member => (
            <Card key={member.id} style={[styles.staffCard, !member.isActive && styles.staffInactive]}>
              <View style={styles.staffHeader}>
                {/* Avatar */}
                <View style={[styles.avatar, { backgroundColor: ROLE_COLORS[member.role] + '22' }]}>
                  <Text style={[styles.avatarText, { color: ROLE_COLORS[member.role] }]}>
                    {member.firstName[0]}{member.lastName[0]}
                  </Text>
                </View>

                <View style={{ flex: 1 }}>
                  <View style={styles.nameStatusRow}>
                    <Text style={[styles.staffName, !member.isActive && { color: Colors.textMuted }]}>
                      {member.firstName} {member.lastName}
                    </Text>
                    <View style={[styles.statusDot, { backgroundColor: member.isActive ? Colors.success : Colors.danger }]} />
                  </View>
                  <Text style={styles.staffEmail}>{member.email}</Text>
                  {member.phone ? <Text style={styles.staffPhone}>{member.phone}</Text> : null}
                  <View style={styles.staffMeta}>
                    <View style={[styles.roleBadge, { backgroundColor: ROLE_COLORS[member.role] + '22' }]}>
                      <Text style={[styles.roleBadgeText, { color: ROLE_COLORS[member.role] }]}>
                        {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                      </Text>
                    </View>
                    {member.lastLoginAt && (
                      <Text style={styles.lastLogin}>
                        Last login: {new Date(member.lastLoginAt).toLocaleDateString('en-NG')}
                      </Text>
                    )}
                  </View>
                </View>
              </View>

              {/* Actions — owners only */}
              {isOwner && (
                <View style={styles.staffActions}>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => handleToggleActive(member)}
                  >
                    <Text style={[styles.actionBtnText, { color: member.isActive ? Colors.warning : Colors.success }]}>
                      {member.isActive ? '⏸ Deactivate' : '▶ Activate'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => { setResetTarget(member); setNewPassword(''); }}
                  >
                    <Text style={[styles.actionBtnText, { color: Colors.info }]}>🔑 Reset PW</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => handleDelete(member)}
                  >
                    <Text style={[styles.actionBtnText, { color: Colors.danger }]}>🗑 Remove</Text>
                  </TouchableOpacity>
                </View>
              )}
            </Card>
          ))
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  summaryRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  summaryCard: {
    flex: 1, backgroundColor: Colors.surface,
    borderRadius: Radius.lg, padding: Spacing.sm,
    alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
  },
  summaryNum: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.textPrimary },
  summaryLabel: { fontSize: 10, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
  formTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.md },
  nameRow: { flexDirection: 'row' },
  roleLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '500', marginBottom: 8 },
  roleGrid: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  roleCard: {
    flex: 1, padding: Spacing.sm, borderRadius: Radius.md,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surfaceAlt,
  },
  roleCardTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textSecondary, marginBottom: 2 },
  roleCardDesc: { fontSize: 11, color: Colors.textMuted, lineHeight: 15 },
  resetCard: { marginBottom: Spacing.md, borderColor: Colors.info, borderWidth: 1.5 },
  resetFor: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.md },
  resetActions: { flexDirection: 'row' },
  staffCard: { marginBottom: Spacing.sm },
  staffInactive: { opacity: 0.6 },
  staffHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: FontSize.md, fontWeight: '800' },
  nameStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  staffName: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  staffEmail: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: 2 },
  staffPhone: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: 4 },
  staffMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  roleBadgeText: { fontSize: 11, fontWeight: '700' },
  lastLogin: { fontSize: 11, color: Colors.textMuted },
  staffActions: {
    flexDirection: 'row', marginTop: Spacing.md,
    paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border,
    gap: 4,
  },
  actionBtn: {
    flex: 1, paddingVertical: 6, paddingHorizontal: 4,
    borderRadius: Radius.sm, backgroundColor: Colors.surfaceAlt,
    alignItems: 'center',
  },
  actionBtnText: { fontSize: 11, fontWeight: '600' },
});
