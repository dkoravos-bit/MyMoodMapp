/**
 * Menstrual Cycle Tracker Screen
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants/theme';
import { useAlert } from '@/template';
import {
  CycleEntry,
  FlowIntensity,
  CYCLE_SYMPTOMS,
  FLOW_LABELS,
  PHASE_INFO,
  fetchCycleEntries,
  logPeriodStart,
  updateCycleEntry,
  deleteCycleEntry,
  getCurrentCyclePhase,
  buildCycleCalendar,
} from '@/services/cycleTracker';

const TODAY = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
})();

type ModalMode = 'log_start' | 'log_end' | 'edit' | null;

export default function CycleTrackerScreen() {
  const router = useRouter();
  const { showAlert } = useAlert();

  const [entries, setEntries] = useState<CycleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editingEntry, setEditingEntry] = useState<CycleEntry | null>(null);

  // Log form state
  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [selectedFlow, setSelectedFlow] = useState<FlowIntensity>('medium');
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [noteText, setNoteText] = useState('');

  // Calendar state
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchCycleEntries();
    setEntries(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, []);

  const cycleStatus = getCurrentCyclePhase(entries);
  const phaseInfo = PHASE_INFO[cycleStatus.phase];
  const calendarMap = buildCycleCalendar(entries);

  const openLogStart = () => {
    setSelectedDate(TODAY);
    setSelectedFlow('medium');
    setSelectedSymptoms([]);
    setNoteText('');
    setEditingEntry(null);
    setModalMode('log_start');
  };

  const openLogEnd = (entry: CycleEntry) => {
    setEditingEntry(entry);
    setSelectedDate(TODAY);
    setModalMode('log_end');
  };

  const openEdit = (entry: CycleEntry) => {
    setEditingEntry(entry);
    setSelectedDate(entry.period_start);
    setSelectedFlow(entry.flow_intensity as FlowIntensity);
    setSelectedSymptoms(entry.symptoms ?? []);
    setNoteText(entry.notes ?? '');
    setModalMode('edit');
  };

  const handleSaveStart = async () => {
    if (!selectedDate) return;
    setSaving(true);
    const result = await logPeriodStart(selectedDate, selectedFlow, selectedSymptoms);
    setSaving(false);
    if (result) {
      setModalMode(null);
      await load();
    } else {
      showAlert('Error', 'Could not save. Please try again.');
    }
  };

  const handleSaveEnd = async () => {
    if (!editingEntry || !selectedDate) return;
    setSaving(true);
    const start = new Date(editingEntry.period_start);
    const end = new Date(selectedDate);
    const cycleLen = entries.length >= 2
      ? Math.round((start.getTime() - new Date(entries[1].period_start).getTime()) / 86400000)
      : null;
    await updateCycleEntry(editingEntry.id, { period_end: selectedDate, cycle_length: cycleLen });
    setSaving(false);
    setModalMode(null);
    await load();
  };

  const handleSaveEdit = async () => {
    if (!editingEntry) return;
    setSaving(true);
    await updateCycleEntry(editingEntry.id, {
      flow_intensity: selectedFlow,
      symptoms: selectedSymptoms,
      notes: noteText.trim() || null,
    });
    setSaving(false);
    setModalMode(null);
    await load();
  };

  const handleDelete = (entry: CycleEntry) => {
    showAlert('Delete this entry?', `Period starting ${formatDate(entry.period_start)} will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await deleteCycleEntry(entry.id);
          await load();
        },
      },
    ]);
  };

  const toggleSymptom = (id: string) => {
    setSelectedSymptoms(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  // ── Calendar rendering ────────────────────────────────────────────────────
  const { year, month } = calendarMonth;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const monthStr = new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' });

  const calDays: (string | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1;
      return `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }),
  ];

  const prevMonth = () => setCalendarMonth(prev => {
    const m = prev.month - 1;
    return m < 0 ? { year: prev.year - 1, month: 11 } : { year: prev.year, month: m };
  });
  const nextMonth = () => setCalendarMonth(prev => {
    const m = prev.month + 1;
    return m > 11 ? { year: prev.year + 1, month: 0 } : { year: prev.year, month: m };
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Cycle Tracker</Text>
        <Pressable onPress={openLogStart} style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.8 }]}>
          <MaterialIcons name="add" size={20} color="#08091A" />
          <Text style={styles.addBtnText}>Log period</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Current phase card */}
        <View style={[styles.phaseCard, { borderColor: phaseInfo.color + '60', backgroundColor: phaseInfo.color + '10' }]}>
          <Text style={styles.phaseEmoji}>{phaseInfo.emoji}</Text>
          <View style={{ flex: 1, gap: 4 }}>
            <View style={styles.phaseTopRow}>
              <Text style={[styles.phaseName, { color: phaseInfo.color }]}>{phaseInfo.label} phase</Text>
              {cycleStatus.dayOfCycle ? (
                <View style={[styles.dayBadge, { backgroundColor: phaseInfo.color + '25' }]}>
                  <Text style={[styles.dayBadgeText, { color: phaseInfo.color }]}>Day {cycleStatus.dayOfCycle}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.phaseDesc}>{phaseInfo.description}</Text>
            <Text style={styles.phaseEnergy}>{phaseInfo.energyNote}</Text>
            {cycleStatus.daysUntilNextPeriod !== null ? (
              <Text style={styles.nextPeriod}>
                {cycleStatus.daysUntilNextPeriod > 0
                  ? `Next period in ~${cycleStatus.daysUntilNextPeriod} days`
                  : cycleStatus.daysUntilNextPeriod === 0
                  ? 'Period expected today'
                  : `Period may be ${Math.abs(cycleStatus.daysUntilNextPeriod)} days late`}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Phase legend */}
        <View style={styles.legendRow}>
          {(['menstrual', 'follicular', 'ovulation', 'luteal'] as const).map(p => (
            <View key={p} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: PHASE_INFO[p].color }]} />
              <Text style={styles.legendLabel}>{PHASE_INFO[p].label.slice(0, 3)}</Text>
            </View>
          ))}
        </View>

        {/* Calendar */}
        <View style={styles.calendarCard}>
          <View style={styles.calNavRow}>
            <Pressable onPress={prevMonth} hitSlop={8} style={({ pressed }) => [styles.calNavBtn, pressed && { opacity: 0.6 }]}>
              <MaterialIcons name="chevron-left" size={22} color={Colors.textPrimary} />
            </Pressable>
            <Text style={styles.calMonthTitle}>{monthStr}</Text>
            <Pressable onPress={nextMonth} hitSlop={8} style={({ pressed }) => [styles.calNavBtn, pressed && { opacity: 0.6 }]}>
              <MaterialIcons name="chevron-right" size={22} color={Colors.textPrimary} />
            </Pressable>
          </View>

          {/* Day of week headers */}
          <View style={styles.calWeekRow}>
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
              <Text key={d} style={styles.calDayHeader}>{d}</Text>
            ))}
          </View>

          {/* Day cells */}
          <View style={styles.calGrid}>
            {calDays.map((dateStr, i) => {
              if (!dateStr) return <View key={`empty-${i}`} style={styles.calCell} />;
              const phase = calendarMap.get(dateStr);
              const isToday = dateStr === TODAY;
              const phaseColor = phase ? PHASE_INFO[phase].color : null;
              const dayNum = parseInt(dateStr.split('-')[2], 10);
              return (
                <View key={dateStr} style={[styles.calCell, isToday && styles.calCellToday]}>
                  {phaseColor ? (
                    <View style={[styles.calDayDot, { backgroundColor: phaseColor + '40' }]}>
                      <Text style={[styles.calDayNum, { color: phaseColor, fontWeight: '700' }]}>{dayNum}</Text>
                    </View>
                  ) : (
                    <Text style={[styles.calDayNum, isToday && { color: Colors.primary, fontWeight: '700' }]}>{dayNum}</Text>
                  )}
                  {isToday ? <View style={styles.todayDot} /> : null}
                </View>
              );
            })}
          </View>
        </View>

        {/* Avg cycle info */}
        {entries.length >= 2 ? (
          <View style={styles.statsRow}>
            <StatChip icon="loop" label="Avg cycle" value={`${cycleStatus.avgCycleLength} days`} color={Colors.primary} />
            <StatChip icon="water-drop" label="Logged periods" value={String(entries.length)} color={Colors.error} />
            {entries[0]?.period_end ? (
              <StatChip
                icon="timelapse"
                label="Last period"
                value={`${Math.round((new Date(entries[0].period_end).getTime() - new Date(entries[0].period_start).getTime()) / 86400000) + 1}d`}
                color="#7C83FF"
              />
            ) : null}
          </View>
        ) : null}

        {/* History */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cycle history</Text>
          {loading ? (
            <ActivityIndicator color={Colors.primary} />
          ) : entries.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🩸</Text>
              <Text style={styles.emptyTitle}>No cycles logged yet</Text>
              <Text style={styles.emptyDesc}>Tap "Log period" to start tracking your cycle and unlock phase insights.</Text>
            </View>
          ) : (
            entries.map((entry, i) => (
              <CycleEntryCard
                key={entry.id}
                entry={entry}
                onEdit={() => openEdit(entry)}
                onLogEnd={() => openLogEnd(entry)}
                onDelete={() => handleDelete(entry)}
              />
            ))
          )}
        </View>

      </ScrollView>

      {/* Modal overlay */}
      {modalMode ? (
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setModalMode(null)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />

            <Text style={styles.modalTitle}>
              {modalMode === 'log_start' ? 'Log period start' : modalMode === 'log_end' ? 'Log period end' : 'Edit entry'}
            </Text>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.lg, paddingBottom: Spacing.xl }}>

              {/* Date selector */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Date</Text>
                <TextInput
                  style={styles.dateInput}
                  value={selectedDate}
                  onChangeText={setSelectedDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={Colors.textMuted}
                />
                <Text style={styles.formHint}>Format: YYYY-MM-DD</Text>
              </View>

              {/* Flow intensity (not for log_end) */}
              {modalMode !== 'log_end' ? (
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Flow intensity</Text>
                  <View style={styles.flowRow}>
                    {(['spotting', 'light', 'medium', 'heavy'] as FlowIntensity[]).map(f => (
                      <Pressable
                        key={f}
                        onPress={() => setSelectedFlow(f)}
                        style={[styles.flowChip, selectedFlow === f && styles.flowChipActive]}
                      >
                        <Text style={[styles.flowChipText, selectedFlow === f && styles.flowChipTextActive]}>
                          {FLOW_LABELS[f]}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}

              {/* Symptoms (not for log_end) */}
              {modalMode !== 'log_end' ? (
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Symptoms (optional)</Text>
                  <View style={styles.symptomsGrid}>
                    {CYCLE_SYMPTOMS.map(s => (
                      <Pressable
                        key={s.id}
                        onPress={() => toggleSymptom(s.id)}
                        style={[styles.symptomChip, selectedSymptoms.includes(s.id) && styles.symptomChipActive]}
                      >
                        <Text style={styles.symptomEmoji}>{s.emoji}</Text>
                        <Text style={[styles.symptomLabel, selectedSymptoms.includes(s.id) && styles.symptomLabelActive]}>
                          {s.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}

              {/* Notes */}
              {modalMode !== 'log_end' ? (
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Notes (optional)</Text>
                  <TextInput
                    style={styles.notesInput}
                    value={noteText}
                    onChangeText={setNoteText}
                    placeholder="How are you feeling?"
                    placeholderTextColor={Colors.textMuted}
                    multiline
                    numberOfLines={3}
                  />
                </View>
              ) : null}

              {/* Save button */}
              <Pressable
                onPress={modalMode === 'log_start' ? handleSaveStart : modalMode === 'log_end' ? handleSaveEnd : handleSaveEdit}
                disabled={saving}
                style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.8 }, saving && { opacity: 0.6 }]}
              >
                {saving ? <ActivityIndicator size="small" color="#08091A" /> : (
                  <Text style={styles.saveBtnText}>
                    {modalMode === 'log_start' ? 'Save period start' : modalMode === 'log_end' ? 'Save period end' : 'Save changes'}
                  </Text>
                )}
              </Pressable>

            </ScrollView>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CycleEntryCard({ entry, onEdit, onLogEnd, onDelete }: {
  entry: CycleEntry;
  onEdit: () => void;
  onLogEnd: () => void;
  onDelete: () => void;
}) {
  const duration = entry.period_end
    ? Math.round((new Date(entry.period_end).getTime() - new Date(entry.period_start).getTime()) / 86400000) + 1
    : null;

  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.topRow}>
        <View style={cardStyles.dateBlock}>
          <MaterialIcons name="water-drop" size={14} color={Colors.error} />
          <Text style={cardStyles.dateText}>{formatDate(entry.period_start)}</Text>
          {entry.period_end ? (
            <>
              <Text style={cardStyles.dateSep}>→</Text>
              <Text style={cardStyles.dateText}>{formatDate(entry.period_end)}</Text>
              <Text style={cardStyles.duration}>{duration}d</Text>
            </>
          ) : (
            <Pressable onPress={onLogEnd} style={cardStyles.logEndBtn}>
              <Text style={cardStyles.logEndText}>+ Log end</Text>
            </Pressable>
          )}
        </View>
        <View style={cardStyles.actions}>
          <Pressable onPress={onEdit} hitSlop={8} style={({ pressed }) => [cardStyles.actionBtn, pressed && { opacity: 0.6 }]}>
            <MaterialIcons name="edit" size={14} color={Colors.textMuted} />
          </Pressable>
          <Pressable onPress={onDelete} hitSlop={8} style={({ pressed }) => [cardStyles.actionBtn, pressed && { opacity: 0.6 }]}>
            <MaterialIcons name="delete-outline" size={14} color={Colors.error + '80'} />
          </Pressable>
        </View>
      </View>

      {/* Flow + symptoms */}
      <View style={cardStyles.metaRow}>
        <View style={[cardStyles.flowBadge, { backgroundColor: getFlowColor(entry.flow_intensity as FlowIntensity) + '25' }]}>
          <Text style={[cardStyles.flowText, { color: getFlowColor(entry.flow_intensity as FlowIntensity) }]}>
            {FLOW_LABELS[entry.flow_intensity as FlowIntensity] ?? entry.flow_intensity}
          </Text>
        </View>
        {(entry.symptoms ?? []).slice(0, 5).map(s => {
          const sym = CYCLE_SYMPTOMS.find(c => c.id === s);
          return sym ? <Text key={s} style={cardStyles.symptomEmoji}>{sym.emoji}</Text> : null;
        })}
        {(entry.symptoms ?? []).length > 5 ? <Text style={cardStyles.moreSym}>+{(entry.symptoms ?? []).length - 5}</Text> : null}
      </View>

      {entry.notes ? <Text style={cardStyles.notes} numberOfLines={2}>{entry.notes}</Text> : null}
    </View>
  );
}

function StatChip({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <View style={[chipStyles.chip, { borderColor: color + '40' }]}>
      <MaterialIcons name={icon as any} size={13} color={color} />
      <Text style={[chipStyles.value, { color }]}>{value}</Text>
      <Text style={chipStyles.label}>{label}</Text>
    </View>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getFlowColor(flow: FlowIntensity): string {
  return { spotting: '#FFB3B3', light: '#FF8C8C', medium: Colors.error, heavy: '#CC0000' }[flow] ?? Colors.error;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { width: 36, height: 36, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surfaceElevated },
  headerTitle: { flex: 1, fontSize: Typography.fontSizes.xl, fontWeight: '700', color: Colors.textPrimary, includeFontPadding: false },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary, paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: Radius.lg },
  addBtnText: { fontSize: Typography.fontSizes.sm, fontWeight: '700', color: '#08091A', includeFontPadding: false },
  scroll: { padding: Spacing.lg, paddingBottom: 80, gap: Spacing.xl },
  // Phase card
  phaseCard: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.lg, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1.5, ...Shadows.sm },
  phaseEmoji: { fontSize: 40 },
  phaseTopRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  phaseName: { fontSize: Typography.fontSizes.lg, fontWeight: '800', includeFontPadding: false },
  dayBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  dayBadgeText: { fontSize: Typography.fontSizes.xs, fontWeight: '700', includeFontPadding: false },
  phaseDesc: { fontSize: Typography.fontSizes.sm, color: Colors.textPrimary, fontWeight: '500', includeFontPadding: false },
  phaseEnergy: { fontSize: Typography.fontSizes.xs, color: Colors.textSecondary, includeFontPadding: false },
  nextPeriod: { fontSize: Typography.fontSizes.xs, color: Colors.textMuted, fontStyle: 'italic', includeFontPadding: false },
  // Legend
  legendRow: { flexDirection: 'row', gap: Spacing.lg, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontSize: 10, color: Colors.textMuted, includeFontPadding: false },
  // Calendar
  calendarCard: { backgroundColor: Colors.surfaceElevated, borderRadius: Radius.xl, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, gap: Spacing.md },
  calNavRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  calNavBtn: { width: 32, height: 32, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface },
  calMonthTitle: { fontSize: Typography.fontSizes.md, fontWeight: '700', color: Colors.textPrimary, includeFontPadding: false },
  calWeekRow: { flexDirection: 'row' },
  calDayHeader: { flex: 1, textAlign: 'center', fontSize: 10, fontWeight: '700', color: Colors.textMuted, includeFontPadding: false },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 4, gap: 2 },
  calCellToday: {},
  calDayDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  calDayNum: { fontSize: 12, color: Colors.textSecondary, includeFontPadding: false },
  todayDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.primary },
  // Stats row
  statsRow: { flexDirection: 'row', gap: Spacing.sm },
  // Section
  section: { gap: Spacing.md },
  sectionTitle: { fontSize: Typography.fontSizes.xs, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1, includeFontPadding: false },
  emptyState: { backgroundColor: Colors.surfaceElevated, borderRadius: Radius.xl, padding: Spacing.xl, alignItems: 'center', gap: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  emptyEmoji: { fontSize: 36 },
  emptyTitle: { fontSize: Typography.fontSizes.md, fontWeight: '700', color: Colors.textPrimary, includeFontPadding: false },
  emptyDesc: { fontSize: Typography.fontSizes.sm, color: Colors.textMuted, textAlign: 'center', lineHeight: Typography.fontSizes.sm * 1.5, includeFontPadding: false },
  // Modal
  modalOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 100 },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  modalSheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.lg, maxHeight: '85%' },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: Spacing.lg },
  modalTitle: { fontSize: Typography.fontSizes.xl, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.lg, includeFontPadding: false },
  // Form
  formGroup: { gap: Spacing.sm },
  formLabel: { fontSize: Typography.fontSizes.sm, fontWeight: '600', color: Colors.textPrimary, includeFontPadding: false },
  formHint: { fontSize: 10, color: Colors.textMuted, includeFontPadding: false },
  dateInput: { backgroundColor: Colors.surfaceElevated, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, color: Colors.textPrimary, fontSize: Typography.fontSizes.sm, borderWidth: 1, borderColor: Colors.border },
  flowRow: { flexDirection: 'row', gap: Spacing.sm },
  flowChip: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: Radius.lg, backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.border },
  flowChipActive: { backgroundColor: Colors.error + '20', borderColor: Colors.error + '60' },
  flowChipText: { fontSize: Typography.fontSizes.xs, color: Colors.textMuted, fontWeight: '600', includeFontPadding: false },
  flowChipTextActive: { color: Colors.error },
  symptomsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  symptomChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.md, paddingVertical: 7, borderRadius: Radius.full, backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.border },
  symptomChipActive: { backgroundColor: Colors.primary + '20', borderColor: Colors.primary + '60' },
  symptomEmoji: { fontSize: 14 },
  symptomLabel: { fontSize: Typography.fontSizes.xs, color: Colors.textMuted, includeFontPadding: false },
  symptomLabelActive: { color: Colors.primary },
  notesInput: { backgroundColor: Colors.surfaceElevated, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, color: Colors.textPrimary, fontSize: Typography.fontSizes.sm, borderWidth: 1, borderColor: Colors.border, minHeight: 80, textAlignVertical: 'top' },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: Radius.lg, paddingVertical: 14, alignItems: 'center' },
  saveBtnText: { fontSize: Typography.fontSizes.md, fontWeight: '700', color: '#08091A', includeFontPadding: false },
});

