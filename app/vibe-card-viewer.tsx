import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Linking,
  Alert,
  Platform,
  Modal,
  ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as ImagePicker from 'expo-image-picker';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { Colors, Typography, Spacing, Radius } from '@/constants/theme';
import { getArchetypeById } from '@/services/archetype';
import { saveVibeCardUrl } from '@/services/storage';
import { useApp } from '@/hooks/useApp';
import { getSupabaseClient } from '@/template';

type ShareTarget = 'instagram' | 'instagram-stories' | 'facebook' | 'general';

export default function VibeCardViewerScreen() {
  const router = useRouter();
  const { vibeCardUrl, archetypeId, setVibeCardUrl } = useApp();
  const archetype = archetypeId ? getArchetypeById(archetypeId) : null;
  const [sharing, setSharing] = useState<ShareTarget | null>(null);

  // Regenerate state
  const [regenModalVisible, setRegenModalVisible] = useState(false);
  const [regenSelfieUri, setRegenSelfieUri] = useState<string | null>(null);
  const [regenLoading, setRegenLoading] = useState(false);
  const [regenError, setRegenError] = useState<string | null>(null);
  const [regenSuccess, setRegenSuccess] = useState(false);

  if (!vibeCardUrl || !archetype) {
    router.back();
    return null;
  }

  // ── Regen helpers ──────────────────────────────────────────

  const openRegenModal = () => {
    setRegenSelfieUri(null);
    setRegenError(null);
    setRegenSuccess(false);
    setRegenModalVisible(true);
  };

  const takeSelfie = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      setRegenError('Camera permission required.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.7,
      cameraType: ImagePicker.CameraType.front,
    });
    if (!result.canceled && result.assets[0]) {
      setRegenSelfieUri(result.assets[0].uri);
      setRegenError(null);
    }
  };

  const pickFromLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setRegenError('Photo library permission required.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setRegenSelfieUri(result.assets[0].uri);
      setRegenError(null);
    }
  };

  const handleRegenerate = async () => {
    if (!regenSelfieUri || !archetype) return;
    setRegenLoading(true);
    setRegenError(null);
    try {
      let base64: string;
      if (Platform.OS === 'web') {
        const resp = await fetch(regenSelfieUri);
        const buf = await resp.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = '';
        bytes.forEach(b => { binary += String.fromCharCode(b); });
        base64 = btoa(binary);
      } else {
        base64 = await FileSystem.readAsStringAsync(regenSelfieUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }

      const supabase = getSupabaseClient();
      const { data, error } = await supabase.functions.invoke('generate-vibe-card', {
        body: {
          selfieBase64: base64,
          archetypeName: archetype.name,
          archetypeEmoji: archetype.emoji,
          archetypeTagline: archetype.tagline,
          archetypeColor: archetype.color,
          archetypeTraits: archetype.traits,
        },
      });

      if (error) {
        let msg = error.message;
        if (error instanceof FunctionsHttpError) {
          try {
            const text = await error.context?.text();
            msg = `[${error.context?.status}] ${text || error.message}`;
          } catch {}
        }
        setRegenError(msg);
        return;
      }

      if (data?.vibeCardUrl) {
        await saveVibeCardUrl(data.vibeCardUrl);
        setVibeCardUrl(data.vibeCardUrl);
        setRegenSuccess(true);
        setTimeout(() => {
          setRegenModalVisible(false);
          setRegenSuccess(false);
        }, 1400);
      } else {
        setRegenError('AI did not return a card. Please try again.');
      }
    } catch (e) {
      setRegenError(String(e));
    } finally {
      setRegenLoading(false);
    }
  };

  // ── Share helpers ──────────────────────────────────────────

  const downloadToCache = async (): Promise<string | null> => {
    try {
      const localUri = FileSystem.cacheDirectory + `vibe-card-${Date.now()}.png`;
      const { uri } = await FileSystem.downloadAsync(vibeCardUrl, localUri);
      return uri;
    } catch (e) {
      console.warn('Download error:', e);
      return null;
    }
  };

  const handleShare = async (target: ShareTarget) => {
    setSharing(target);
    try {
      const localPath = await downloadToCache();
      if (!localPath) {
        Alert.alert('Error', 'Could not download your vibe card. Please try again.');
        setSharing(null);
        return;
      }

      if (target === 'instagram-stories') {
        const instagramUrl = `instagram-stories://share?backgroundImage=${encodeURIComponent(localPath)}`;
        const canOpen = await Linking.canOpenURL(instagramUrl);
        if (canOpen) {
          await Linking.openURL(instagramUrl);
        } else {
          await shareFile(localPath);
        }
      } else if (target === 'instagram') {
        await shareFile(localPath);
      } else if (target === 'facebook') {
        const fbUrl = `fb://publish/profile/me?text=${encodeURIComponent(`My mood: ${archetype.emoji} ${archetype.name} — "${archetype.tagline}"`)}&picture=${encodeURIComponent(vibeCardUrl)}`;
        const canOpen = await Linking.canOpenURL(fbUrl);
        if (canOpen) {
          await Linking.openURL(fbUrl);
        } else {
          await shareFile(localPath);
        }
      } else {
        await shareFile(localPath);
      }
    } catch (e) {
      console.warn('Share error:', e);
      Alert.alert('Share failed', 'Could not share your vibe card. Please try again.');
    } finally {
      setSharing(null);
    }
  };

  const shareFile = async (localPath: string) => {
    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(localPath, {
        mimeType: 'image/png',
        dialogTitle: `My ${archetype!.name} Mood Art Card`,
        UTI: 'public.png',
      });
    } else {
      Alert.alert('Not available', 'Sharing is not supported on this device.');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.closeBtn}>
          <MaterialIcons name="close" size={24} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Your Mood Art Card</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Card */}
      <View style={styles.cardContainer}>
        <View style={[styles.cardFrame, { borderColor: archetype.color + '80' }]}>
          <Image
            source={{ uri: vibeCardUrl }}
            style={styles.cardImage}
            contentFit="cover"
            transition={300}
          />
          <View style={styles.cardOverlay}>
            <Text style={[styles.cardArchetypeName, { color: archetype.color }]}>
              {archetype.emoji}  {archetype.name}
            </Text>
            <Text style={styles.cardTagline}>{archetype.tagline}</Text>
          </View>
        </View>

        {/* AI label + Regenerate button */}
        <View style={styles.cardMeta}>
          <View style={styles.aiLabel}>
            <MaterialIcons name="auto-awesome" size={13} color={Colors.primary} />
            <Text style={styles.aiLabelText}>AI-generated mood art card</Text>
          </View>
          <Pressable
            onPress={openRegenModal}
            style={({ pressed }) => [styles.regenBtn, pressed && { opacity: 0.7 }]}
          >
            <MaterialIcons name="refresh" size={15} color={Colors.primary} />
            <Text style={styles.regenBtnText}>Regenerate</Text>
          </Pressable>
        </View>
      </View>

      {/* Share section */}
      <View style={styles.shareSection}>
        <Text style={styles.shareTitle}>Share your mood art</Text>

        <View style={styles.shareGrid}>
          <Pressable
            onPress={() => handleShare('instagram-stories')}
            disabled={sharing !== null}
            style={({ pressed }) => [
              styles.shareBtn,
              styles.instagramBtn,
              pressed && { opacity: 0.7 },
              sharing === 'instagram-stories' && styles.shareBtnLoading,
            ]}
          >
            {sharing === 'instagram-stories' ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <MaterialIcons name="camera-alt" size={22} color="#fff" />
            )}
            <Text style={styles.shareBtnLabel}>Instagram{'\n'}Stories</Text>
          </Pressable>

          <Pressable
            onPress={() => handleShare('instagram')}
            disabled={sharing !== null}
            style={({ pressed }) => [
              styles.shareBtn,
              styles.instagramFeedBtn,
              pressed && { opacity: 0.7 },
              sharing === 'instagram' && styles.shareBtnLoading,
            ]}
          >
            {sharing === 'instagram' ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <MaterialIcons name="photo-camera" size={22} color="#fff" />
            )}
            <Text style={styles.shareBtnLabel}>Instagram{'\n'}Feed</Text>
          </Pressable>

          <Pressable
            onPress={() => handleShare('facebook')}
            disabled={sharing !== null}
            style={({ pressed }) => [
              styles.shareBtn,
              styles.facebookBtn,
              pressed && { opacity: 0.7 },
              sharing === 'facebook' && styles.shareBtnLoading,
            ]}
          >
            {sharing === 'facebook' ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <MaterialIcons name="facebook" size={22} color="#fff" />
            )}
            <Text style={styles.shareBtnLabel}>Facebook</Text>
          </Pressable>

          <Pressable
            onPress={() => handleShare('general')}
            disabled={sharing !== null}
            style={({ pressed }) => [
              styles.shareBtn,
              styles.generalBtn,
              pressed && { opacity: 0.7 },
              sharing === 'general' && styles.shareBtnLoading,
            ]}
          >
            {sharing === 'general' ? (
              <ActivityIndicator size="small" color={Colors.textPrimary} />
            ) : (
              <MaterialIcons name="ios-share" size={22} color={Colors.textPrimary} />
            )}
            <Text style={[styles.shareBtnLabel, { color: Colors.textSecondary }]}>More</Text>
          </Pressable>
        </View>

        <Text style={styles.shareHint}>
          Tip: Instagram and Facebook must be installed on your device for direct sharing.
        </Text>
      </View>

      {/* ── Regenerate bottom sheet modal ── */}
      <Modal
        visible={regenModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => !regenLoading && setRegenModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />

            {regenSuccess ? (
              <View style={styles.regenSuccessBox}>
                <MaterialIcons name="check-circle" size={52} color={Colors.success} />
                <Text style={styles.regenSuccessText}>New vibe card ready!</Text>
              </View>
            ) : regenLoading ? (
              <View style={styles.regenLoadingBox}>
                <View style={styles.regenOrb}>
                  <ActivityIndicator size="large" color={Colors.primary} />
                </View>
                <Text style={styles.regenLoadingTitle}>Crafting your new card...</Text>
        <Text style={styles.regenLoadingSubtitle}>
                  AI is fusing your photo with your archetype. This takes about 15 seconds.
                </Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.regenAiBadge}>
                  <MaterialIcons name="auto-awesome" size={14} color={Colors.primary} />
                  <Text style={styles.regenAiBadgeText}>AI regeneration</Text>
                </View>

                <Text style={styles.regenTitle}>New selfie, new card</Text>
        <Text style={styles.regenSubtitle}>
                  Take or upload a fresh photo to generate a new mood art card — no need to redo the quiz.{' '}
                  Your{' '}
                  <Text style={{ color: archetype.color, fontWeight: '600' }}>
                    {archetype.emoji} {archetype.name}
                  </Text>{' '}
                  archetype stays.
                </Text>

                {/* Photo preview */}
                {regenSelfieUri ? (
                  <View style={styles.regenPreviewWrapper}>
                    <Image
                      source={{ uri: regenSelfieUri }}
                      style={styles.regenPreview}
                      contentFit="cover"
                      transition={200}
                    />
                    <Pressable
                      onPress={() => setRegenSelfieUri(null)}
                      style={styles.regenRemoveBtn}
                    >
                      <MaterialIcons name="close" size={18} color="#fff" />
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.regenEmptyArea}>
                    <MaterialIcons name="face" size={48} color={Colors.textMuted} />
                    <Text style={styles.regenEmptyText}>No photo selected</Text>
                  </View>
                )}

                {/* Camera / Library */}
                <View style={styles.regenActions}>
                  <Pressable
                    onPress={takeSelfie}
                    style={({ pressed }) => [styles.regenActionBtn, pressed && { opacity: 0.7 }]}
                  >
                    <MaterialIcons name="camera-alt" size={22} color={Colors.primary} />
                    <Text style={styles.regenActionLabel}>Camera</Text>
                  </Pressable>
                  <Pressable
                    onPress={pickFromLibrary}
                    style={({ pressed }) => [styles.regenActionBtn, pressed && { opacity: 0.7 }]}
                  >
                    <MaterialIcons name="photo-library" size={22} color={Colors.primary} />
                    <Text style={styles.regenActionLabel}>Library</Text>
                  </Pressable>
                </View>

                {regenError ? (
                  <View style={styles.regenErrorBox}>
                    <MaterialIcons name="error-outline" size={15} color={Colors.textMuted} />
                    <Text style={styles.regenErrorText}>{regenError}</Text>
                  </View>
                ) : null}

                {/* Footer */}
                <View style={styles.regenFooter}>
                  <Pressable
                    onPress={() => setRegenModalVisible(false)}
                    style={styles.regenCancelBtn}
                  >
                    <Text style={styles.regenCancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleRegenerate}
                    disabled={!regenSelfieUri}
                    style={({ pressed }) => [
                      styles.regenGenerateBtn,
                      !regenSelfieUri && styles.regenGenerateBtnDisabled,
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    <MaterialIcons name="auto-awesome" size={16} color="#08091A" />
                    <Text style={styles.regenGenerateBtnText}>Generate</Text>
                  </Pressable>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const GRADIENT_INSTAGRAM = '#C13584';
const GRADIENT_INSTAGRAM_DARK = '#833AB4';
const FACEBOOK_BLUE = '#1877F2';

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: Typography.fontSizes.lg,
    fontWeight: Typography.fontWeights.semibold,
    color: Colors.textPrimary,
    includeFontPadding: false,
  },
  // Card
  cardContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  cardFrame: {
    width: '92%',
    aspectRatio: 3 / 4,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    borderWidth: 2,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.lg,
    backgroundColor: 'rgba(8,9,26,0.75)',
    gap: 4,
  },
  cardArchetypeName: {
    fontSize: Typography.fontSizes.xl,
    fontWeight: Typography.fontWeights.bold,
    includeFontPadding: false,
  },
  cardTagline: {
    fontSize: Typography.fontSizes.sm,
    color: Colors.textSecondary,
    includeFontPadding: false,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  aiLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.primarySoft,
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  aiLabelText: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.semibold,
    color: Colors.primary,
    includeFontPadding: false,
  },
  regenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.primary + '50',
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  regenBtnText: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.semibold,
    color: Colors.primary,
    includeFontPadding: false,
  },
  // Share section
  shareSection: {
    padding: Spacing.lg,
    gap: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  shareTitle: {
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.semibold,
    color: Colors.textPrimary,
    includeFontPadding: false,
  },
  shareGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  shareBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    minHeight: 76,
  },
  shareBtnLoading: {
    opacity: 0.6,
  },
  shareBtnLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    lineHeight: 14,
    includeFontPadding: false,
  },
  instagramBtn: {
    backgroundColor: GRADIENT_INSTAGRAM,
  },
  instagramFeedBtn: {
    backgroundColor: GRADIENT_INSTAGRAM_DARK,
  },
  facebookBtn: {
    backgroundColor: FACEBOOK_BLUE,
  },
  generalBtn: {
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  shareHint: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: Typography.fontSizes.xs * 1.6,
    includeFontPadding: false,
  },
  // ── Regen modal ──
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.lg,
    paddingTop: Spacing.md,
    maxHeight: '85%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: Spacing.lg,
  },
  regenAiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.primarySoft,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    alignSelf: 'flex-start',
    marginBottom: Spacing.md,
  },
  regenAiBadgeText: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.semibold,
    color: Colors.primary,
    includeFontPadding: false,
  },
  regenTitle: {
    fontSize: Typography.fontSizes.xl,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    includeFontPadding: false,
  },
  regenSubtitle: {
    fontSize: Typography.fontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: Typography.fontSizes.sm * 1.6,
    marginBottom: Spacing.xl,
    includeFontPadding: false,
  },
  regenPreviewWrapper: {
    alignSelf: 'center',
    marginBottom: Spacing.xl,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    width: 160,
    height: 213,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  regenPreview: {
    width: '100%',
    height: '100%',
  },
  regenRemoveBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: Radius.full,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  regenEmptyArea: {
    alignSelf: 'center',
    width: 160,
    height: 213,
    borderRadius: Radius.xl,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  regenEmptyText: {
    fontSize: Typography.fontSizes.sm,
    color: Colors.textMuted,
    includeFontPadding: false,
  },
  regenActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  regenActionBtn: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  regenActionLabel: {
    fontSize: Typography.fontSizes.sm,
    color: Colors.textSecondary,
    fontWeight: Typography.fontWeights.medium,
    includeFontPadding: false,
  },
  regenErrorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  regenErrorText: {
    flex: 1,
    fontSize: Typography.fontSizes.xs,
    color: Colors.textMuted,
    lineHeight: Typography.fontSizes.xs * 1.6,
    includeFontPadding: false,
  },
  regenFooter: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  regenCancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  regenCancelText: {
    fontSize: Typography.fontSizes.md,
    color: Colors.textSecondary,
    fontWeight: Typography.fontWeights.medium,
    includeFontPadding: false,
  },
  regenGenerateBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: 14,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primary,
  },
  regenGenerateBtnDisabled: {
    opacity: 0.4,
  },
  regenGenerateBtnText: {
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.bold,
    color: '#08091A',
    includeFontPadding: false,
  },
  regenLoadingBox: {
    alignItems: 'center',
    paddingVertical: Spacing['2xl'],
    gap: Spacing.lg,
  },
  regenOrb: {
    width: 80,
    height: 80,
    borderRadius: Radius.full,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.primary + '60',
  },
  regenLoadingTitle: {
    fontSize: Typography.fontSizes.lg,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
    includeFontPadding: false,
  },
  regenLoadingSubtitle: {
    fontSize: Typography.fontSizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: Typography.fontSizes.sm * 1.6,
    includeFontPadding: false,
  },
  regenSuccessBox: {
    alignItems: 'center',
    paddingVertical: Spacing['2xl'],
    gap: Spacing.md,
  },
  regenSuccessText: {
    fontSize: Typography.fontSizes.xl,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.success,
    includeFontPadding: false,
  },
});
