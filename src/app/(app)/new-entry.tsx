import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useAuth } from '../../lib/auth-context';
import { entriesApi, stationsApi, Station } from '../../lib/api';
import { Input, Button, Card, VarianceBadge } from '../../components/ui';
import { Colors, Spacing, FontSize, Radius } from '../../constants/theme';

function todayDate() {
  return new Date().toISOString().split('T')[0];
}

export default function NewEntryScreen() {
  const { stationId } = useAuth();
  const [station, setStation] = useState<Station | null>(null);

  const [form, setForm] = useState({
    entryDate: todayDate(),
    openingMeter: '',
    closingMeter: '',
    cashReceived: '',
    posReceived: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (stationId) {
      stationsApi.myStations().then(stns => {
        setStation(stns.find(s => s.id === stationId) || stns[0] || null);
      });
    }
  }, [stationId]);

  const set = (key: string) => (val: string) => setForm(f => ({ ...f, [key]: val }));

  // Live calculations
  const opening = parseFloat(form.openingMeter) || 0;
  const closing = parseFloat(form.closingMeter) || 0;
  const cash = parseFloat(form.cashReceived) || 0;
  const pos = parseFloat(form.posReceived) || 0;
  const pricePerKg = station?.pricePerKg || 0;

  const totalSalesKg = Math.max(0, closing - opening);
  const expectedRevenue = totalSalesKg * Number(pricePerKg);
  const totalRemitted = cash + pos;
  const variance = totalRemitted - expectedRevenue;

  const isValid = opening > 0 && closing > opening && (cash + pos) >= 0;

  const handleSubmit = async () => {
    if (!station) { Alert.alert('Error', 'No station selected'); return; }
    if (!isValid) { Alert.alert('Invalid', 'Check meter readings — closing must be greater than opening'); return; }

    setLoading(true);
    try {
      await entriesApi.create({
        stationId: station.id,
        entryDate: form.entryDate,
        openingMeter: opening,
        closingMeter: closing,
        pricePerKg: Number(pricePerKg),
        cashReceived: cash,
        posReceived: pos,
        notes: form.notes,
        localId: `local_${Date.now()}`,
      });

      setSuccess(true);
      setForm({
        entryDate: todayDate(),
        openingMeter: '',
        closingMeter: '',
        cashReceived: '',
        posReceived: '',
        notes: '',
      });
      setTimeout(() => setSuccess(false), 3000);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save entry');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: Colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {success && (
          <View style={styles.successBox}>
            <Text style={styles.successText}>✅ Entry saved successfully!</Text>
          </View>
        )}

        {/* Station info */}
        {station && (
          <View style={styles.stationBanner}>
            <Text style={styles.stationName}>⛽ {station.name}</Text>
            <Text style={styles.stationPrice}>₦{station.pricePerKg}/kg</Text>
          </View>
        )}

        {/* Meter Readings */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>📊 Meter Readings</Text>
          <Input
            label="Opening Meter (kg)"
            value={form.openingMeter}
            onChangeText={set('openingMeter')}
            placeholder="e.g. 12450.5"
            keyboardType="decimal-pad"
          />
          <Input
            label="Closing Meter (kg)"
            value={form.closingMeter}
            onChangeText={set('closingMeter')}
            placeholder="e.g. 12680.0"
            keyboardType="decimal-pad"
          />

          {totalSalesKg > 0 && (
            <View style={styles.calcRow}>
              <Text style={styles.calcLabel}>Total Dispensed</Text>
              <Text style={styles.calcValue}>{totalSalesKg.toFixed(2)} kg</Text>
            </View>
          )}
          {expectedRevenue > 0 && (
            <View style={styles.calcRow}>
              <Text style={styles.calcLabel}>Expected Revenue</Text>
              <Text style={[styles.calcValue, { color: Colors.primary }]}>
                ₦{expectedRevenue.toLocaleString()}
              </Text>
            </View>
          )}
        </Card>

        {/* Remittance */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>💰 Remittance</Text>
          <Input
            label="Cash Received (₦)"
            value={form.cashReceived}
            onChangeText={set('cashReceived')}
            placeholder="0.00"
            keyboardType="decimal-pad"
          />
          <Input
            label="POS Received (₦)"
            value={form.posReceived}
            onChangeText={set('posReceived')}
            placeholder="0.00"
            keyboardType="decimal-pad"
          />

          {(cash + pos) > 0 && (
            <View style={styles.calcRow}>
              <Text style={styles.calcLabel}>Total Remitted</Text>
              <Text style={[styles.calcValue, { color: Colors.success }]}>
                ₦{totalRemitted.toLocaleString()}
              </Text>
            </View>
          )}
        </Card>

        {/* Live Variance Preview */}
        {totalSalesKg > 0 && (cash + pos) > 0 && (
          <Card style={[styles.section, styles.varianceCard]}>
            <Text style={styles.sectionTitle}>⚖️ Variance</Text>
            <View style={styles.varianceRow}>
              <View>
                <Text style={styles.varianceLabel}>Expected vs Remitted</Text>
                <Text style={[
                  styles.varianceAmount,
                  { color: variance < 0 ? Colors.negative : Colors.positive }
                ]}>
                  {variance < 0 ? '-' : '+'}₦{Math.abs(variance).toLocaleString()}
                </Text>
              </View>
              <VarianceBadge variance={variance} />
            </View>
            {variance < -500 && (
              <Text style={styles.varianceWarning}>
                ⚠️ Significant shortage detected. Please verify readings before submitting.
              </Text>
            )}
          </Card>
        )}

        {/* Notes */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>📝 Notes (optional)</Text>
          <Input
            value={form.notes}
            onChangeText={set('notes')}
            placeholder="Any comments about today's readings..."
            multiline
            numberOfLines={3}
            style={{ height: 80 }}
          />
        </Card>

        <Button
          title={loading ? 'Saving...' : 'Submit Entry'}
          onPress={handleSubmit}
          loading={loading}
          disabled={!isValid}
          style={{ marginTop: Spacing.sm, marginBottom: Spacing.xxl }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.md },
  successBox: {
    backgroundColor: Colors.success + '18',
    borderWidth: 1, borderColor: Colors.success + '44',
    borderRadius: Radius.md, padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  successText: { color: Colors.success, fontWeight: '600', fontSize: FontSize.sm },
  stationBanner: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: Spacing.md,
    paddingHorizontal: 4,
  },
  stationName: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  stationPrice: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600' },
  section: { marginBottom: Spacing.md },
  sectionTitle: {
    fontSize: FontSize.sm, fontWeight: '700',
    color: Colors.textSecondary, marginBottom: Spacing.md,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  calcRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingTop: Spacing.sm,
    borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 4,
  },
  calcLabel: { fontSize: FontSize.sm, color: Colors.textMuted },
  calcValue: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  varianceCard: { borderColor: Colors.border },
  varianceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  varianceLabel: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: 4, textTransform: 'uppercase' },
  varianceAmount: { fontSize: FontSize.xxl, fontWeight: '800' },
  varianceWarning: {
    marginTop: Spacing.sm, fontSize: FontSize.xs,
    color: Colors.warning, lineHeight: 18,
  },
});