const cardStyles = StyleSheet.create({
  card: { backgroundColor: Colors.surfaceElevated, borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: Spacing.sm },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateBlock: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  dateText: { fontSize: Typography.fontSizes.sm, fontWeight: '600', color: Colors.textPrimary, includeFontPadding: false },
  dateSep: { fontSize: Typography.fontSizes.xs, color: Colors.textMuted, includeFontPadding: false },
  duration: { fontSize: Typography.fontSizes.xs, fontWeight: '700', color: Colors.primary, backgroundColor: Colors.primarySoft, paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.full, includeFontPadding: false },
  logEndBtn: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full, backgroundColor: Colors.primarySoft, borderWidth: 1, borderColor: Colors.primary + '40' },
  logEndText: { fontSize: 10, color: Colors.primary, fontWeight: '700', includeFontPadding: false },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  actionBtn: { width: 28, height: 28, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  flowBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  flowText: { fontSize: 10, fontWeight: '700', includeFontPadding: false },
  symptomEmoji: { fontSize: 16 },
  moreSym: { fontSize: 10, color: Colors.textMuted, includeFontPadding: false },
  notes: { fontSize: Typography.fontSizes.xs, color: Colors.textSecondary, fontStyle: 'italic', lineHeight: Typography.fontSizes.xs * 1.5, includeFontPadding: false },
});

const chipStyles = StyleSheet.create({
  chip: { flex: 1, alignItems: 'center', gap: 2, backgroundColor: Colors.surfaceElevated, borderRadius: Radius.lg, padding: Spacing.sm, paddingVertical: Spacing.md, borderWidth: 1 },
  value: { fontSize: Typography.fontSizes.sm, fontWeight: '700', includeFontPadding: false },
  label: { fontSize: 9, color: Colors.textMuted, textAlign: 'center', includeFontPadding: false },
});
