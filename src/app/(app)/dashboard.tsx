import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  RefreshControl, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../lib/auth-context';
import { stationsApi, entriesApi, DailySummary, Station } from '../../lib/api';
import { Card, StatCard, SectionHeader, VarianceBadge, EmptyState, Button } from '../../components/ui';
import { Colors, Spacing, FontSize, Radius } from '../../constants/theme';

function todayDate() {
  return new Date().toISOString().split('T')[0];
}

function formatNaira(n: number) {
  return '₦' + Math.abs(n).toLocaleString('en-NG', { minimumFractionDigits: 0 });
}

export default function DashboardScreen() {
  const router = useRouter();
  const { user, stationId, setStation, logout } = useAuth();
  const [stations, setStations] = useState<Station[]>([]);
  const [activeStation, setActiveStation] = useState<Station | null>(null);
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const stns = await stationsApi.myStations();
      setStations(stns);

      let active = stns.find(s => s.id === stationId) || stns[0] || null;
      if (active) {
        setActiveStation(active);
        if (!stationId) setStation(active.id);
        const s = await entriesApi.summary(active.id, todayDate());
        setSummary(s);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [stationId]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const switchStation = async (station: Station) => {
    setActiveStation(station);
    setStation(station.id);
    setLoading(true);
    try {
      const s = await entriesApi.summary(station.id, todayDate());
      setSummary(s);
    } catch {}
    setLoading(false);
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good {getTimeOfDay()},</Text>
          <Text style={styles.name}>{user?.firstName} 👋</Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Sign out</Text>
        </TouchableOpacity>
      </View>

      {/* Station selector */}
      {stations.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stationScroll}>
          {stations.map(s => (
            <TouchableOpacity
              key={s.id}
              onPress={() => switchStation(s)}
              style={[styles.stationChip, activeStation?.id === s.id && styles.stationChipActive]}
            >
              <Text style={[styles.stationChipText, activeStation?.id === s.id && { color: Colors.primary }]}>
                ⛽ {s.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* No station yet */}
      {stations.length === 0 && (
        <Card style={{ marginBottom: Spacing.md }}>
          <EmptyState
            icon="⛽"
            title="No stations yet"
            sub="Add your first gas station to get started"
          />
          <Button title="Add Station" onPress={() => {}} style={{ marginTop: Spacing.md }} />
        </Card>
      )}

      {/* Error */}
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>⚠ {error}</Text>
        </View>
      ) : null}

      {activeStation && (
        <>
          {/* Station header */}
          <View style={styles.stationHeader}>
            <Text style={styles.stationName}>⛽ {activeStation.name}</Text>
            <Text style={styles.stationPrice}>₦{activeStation.pricePerKg}/kg</Text>
          </View>

          <Text style={styles.dateLabel}>
            Today — {new Date().toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long' })}
          </Text>

          {/* Today's summary */}
          {summary && summary.entryCount > 0 ? (
            <>
              <View style={styles.statsRow}>
                <StatCard
                  label="Sales (kg)"
                  value={summary.totalSalesKg.toFixed(1)}
                  sub="Total dispensed"
                  style={{ marginRight: Spacing.sm }}
                />
                <StatCard
                  label="Expected"
                  value={formatNaira(summary.expectedRevenue)}
                  sub="At meter rate"
                />
              </View>

              <View style={[styles.statsRow, { marginTop: Spacing.sm }]}>
                <StatCard
                  label="Cash"
                  value={formatNaira(summary.cashReceived)}
                  color={Colors.success}
                  style={{ marginRight: Spacing.sm }}
                />
                <StatCard
                  label="POS"
                  value={formatNaira(summary.posReceived)}
                  color={Colors.info}
                />
              </View>

              {/* Variance */}
              <Card style={styles.varianceCard}>
                <View style={styles.varianceRow}>
                  <View>
                    <Text style={styles.varianceLabel}>Daily Variance</Text>
                    <Text style={[
                      styles.varianceValue,
                      { color: summary.totalVariance < 0 ? Colors.negative : Colors.positive }
                    ]}>
                      {summary.totalVariance < 0 ? '-' : '+'}{formatNaira(summary.totalVariance)}
                    </Text>
                  </View>
                  <VarianceBadge variance={summary.totalVariance} />
                </View>
                <Text style={styles.varianceSub}>
                  {summary.entryCount} entr{summary.entryCount === 1 ? 'y' : 'ies'} recorded today
                </Text>
              </Card>
            </>
          ) : (
            <Card style={styles.noEntryCard}>
              <EmptyState
                icon="📝"
                title="No entries today"
                sub="Record today's meter readings to see your summary"
              />
              <Button
                title="Record Today's Entry"
                onPress={() => router.push('/(app)/new-entry')}
                style={{ marginTop: Spacing.md }}
              />
            </Card>
          )}

          {/* Quick actions */}
          <SectionHeader title="Quick Actions" />
          <View style={styles.actionsGrid}>
            {[
              { emoji: '✏️', label: 'New Entry', route: '/(app)/new-entry' },
              { emoji: '🏭', label: 'Stock Delivery', route: '/(app)/stock' },
              { emoji: '💸', label: 'Add Expense', route: '/(app)/expenses' },
              { emoji: '📄', label: 'View Reports', route: '/(app)/reports' },
            ].map(a => (
              <TouchableOpacity
                key={a.label}
                style={styles.actionCard}
                onPress={() => router.push(a.route as any)}
                activeOpacity={0.7}
              >
                <Text style={styles.actionEmoji}>{a.emoji}</Text>
                <Text style={styles.actionLabel}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
  },
  greeting: { fontSize: FontSize.sm, color: Colors.textMuted },
  name: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.textPrimary },
  logoutBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: Radius.full, backgroundColor: Colors.surfaceAlt },
  logoutText: { fontSize: FontSize.xs, color: Colors.textSecondary },
  stationScroll: { marginBottom: Spacing.md, marginHorizontal: -Spacing.md, paddingHorizontal: Spacing.md },
  stationChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: Radius.full, borderWidth: 1,
    borderColor: Colors.border, backgroundColor: Colors.surface,
    marginRight: Spacing.sm,
  },
  stationChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '18' },
  stationChipText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  stationHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 4,
  },
  stationName: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  stationPrice: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600' },
  dateLabel: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: Spacing.md },
  statsRow: { flexDirection: 'row' },
  varianceCard: { marginTop: Spacing.sm },
  varianceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  varianceLabel: { fontSize: FontSize.xs, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  varianceValue: { fontSize: FontSize.xxl, fontWeight: '800', marginTop: 2 },
  varianceSub: { fontSize: FontSize.xs, color: Colors.textMuted },
  noEntryCard: { marginBottom: Spacing.md },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  actionCard: {
    flex: 1, minWidth: '45%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionEmoji: { fontSize: 28, marginBottom: 8 },
  actionLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary, textAlign: 'center' },
  errorBox: {
    backgroundColor: Colors.danger + '18', borderWidth: 1,
    borderColor: Colors.danger + '44', borderRadius: Radius.md,
    padding: Spacing.md, marginBottom: Spacing.md,
  },
  errorText: { color: Colors.danger, fontSize: FontSize.sm },
});
