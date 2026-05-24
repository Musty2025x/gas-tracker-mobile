import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useAuth } from '../../lib/auth-context';
import { reportsApi, DailyReport, WeeklyReport } from '../../lib/api';
import { Card, StatCard, SectionHeader, VarianceBadge } from '../../components/ui';
import { Colors, Spacing, FontSize, Radius } from '../../constants/theme';

function todayDate() { return new Date().toISOString().split('T')[0]; }
function weekAgo() {
  const d = new Date(); d.setDate(d.getDate() - 7);
  return d.toISOString().split('T')[0];
}

export default function ReportsScreen() {
  const { stationId } = useAuth();
  const [tab, setTab] = useState<'daily' | 'weekly'>('daily');
  const [daily, setDaily] = useState<DailyReport | null>(null);
  const [weekly, setWeekly] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayDate());

  useEffect(() => {
    if (stationId) loadReport();
  }, [stationId, tab, selectedDate]);

  const loadReport = async () => {
    if (!stationId) return;
    setLoading(true);
    try {
      if (tab === 'daily') {
        const data = await reportsApi.daily(stationId, selectedDate);
        setDaily(data);
      } else {
        const data = await reportsApi.weekly(stationId, weekAgo(), todayDate());
        setWeekly(data);
      }
    } catch {}
    setLoading(false);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Tab switcher */}
      <View style={styles.tabs}>
        {(['daily', 'weekly'] as const).map(t => (
          <TouchableOpacity
            key={t}
            onPress={() => setTab(t)}
            style={[styles.tab, tab === t && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'daily' ? '📅 Daily' : '📆 Weekly'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : tab === 'daily' && daily ? (
        <DailyReportView report={daily} />
      ) : tab === 'weekly' && weekly ? (
        <WeeklyReportView report={weekly} />
      ) : (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No report data available</Text>
        </View>
      )}
    </ScrollView>
  );
}

function DailyReportView({ report }: { report: DailyReport }) {
  const s = report.sales;
  return (
    <>
      <Text style={styles.reportDate}>
        {new Date(report.date).toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      </Text>

      <SectionHeader title="Sales Summary" />
      <View style={styles.row}>
        <StatCard label="Dispensed" value={`${Number(s.totalSalesKg).toFixed(1)} kg`} style={{ marginRight: Spacing.sm }} />
        <StatCard label="Expected" value={`₦${Number(s.expectedRevenue).toLocaleString()}`} />
      </View>

      <View style={[styles.row, { marginTop: Spacing.sm }]}>
        <StatCard label="Cash" value={`₦${Number(s.cashReceived).toLocaleString()}`} color={Colors.success} style={{ marginRight: Spacing.sm }} />
        <StatCard label="POS" value={`₦${Number(s.posReceived).toLocaleString()}`} color={Colors.info} />
      </View>

      <Card style={styles.varianceCard}>
        <View style={styles.varianceRow}>
          <View>
            <Text style={styles.varianceLabel}>Variance</Text>
            <Text style={[styles.varianceVal, { color: s.totalVariance < 0 ? Colors.negative : Colors.positive }]}>
              {s.totalVariance < 0 ? '-' : '+'}₦{Math.abs(Number(s.totalVariance)).toLocaleString()}
            </Text>
          </View>
          <VarianceBadge variance={Number(s.totalVariance)} />
        </View>
      </Card>

      <SectionHeader title="Expenses" />
      <Card>
        <View style={styles.row}>
          <Text style={styles.expLabel}>Total Expenses</Text>
          <Text style={styles.expVal}>₦{report.expenses.total.toLocaleString()}</Text>
        </View>
        <View style={[styles.row, { marginTop: Spacing.sm }]}>
          <Text style={styles.expLabel}>Net Profit</Text>
          <Text style={[styles.expVal, { color: report.netProfit >= 0 ? Colors.positive : Colors.negative }]}>
            ₦{report.netProfit.toLocaleString()}
          </Text>
        </View>
      </Card>

      {report.expenses.items.length > 0 && (
        <>
          <SectionHeader title="Expense Breakdown" />
          {report.expenses.items.map(e => (
            <Card key={e.id} style={{ marginBottom: Spacing.sm }}>
              <View style={styles.row}>
                <Text style={styles.expenseDesc}>{e.description}</Text>
                <Text style={styles.expenseAmt}>₦{Number(e.amount).toLocaleString()}</Text>
              </View>
              <Text style={styles.expenseCat}>{e.category}</Text>
            </Card>
          ))}
        </>
      )}
    </>
  );
}

function WeeklyReportView({ report }: { report: WeeklyReport }) {
  const s = report.summary;
  return (
    <>
      <Text style={styles.reportDate}>
        {report.period.from} → {report.period.to}
      </Text>

      <SectionHeader title="7-Day Summary" />
      <View style={styles.row}>
        <StatCard label="Total Sales" value={`${Number(s.totalSalesKg).toFixed(0)} kg`} style={{ marginRight: Spacing.sm }} />
        <StatCard label="Revenue" value={`₦${Number(s.totalRevenue).toLocaleString()}`} />
      </View>
      <View style={[styles.row, { marginTop: Spacing.sm }]}>
        <StatCard label="Remitted" value={`₦${Number(s.totalRemitted).toLocaleString()}`} color={Colors.success} style={{ marginRight: Spacing.sm }} />
        <StatCard label="Expenses" value={`₦${Number(s.totalExpenses).toLocaleString()}`} color={Colors.danger} />
      </View>

      <Card style={[styles.varianceCard, { marginTop: Spacing.sm }]}>
        <View style={styles.varianceRow}>
          <View>
            <Text style={styles.varianceLabel}>Weekly Variance</Text>
            <Text style={[styles.varianceVal, { color: s.totalVariance < 0 ? Colors.negative : Colors.positive }]}>
              {s.totalVariance < 0 ? '-' : '+'}₦{Math.abs(Number(s.totalVariance)).toLocaleString()}
            </Text>
          </View>
          <VarianceBadge variance={Number(s.totalVariance)} />
        </View>
      </Card>

      <Card style={{ marginTop: Spacing.sm }}>
        <View style={styles.row}>
          <Text style={styles.expLabel}>Net Profit (7 days)</Text>
          <Text style={[styles.expVal, { color: s.netProfit >= 0 ? Colors.positive : Colors.negative }]}>
            ₦{Number(s.netProfit).toLocaleString()}
          </Text>
        </View>
        <View style={[styles.row, { marginTop: Spacing.sm }]}>
          <Text style={styles.expLabel}>Stock Delivered</Text>
          <Text style={styles.expVal}>{Number(s.totalStockDelivered).toLocaleString()} kg</Text>
        </View>
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  tabs: {
    flexDirection: 'row', backgroundColor: Colors.surface,
    borderRadius: Radius.lg, padding: 4,
    marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: Radius.md },
  tabActive: { backgroundColor: Colors.primary },
  tabText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textMuted },
  tabTextActive: { color: '#fff' },
  centered: { paddingVertical: Spacing.xxl, alignItems: 'center' },
  emptyText: { color: Colors.textMuted, fontSize: FontSize.md },
  reportDate: { fontSize: FontSize.sm, color: Colors.textMuted, marginBottom: Spacing.sm },
  row: { flexDirection: 'row' },
  varianceCard: { marginTop: Spacing.sm },
  varianceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  varianceLabel: { fontSize: FontSize.xs, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  varianceVal: { fontSize: FontSize.xxl, fontWeight: '800' },
  expLabel: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary },
  expVal: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  expenseDesc: { flex: 1, fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },
  expenseAmt: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.danger },
  expenseCat: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2, textTransform: 'capitalize' },
});
