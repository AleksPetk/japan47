import { Ionicons } from '@expo/vector-icons';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';
import { Button, Eyebrow, Hero, Screen } from '@/components/core';
import { colors, radius, shadow, spacing, typography } from '@/constants/theme';

const KOFI_URL = 'https://ko-fi.com/japan47';

const supportCosts = [
  { icon: 'server-outline', title: 'Hosting and infrastructure', text: 'Keeping the Japan47 website, API, and mobile experience reliable and available.' },
  { icon: 'globe-outline', title: 'Domain and essential services', text: 'Maintaining the services that keep Japan47 connected and secure.' },
  { icon: 'construct-outline', title: 'Maintenance and development', text: 'Fixes, updates, accessibility work, and thoughtful improvements.' },
  { icon: 'images-outline', title: 'Image storage', text: 'Safely storing and serving community destination photography.' },
] as const;

export default function SupportJapan47Screen() {
  const openKofi = async () => {
    try {
      const supported = await Linking.canOpenURL(KOFI_URL);
      if (!supported) throw new Error('Unsupported URL');
      await Linking.openURL(KOFI_URL);
    } catch {
      Alert.alert(
        'Unable to open Ko-fi',
        'Please try again later or open ko-fi.com/japan47 in your browser.',
      );
    }
  };

  return <Screen>
    <Hero
      eyebrow="A free community project"
      title="Support Japan47"
      subtitle="Japan47 is a free place to discover and share destinations across every prefecture. Supporting the project is always completely optional."
    />

    <View style={styles.panel}>
      <Eyebrow>Keeping Japan47 online</Eyebrow>
      <Text style={styles.heading}>What support helps cover</Text>
      <Text style={styles.intro}>Optional support helps with the practical costs of running and improving an independent community project.</Text>
      <View style={styles.costs}>{supportCosts.map((item) => <View key={item.title} style={styles.cost}><View style={styles.costIcon}><Ionicons name={item.icon} size={21} color={colors.red} /></View><View style={styles.costBody}><Text style={styles.costTitle}>{item.title}</Text><Text style={styles.costText}>{item.text}</Text></View></View>)}</View>
    </View>

    <View style={styles.optionalPanel}>
      <Eyebrow light>Entirely optional</Eyebrow>
      <Text style={styles.optionalTitle}>Japan47 stays free for everyone.</Text>
      <Text style={styles.optionalText}>Supporting Japan47 does not unlock premium content, features, badges, points, supporter status, special access, ad removal, or any other in-app benefit. Everyone receives the same Japan47 experience.</Text>
      <Button label="Support on Ko-fi" icon="heart-outline" onPress={openKofi} />
      <Text style={styles.externalNote}>Ko-fi opens in your device’s external browser.</Text>
    </View>
  </Screen>;
}

const styles = StyleSheet.create({
  panel: { gap: spacing.md, padding: spacing.lg, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, backgroundColor: colors.surface, ...shadow },
  heading: { color: colors.ink, fontFamily: typography.title, fontSize: 26, lineHeight: 31, fontWeight: '700' },
  intro: { color: colors.muted, fontSize: 15, lineHeight: 23 },
  costs: { gap: spacing.sm, marginTop: spacing.xs },
  cost: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, padding: spacing.md, borderWidth: 1, borderColor: '#EDD3CF', borderLeftWidth: 4, borderLeftColor: colors.red, borderRadius: radius.md, backgroundColor: '#FBF3F1' },
  costIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: colors.redSoft },
  costBody: { flex: 1 },
  costTitle: { color: colors.ink, fontFamily: typography.title, fontSize: 17, fontWeight: '700' },
  costText: { marginTop: 3, color: colors.muted, fontSize: 13, lineHeight: 19 },
  optionalPanel: { gap: spacing.md, padding: spacing.xl, borderRadius: radius.lg, backgroundColor: colors.forest, ...shadow },
  optionalTitle: { color: colors.surface, fontFamily: typography.title, fontSize: 25, lineHeight: 30, fontWeight: '700' },
  optionalText: { color: '#D5DED7', fontSize: 14, lineHeight: 22 },
  externalNote: { color: '#AEBCB2', fontSize: 11, lineHeight: 16, textAlign: 'center' },
});
