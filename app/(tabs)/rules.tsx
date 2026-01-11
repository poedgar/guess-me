import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColorScheme } from '@/hooks/use-color-scheme';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

export default function RulesScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Header */}
      <View style={styles.header}>
        <IconSymbol 
          name="book.fill" 
          size={60} 
          color="#4CAF50" 
          style={styles.headerIcon}
        />
        <ThemedText type="title" style={styles.title}>
          Правила гри 🎮
        </ThemedText>
        <ThemedText style={styles.subtitle}>
          Все, що потрібно знати для перемоги
        </ThemedText>
      </View>

      {/* Game Overview */}
      <View style={[styles.section, { backgroundColor: isDark ? '#2a2a2a' : '#f8f9fa' }]}>
        <View style={styles.sectionHeader}>
          <IconSymbol name="star.fill" size={24} color="#FFA500" />
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Про гру
          </ThemedText>
        </View>
        <ThemedText style={styles.sectionText}>
          Це соціальна гра, де учасники пишуть анонімні коментарі один про одного, 
          вгадують авторів та заробляють бали. Адміністратор керує гроєю та визначає, 
          чи бере участь у написанні коментарів.
        </ThemedText>
      </View>

      {/* How to Play */}
      <View style={[styles.section, { backgroundColor: isDark ? '#2a2a2a' : '#f8f9fa' }]}>
        <View style={styles.sectionHeader}>
          <IconSymbol name="play.fill" size={24} color="#4285F4" />
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Як грати
          </ThemedText>
        </View>
        <View style={styles.stepList}>
          <View style={styles.step}>
            <View style={[styles.stepNumber, { backgroundColor: '#4CAF50' }]}>
              <ThemedText style={styles.stepNumberText}>1</ThemedText>
            </View>
            <ThemedText style={styles.stepText}>
              <ThemedText style={styles.stepTitle}>Створіть або приєднайтеся до гри</ThemedText>
              {'\n'}Адміністратор створює гру паролем, інші приєднуються за ID.
            </ThemedText>
          </View>
          
          <View style={styles.step}>
            <View style={[styles.stepNumber, { backgroundColor: '#2196F3' }]}>
              <ThemedText style={styles.stepNumberText}>2</ThemedText>
            </View>
            <ThemedText style={styles.stepText}>
              <ThemedText style={styles.stepTitle}>Напишіть коментар</ThemedText>
              {'\n'}Коли ви обрані ціллю, інші учасники пишуть анонімні коментарі про вас.
            </ThemedText>
          </View>
          
          <View style={styles.step}>
            <View style={[styles.stepNumber, { backgroundColor: '#FF9800' }]}>
              <ThemedText style={styles.stepNumberText}>3</ThemedText>
            </View>
            <ThemedText style={styles.stepText}>
              <ThemedText style={styles.stepTitle}>Оцініть коментарі</ThemedText>
              {'\n'}Адміністратор показує коментарі та нараховує бали (0-10) за кожен.
            </ThemedText>
          </View>
          
          <View style={styles.step}>
            <View style={[styles.stepNumber, { backgroundColor: '#9C27B0' }]}>
              <ThemedText style={styles.stepNumberText}>4</ThemedText>
            </View>
            <ThemedText style={styles.stepText}>
              <ThemedText style={styles.stepTitle}>Вгадайте автора</ThemedText>
              {'\n'}Спробуйте вгадати, хто написав кожен коментар про ціль.
            </ThemedText>
          </View>
          
          <View style={styles.step}>
            <View style={[styles.stepNumber, { backgroundColor: '#F44336' }]}>
              <ThemedText style={styles.stepNumberText}>5</ThemedText>
            </View>
            <ThemedText style={styles.stepText}>
              <ThemedText style={styles.stepTitle}>Наступний раунд</ThemedText>
              {'\n'}Гра продовжується з новою ціллю, поки всі не побувають ціллю.
            </ThemedText>
          </View>
        </View>
      </View>

      {/* Scoring System */}
      <View style={[styles.section, { backgroundColor: isDark ? '#2a2a2a' : '#f8f9fa' }]}>
        <View style={styles.sectionHeader}>
          <IconSymbol name="trophy.fill" size={24} color="#FFD700" />
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Система очок
          </ThemedText>
        </View>
        <View style={styles.scoringList}>
          <View style={styles.scoringItem}>
            <View style={[styles.scoringBadge, { backgroundColor: '#4CAF50' }]}>
              <ThemedText style={styles.scoringBadgeText}>Коментарі</ThemedText>
            </View>
            <ThemedText style={styles.scoringText}>
              <ThemedText style={styles.scoringTitle}>Бали за коментарі</ThemedText>
              {'\n'}Адміністратор нараховує 0-10 балів за кожен коментар про вас.
            </ThemedText>
          </View>
          
          <View style={styles.scoringItem}>
            <View style={[styles.scoringBadge, { backgroundColor: '#2196F3' }]}>
              <ThemedText style={styles.scoringBadgeText}>Ціль</ThemedText>
            </View>
            <ThemedText style={styles.scoringText}>
              <ThemedText style={styles.scoringTitle}>Бали за ціль</ThemedText>
              {'\n'}Кожен учасник може дати бали цільовому гравцю (0-10).
            </ThemedText>
          </View>
          
          <View style={styles.scoringItem}>
            <View style={[styles.scoringBadge, { backgroundColor: '#FF9800' }]}>
              <ThemedText style={styles.scoringBadgeText}>Вгадування</ThemedText>
            </View>
            <ThemedText style={styles.scoringText}>
              <ThemedText style={styles.scoringTitle}>Бали за вгадування</ThemedText>
              {'\n'}+1 бал за кожен правильно вгаданий автора коментаря.
            </ThemedText>
          </View>
        </View>
      </View>

      {/* Admin Features */}
      <View style={[styles.section, { backgroundColor: isDark ? '#2a2a2a' : '#f8f9fa' }]}>
        <View style={styles.sectionHeader}>
          <IconSymbol name="crown.fill" size={24} color="#FFA500" />
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Функції адміністратора
          </ThemedText>
        </View>
        <View style={styles.featureList}>
          <View style={styles.feature}>
            <IconSymbol name="checkmark.circle.fill" size={20} color="#4CAF50" />
            <ThemedText style={styles.featureText}>
              Створення гри та управління учасниками
            </ThemedText>
          </View>
          <View style={styles.feature}>
            <IconSymbol name="checkmark.circle.fill" size={20} color="#4CAF50" />
            <ThemedText style={styles.featureText}>
              Оцінка коментарів (0-10 балів)
            </ThemedText>
          </View>
          <View style={styles.feature}>
            <IconSymbol name="checkmark.circle.fill" size={20} color="#4CAF50" />
            <ThemedText style={styles.featureText}>
              Контроль раундів та фаз гри
            </ThemedText>
          </View>
          <View style={styles.feature}>
            <IconSymbol name="checkmark.circle.fill" size={20} color="#4CAF50" />
            <ThemedText style={styles.featureText}>
              Можливість брати участь у коментарях (налаштовується)
            </ThemedText>
          </View>
        </View>
      </View>

      {/* Tips */}
      <View style={[styles.section, { backgroundColor: isDark ? '#2a2a2a' : '#f8f9fa' }]}>
        <View style={styles.sectionHeader}>
          <IconSymbol name="lightbulb.fill" size={24} color="#FFD700" />
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Поради для перемоги
          </ThemedText>
        </View>
        <View style={styles.tipsList}>
          <ThemedText style={styles.tip}>
            💡 <ThemedText style={styles.tipText}>Пишіть цікаві та оригінальні коментарі</ThemedText>
          </ThemedText>
          <ThemedText style={styles.tip}>
            💡 <ThemedText style={styles.tipText}>Аналізуйте стиль написання інших гравців</ThemedText>
          </ThemedText>
          <ThemedText style={styles.tip}>
            💡 <ThemedText style={styles.tipText}>Будьте об'єктивними при оцінці коментарів</ThemedText>
          </ThemedText>
          <ThemedText style={styles.tip}>
            💡 <ThemedText style={styles.tipText}>Уважно читайте коментарі перед вгадуванням</ThemedText>
          </ThemedText>
          <ThemedText style={styles.tip}>
            💡 <ThemedText style={styles.tipText}>Пам'ятайте, що коментарі анонімні</ThemedText>
          </ThemedText>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <ThemedText style={styles.footerText}>
          Гарної гри та вдалих вгадувань! 🎯
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
