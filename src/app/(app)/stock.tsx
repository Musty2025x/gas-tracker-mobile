import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, FlatList,
} from 'react-native';
import { useAuth } from '../../lib/auth-context';
import { stockApi, StockMovement } from '../../lib/api';
import { Input, Button, Card, SectionHeader, EmptyState } from '../../components/ui';
import { Colors, Spacing, FontSize, Radius } from '../../constants/theme';

function todayDate() { return new Date().toISOString().split('T')[0]; }

export default function StockScreen() {
  const { stationId } = useAuth();
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    movementDate: todayDate(),
    quantityKg: '',
    supplierName: '',
    invoiceNumber: '',
    costPerKg: '',
    notes: '',
  });

  const set = (key: string) => (val: string) => setForm(f => ({ ...f, [key]: val }));

  useEffect(() => {
    if (stationId) loadMovements();
  }, [stationId]);

  const loadMovements = async () => {
    if (!stationId) return;
    try {
      const data = await stockApi.byStation(stationId);
      setMovements(data);
    } catch {}
    setFetching(false);
  };

  const totalCost = (parseFloat(form.costPerKg) || 0) * (parseFloat(form.quantityKg) || 0);

  const handleSubmit = async () => {
    if (!stationId) return;
    if (!form.quantityKg) { Alert.alert('Required', 'Enter quantity in kg'); return; }

    setLoading(true);
    try {
      await stockApi.recordDelivery({
        stationId,
        movementDate: form.movementDate,
        quantityKg: parseFloat(form.quantityKg),
        supplierName: form.supplierName,
        invoiceNumber: form.invoiceNumber,
        costPerKg: parseFloat(form.costPerKg) || undefined,
        totalCost: totalCost || undefined,
        notes: form.notes,
      });
      setForm({ movementDate: todayDate(), quantityKg: '', supplierName: '', invoiceNumber: '', costPerKg: '', notes: '' });
      setShowForm(false);
      loadMovements();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: Colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <Button
          title={showForm ? '✕ Cancel' : '+ Record Delivery'}
          onPress={() => setShowForm(v => !v)}
          variant={showForm ? 'outline' : 'primary'}
          style={{ marginBottom: Spacing.md }}
        />

        {showForm && (
          <Card style={styles.form}>
            <Text style={styles.formTitle}>🏭 New Gas Delivery</Text>

            <Input label="Quantity (kg)" value={form.quantityKg} onChangeText={set('quantityKg')} placeholder="e.g. 5000" keyboardType="decimal-pad" />
            <Input label="Supplier Name" value={form.supplierName} onChangeText={set('supplierName')} placeholder="e.g. NNPC Depot" />
            <Input label="Invoice Number" value={form.invoiceNumber} onChangeText={set('invoiceNumber')} placeholder="e.g. INV-2025-001" />
            <Input label="Cost per kg (₦)" value={form.costPerKg} onChangeText={set('costPerKg')} placeholder="e.g. 650" keyboardType="decimal-pad" />

            {totalCost > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total Cost</Text>
                <Text style={styles.totalValue}>₦{totalCost.toLocaleString()}</Text>
              </View>
            )}

            <Input label="Notes (optional)" value={form.notes} onChangeText={set('notes')} placeholder="Any delivery notes..." multiline numberOfLines={2} />

            <Button title="Save Delivery" onPress={handleSubmit} loading={loading} />
          </Card>
        )}

        <SectionHeader title="Delivery History" />

        {fetching ? null : movements.length === 0 ? (
          <EmptyState icon="🏭" title="No deliveries recorded" sub="Record your first gas delivery above" />
        ) : (
          movements.map(m => (
            <Card key={m.id} style={styles.movementCard}>
              <View style={styles.movementHeader}>
                <Text style={styles.movementDate}>{m.movementDate}</Text>
                <Text style={styles.movementQty}>{Number(m.quantityKg).toLocaleString()} kg</Text>
              </View>
              {m.supplierName && <Text style={styles.movementSupplier}>📦 {m.supplierName}</Text>}
              {m.invoiceNumber && <Text style={styles.movementInvoice}>Invoice: {m.invoiceNumber}</Text>}
              {m.totalCost ? (
                <Text style={styles.movementCost}>Cost: ₦{Number(m.totalCost).toLocaleString()}</Text>
              ) : null}
            </Card>
          ))
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  form: { marginBottom: Spacing.md },
  formTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.md },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border, marginBottom: Spacing.md,
  },
  totalLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  totalValue: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.primary },
  movementCard: { marginBottom: Spacing.sm },
  movementHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  movementDate: { fontSize: FontSize.sm, color: Colors.textMuted },
  movementQty: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  movementSupplier: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: 2 },
  movementInvoice: { fontSize: FontSize.xs, color: Colors.textMuted },
  movementCost: { fontSize: FontSize.sm, color: Colors.primary, marginTop: 4, fontWeight: '600' },
});
