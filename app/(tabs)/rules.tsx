import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useLanguage } from '@/contexts/LanguageContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { t } from '@/i18n';
import { Image as ExpoImage } from 'expo-image';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';

function HeaderLogo() {
  const source =
    Platform.OS === 'web'
      ? require('../../assets/images/logo.svg')
      : require('../../assets/images/icon.png');

  return (
    <View style={styles.headerLogoContainer}>
      <ExpoImage 
        source={source} 
        style={styles.headerLogo} 
        contentFit="contain" 
      />
    </View>
  );
}

export default function RulesScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { locale } = useLanguage();

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >      
      {/* Game Overview */}
      <View style={[styles.section, { backgroundColor: isDark ? '#2a2a2a' : '#f8f9fa' }]}>
        <View style={styles.sectionHeader}>
      <HeaderLogo />
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            {t('rules.overview.title', { locale })}
          </ThemedText>
        </View>
        <ThemedText style={styles.sectionText}>
          {t('rules.overview.description', { locale })}
        </ThemedText>
      </View>

      {/* How to Play */}
      <View style={[styles.section, { backgroundColor: isDark ? '#2a2a2a' : '#f8f9fa' }]}>
        <View style={styles.sectionHeader}>
          <IconSymbol name="play.fill" size={24} color="#4285F4" />
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            {t('rules.howToPlay.title', { locale })}
          </ThemedText>
        </View>
        <View style={styles.stepList}>
          <View style={styles.step}>
            <View style={[styles.stepNumber, { backgroundColor: '#4CAF50' }]}>
              <ThemedText style={styles.stepNumberText}>1</ThemedText>
            </View>
            <ThemedText style={styles.stepText}>
              <ThemedText style={styles.stepTitle}>{t('rules.howToPlay.step1.title', { locale })}</ThemedText>
              {'\n'}{t('rules.howToPlay.step1.description', { locale })}
            </ThemedText>
          </View>
          
          <View style={styles.step}>
            <View style={[styles.stepNumber, { backgroundColor: '#2196F3' }]}>
              <ThemedText style={styles.stepNumberText}>2</ThemedText>
            </View>
            <ThemedText style={styles.stepText}>
              <ThemedText style={styles.stepTitle}>{t('rules.howToPlay.step2.title', { locale })}</ThemedText>
              {'\n'}{t('rules.howToPlay.step2.description', { locale })}
            </ThemedText>
          </View>
          
          <View style={styles.step}>
            <View style={[styles.stepNumber, { backgroundColor: '#FF9800' }]}>
              <ThemedText style={styles.stepNumberText}>3</ThemedText>
            </View>
            <ThemedText style={styles.stepText}>
              <ThemedText style={styles.stepTitle}>{t('rules.howToPlay.step3.title', { locale })}</ThemedText>
              {'\n'}{t('rules.howToPlay.step3.description', { locale })}
            </ThemedText>
          </View>
          
          <View style={styles.step}>
            <View style={[styles.stepNumber, { backgroundColor: '#9C27B0' }]}>
              <ThemedText style={styles.stepNumberText}>4</ThemedText>
            </View>
            <ThemedText style={styles.stepText}>
              <ThemedText style={styles.stepTitle}>{t('rules.howToPlay.step4.title', { locale })}</ThemedText>
              {'\n'}{t('rules.howToPlay.step4.description', { locale })}
            </ThemedText>
          </View>
          
          <View style={styles.step}>
            <View style={[styles.stepNumber, { backgroundColor: '#F44336' }]}>
              <ThemedText style={styles.stepNumberText}>5</ThemedText>
            </View>
            <ThemedText style={styles.stepText}>
              <ThemedText style={styles.stepTitle}>{t('rules.howToPlay.step5.title', { locale })}</ThemedText>
              {'\n'}{t('rules.howToPlay.step5.description', { locale })}
            </ThemedText>
          </View>
        </View>
      </View>

      {/* Scoring System */}
      <View style={[styles.section, { backgroundColor: isDark ? '#2a2a2a' : '#f8f9fa' }]}>
        <View style={styles.sectionHeader}>
          <IconSymbol name="trophy.fill" size={24} color="#FFD700" />
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            {t('rules.scoring.title', { locale })}
          </ThemedText>
        </View>
        <View style={styles.scoringList}>
          <View style={styles.scoringItem}>
            <View style={[styles.scoringBadge, { backgroundColor: '#4CAF50' }]}>
              <ThemedText style={styles.scoringBadgeText}>{t('rules.scoring.comments.badge', { locale })}</ThemedText>
            </View>
            <ThemedText style={styles.scoringText}>
              <ThemedText style={styles.scoringTitle}>{t('rules.scoring.comments.title', { locale })}</ThemedText>
              {'\n'}{t('rules.scoring.comments.description', { locale })}
            </ThemedText>
          </View>
          
          <View style={styles.scoringItem}>
            <View style={[styles.scoringBadge, { backgroundColor: '#2196F3' }]}>
              <ThemedText style={styles.scoringBadgeText}>{t('rules.scoring.target.badge', { locale })}</ThemedText>
            </View>
            <ThemedText style={styles.scoringText}>
              <ThemedText style={styles.scoringTitle}>{t('rules.scoring.target.title', { locale })}</ThemedText>
              {'\n'}{t('rules.scoring.target.description', { locale })}
            </ThemedText>
          </View>
          
          <View style={styles.scoringItem}>
            <View style={[styles.scoringBadge, { backgroundColor: '#FF9800' }]}>
              <ThemedText style={styles.scoringBadgeText}>{t('rules.scoring.guessing.badge', { locale })}</ThemedText>
            </View>
            <ThemedText style={styles.scoringText}>
              <ThemedText style={styles.scoringTitle}>{t('rules.scoring.guessing.title', { locale })}</ThemedText>
              {'\n'}{t('rules.scoring.guessing.description', { locale })}
            </ThemedText>
          </View>
        </View>
      </View>

      {/* Admin Features */}
      <View style={[styles.section, { backgroundColor: isDark ? '#2a2a2a' : '#f8f9fa' }]}>
        <View style={styles.sectionHeader}>
          <IconSymbol name="crown.fill" size={24} color="#FFA500" />
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            {t('rules.admin.title', { locale })}
          </ThemedText>
        </View>
        <View style={styles.featureList}>
          <View style={styles.feature}>
            <IconSymbol name="checkmark.circle.fill" size={20} color="#4CAF50" />
            <ThemedText style={styles.featureText}>
              {t('rules.admin.feature1', { locale })}
            </ThemedText>
          </View>
          <View style={styles.feature}>
            <IconSymbol name="checkmark.circle.fill" size={20} color="#4CAF50" />
            <ThemedText style={styles.featureText}>
              {t('rules.admin.feature2', { locale })}
            </ThemedText>
          </View>
          <View style={styles.feature}>
            <IconSymbol name="checkmark.circle.fill" size={20} color="#4CAF50" />
            <ThemedText style={styles.featureText}>
              {t('rules.admin.feature3', { locale })}
            </ThemedText>
          </View>
          <View style={styles.feature}>
            <IconSymbol name="checkmark.circle.fill" size={20} color="#4CAF50" />
            <ThemedText style={styles.featureText}>
              {t('rules.admin.feature4', { locale })}
            </ThemedText>
          </View>
        </View>
      </View>

      {/* Tips */}
      <View style={[styles.section, { backgroundColor: isDark ? '#2a2a2a' : '#f8f9fa' }]}>
        <View style={styles.sectionHeader}>
          <IconSymbol name="lightbulb.fill" size={24} color="#FFD700" />
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            {t('rules.tips.title', { locale })}
          </ThemedText>
        </View>
        <View style={styles.tipsList}>
          <ThemedText style={styles.tip}>
            💡 <ThemedText style={styles.tipText}>{t('rules.tips.tip1', { locale })}</ThemedText>
          </ThemedText>
          <ThemedText style={styles.tip}>
            💡 <ThemedText style={styles.tipText}>{t('rules.tips.tip2', { locale })}</ThemedText>
          </ThemedText>
          <ThemedText style={styles.tip}>
            💡 <ThemedText style={styles.tipText}>{t('rules.tips.tip3', { locale })}</ThemedText>
          </ThemedText>
          <ThemedText style={styles.tip}>
            💡 <ThemedText style={styles.tipText}>{t('rules.tips.tip4', { locale })}</ThemedText>
          </ThemedText>
          <ThemedText style={styles.tip}>
            💡 <ThemedText style={styles.tipText}>{t('rules.tips.tip5', { locale })}</ThemedText>
          </ThemedText>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <ThemedText style={styles.footerText}>
          {t('rules.footer', { locale })}
        </ThemedText>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  headerLogoContainer: { 
    height: 60, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 20,
    backgroundColor: 'transparent',
  },
  headerLogo: {
    width: 40,
    height: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
    paddingTop: 20,
  },
  headerIcon: {
    marginBottom: 16,
    opacity: 0.8,
  },
  title: {
    textAlign: 'center',
    marginBottom: 8,
    fontSize: 28,
  },
  subtitle: {
    textAlign: 'center',
    opacity: 0.7,
    fontSize: 16,
  },
  languageSelector: {
    marginTop: 12,
  },
  section: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    marginLeft: 12,
    fontSize: 20,
    fontWeight: '700',
  },
  sectionText: {
    fontSize: 16,
    lineHeight: 24,
    opacity: 0.8,
  },
  stepList: {
    gap: 16,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  stepNumberText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  stepText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  stepTitle: {
    fontWeight: '700',
    fontSize: 16,
  },
  scoringList: {
    gap: 16,
  },
  scoringItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  scoringBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  scoringBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  scoringText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  scoringTitle: {
    fontWeight: '700',
    fontSize: 16,
  },
  featureList: {
    gap: 12,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    fontSize: 15,
    lineHeight: 22,
    flex: 1,
  },
  tipsList: {
    gap: 12,
  },
  tip: {
    fontSize: 15,
    lineHeight: 22,
  },
  tipText: {
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 20,
  },
  footerText: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    opacity: 0.8,
  },
});
