import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, TouchableOpacity,
} from 'react-native';
import { useAuth } from '../../lib/auth-context';
import { expensesApi, Expense } from '../../lib/api';
import { Input, Button, Card, SectionHeader, EmptyState } from '../../components/ui';
import { Colors, Spacing, FontSize, Radius } from '../../constants/theme';

const CATEGORIES = [
  { key: 'salary', label: '👷 Salary', color: Colors.info },
  { key: 'maintenance', label: '🔧 Maintenance', color: Colors.warning },
  { key: 'utilities', label: '💡 Utilities', color: Colors.primary },
  { key: 'transport', label: '🚛 Transport', color: Colors.success },
  { key: 'supplies', label: '📦 Supplies', color: Colors.textSecondary },
  { key: 'other', label: '📌 Other', color: Colors.textMuted },
];

function todayDate() { return new Date().toISOString().split('T')[0]; }

export default function ExpensesScreen() {
  const { stationId } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    description: '', amount: '', category: 'other', notes: '',
    expenseDate: todayDate(),
  });

  const set = (key: string) => (val: string) => setForm(f => ({ ...f, [key]: val }));

  useEffect(() => { if (stationId) loadExpenses(); }, [stationId]);

  const loadExpenses = async () => {
    if (!stationId) return;
    try { const data = await expensesApi.byStation(stationId); setExpenses(data); } catch {}
  };

  const handleSubmit = async () => {
    if (!stationId) return;
    if (!form.description || !form.amount) { Alert.alert('Required', 'Enter description and amount'); return; }
    setLoading(true);
    try {
      await expensesApi.create({
        stationId,
        expenseDate: form.expenseDate,
        description: form.description,
        category: form.category,
        amount: parseFloat(form.amount),
        notes: form.notes,
      });
      setForm({ description: '', amount: '', category: 'other', notes: '', expenseDate: todayDate() });
      setShowForm(false);
      loadExpenses();
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setLoading(false); }
  };

  const totalThisMonth = expenses
    .filter(e => e.expenseDate.startsWith(new Date().toISOString().slice(0, 7)))
    .reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: Colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* Monthly total */}
        <Card style={styles.totalCard}>
          <Text style={styles.totalLabel}>This Month's Expenses</Text>
          <Text style={styles.totalAmount}>₦{totalThisMonth.toLocaleString()}</Text>
        </Card>

        <Button
          title={showForm ? '✕ Cancel' : '+ Add Expense'}
          onPress={() => setShowForm(v => !v)}
          variant={showForm ? 'outline' : 'primary'}
          style={{ marginBottom: Spacing.md }}
        />

        {showForm && (
          <Card style={{ marginBottom: Spacing.md }}>
            <Text style={styles.formTitle}>💸 New Expense</Text>

            <Input label="Description" value={form.description} onChangeText={set('description')} placeholder="e.g. Generator repair" />
            <Input label="Amount (₦)" value={form.amount} onChangeText={set('amount')} placeholder="0.00" keyboardType="decimal-pad" />

            <Text style={styles.catLabel}>Category</Text>
            <View style={styles.catGrid}>
              {CATEGORIES.map(c => (
                <TouchableOpacity
                  key={c.key}
                  onPress={() => set('category')(c.key)}
                  style={[styles.catChip, form.category === c.key && { borderColor: c.color, backgroundColor: c.color + '18' }]}
                >
                  <Text style={[styles.catText, form.category === c.key && { color: c.color }]}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Input label="Notes (optional)" value={form.notes} onChangeText={set('notes')} placeholder="Additional details..." multiline numberOfLines={2} />
            <Button title="Save Expense" onPress={handleSubmit} loading={loading} />
          </Card>
        )}

        <SectionHeader title="Recent Expenses" />

        {expenses.length === 0 ? (
          <EmptyState icon="💸" title="No expenses recorded" sub="Track your station expenses here" />
        ) : (
          expenses.map(e => {
            const cat = CATEGORIES.find(c => c.key === e.category);
            return (
              <Card key={e.id} style={styles.expenseCard}>
                <View style={styles.expenseRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.expenseDesc}>{e.description}</Text>
                    <View style={styles.expenseMeta}>
                      <Text style={[styles.expenseCat, { color: cat?.color || Colors.textMuted }]}>{cat?.label || e.category}</Text>
                      <Text style={styles.expenseDate}> · {e.expenseDate}</Text>
                    </View>
                  </View>
                  <Text style={styles.expenseAmount}>₦{Number(e.amount).toLocaleString()}</Text>
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  totalCard: { marginBottom: Spacing.md, alignItems: 'center', paddingVertical: Spacing.lg },
  totalLabel: { fontSize: FontSize.xs, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  totalAmount: { fontSize: FontSize.xxxl, fontWeight: '800', color: Colors.danger },
  formTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.md },
  catLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '500', marginBottom: 8 },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.md },
  catChip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surfaceAlt,
  },
  catText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary },
  expenseCard: { marginBottom: Spacing.sm },
  expenseRow: { flexDirection: 'row', alignItems: 'center' },
  expenseDesc: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textPrimary, marginBottom: 2 },
  expenseMeta: { flexDirection: 'row', alignItems: 'center' },
  expenseCat: { fontSize: FontSize.xs, fontWeight: '600' },
  expenseDate: { fontSize: FontSize.xs, color: Colors.textMuted },
  expenseAmount: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.danger },
});
