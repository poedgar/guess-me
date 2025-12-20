import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
  Clipboard,
} from 'react-native';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/contexts/AuthContext';
import { useGame, Participant } from '@/contexts/GameContext';
import * as Haptics from 'expo-haptics';

export const GameScreen: React.FC = () => {
  const { user, isSignedIn } = useAuth();
  const { currentGame, loading, createGame, joinGame, leaveGame } = useGame();
  const [gameIdInput, setGameIdInput] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const handleCreateGame = async () => {
    if (!isSignedIn) {
      Alert.alert('Sign In Required', 'You must be signed in to create a game.');
      return;
    }

    try {
      setIsCreating(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const gameId = await createGame();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      Alert.alert(
        'Game Created!',
        `Your game ID is: ${gameId}\n\nShare this ID with others to let them join your game.`,
        [
          {
            text: 'Copy ID',
            onPress: () => {
              Clipboard.setString(gameId);
              Alert.alert('Copied!', 'Game ID copied to clipboard');
            },
          },
          { text: 'OK' },
        ]
      );
    } catch (error: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', error.message || 'Failed to create game. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinGame = async () => {
    if (!isSignedIn) {
      Alert.alert('Sign In Required', 'You must be signed in to join a game.');
      return;
    }

    const gameId = gameIdInput.trim();
    if (!gameId) {
      Alert.alert('Invalid Game ID', 'Please enter a game ID.');
      return;
    }

    try {
      setIsJoining(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await joinGame(gameId);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setGameIdInput('');
      Alert.alert('Success!', 'You have joined the game successfully!');
    } catch (error: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', error.message || 'Failed to join game. Please check the game ID and try again.');
    } finally {
      setIsJoining(false);
    }
  };

  const handleLeaveGame = async () => {
    Alert.alert(
      'Leave Game',
      'Are you sure you want to leave this game?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              await leaveGame();
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to leave game.');
            }
          },
        },
      ]
    );
  };

  const handleCopyGameId = () => {
    if (currentGame) {
      Clipboard.setString(currentGame.id);
      Alert.alert('Copied!', 'Game ID copied to clipboard');
    }
  };

  const isAdmin = currentGame?.adminId === user?.uid;

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {!isSignedIn ? (
          <View style={styles.notSignedInContainer}>
            <ThemedText type="title" style={styles.notSignedInText}>
              Please sign in to create or join games
            </ThemedText>
          </View>
        ) : currentGame ? (
          <View style={styles.gameContainer}>
            {/* Game Info */}
            <View style={styles.gameInfoCard}>
              <View style={styles.gameHeader}>
                <ThemedText type="title" style={styles.gameTitle}>
                  Game Room
                </ThemedText>
                {isAdmin && (
                  <View style={styles.adminBadge}>
                    <ThemedText style={styles.adminBadgeText}>ADMIN</ThemedText>
                  </View>
                )}
              </View>

              <View style={styles.gameIdContainer}>
                <ThemedText type="subtitle" style={styles.gameIdLabel}>
                  Game ID:
                </ThemedText>
                <TouchableOpacity
                  onPress={handleCopyGameId}
                  style={styles.gameIdBox}
                >
                  <ThemedText style={styles.gameIdText}>{currentGame.id}</ThemedText>
                  <ThemedText style={styles.copyHint}>Tap to copy</ThemedText>
                </TouchableOpacity>
              </View>

              <View style={styles.gameStatusContainer}>
                <ThemedText style={styles.statusLabel}>Status:</ThemedText>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        currentGame.status === 'waiting'
                          ? '#FFA500'
                          : currentGame.status === 'active'
                          ? '#4CAF50'
                          : '#9E9E9E',
                    },
                  ]}
                >
                  <ThemedText style={styles.statusText}>
                    {currentGame.status.toUpperCase()}
                  </ThemedText>
                </View>
              </View>

              {/* Participants */}
              <View style={styles.participantsContainer}>
                <ThemedText type="subtitle" style={styles.participantsTitle}>
                  Participants ({currentGame.participants?.length || 0})
                </ThemedText>
                {currentGame.participants?.map((participant: Participant, index: number) => (
                  <View
                    key={participant.userId}
                    style={[
                      styles.participantItem,
                      participant.userId === currentGame.adminId && styles.adminParticipant,
                    ]}
                  >
                    <View style={styles.participantInfo}>
                      <ThemedText style={styles.participantName}>
                        {participant.userName}
                        {participant.userId === currentGame.adminId && ' 👑'}
                      </ThemedText>
                      <ThemedText style={styles.participantEmail}>
                        {participant.userEmail}
                      </ThemedText>
                    </View>
                  </View>
                ))}
              </View>

              {/* Leave Game Button */}
              <TouchableOpacity
                style={[
                  styles.leaveButton,
                  {
                    backgroundColor: '#ff3b30',
                    shadowColor: '#000',
                  },
                ]}
                onPress={handleLeaveGame}
                activeOpacity={0.8}
              >
                <ThemedText style={styles.leaveButtonText}>Leave Game</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.actionContainer}>
            {/* Create Game Section */}
            <View style={styles.section}>
              <ThemedText type="title" style={styles.sectionTitle}>
                Create New Game
              </ThemedText>
              <ThemedText style={styles.sectionDescription}>
                Start a new game and become the admin. Share the game ID with others to let them join.
              </ThemedText>
              <TouchableOpacity
                style={[
                  styles.createButton,
                  {
                    backgroundColor: isDark ? Colors.dark.tint : Colors.light.tint,
                    shadowColor: '#000',
                  },
                  (isCreating || loading) && styles.buttonDisabled,
                ]}
                onPress={handleCreateGame}
                disabled={isCreating || loading}
                activeOpacity={0.8}
              >
                {isCreating ? (
                  <View style={styles.buttonLoading}>
                    <ActivityIndicator size="small" color="#fff" />
                    <ThemedText style={styles.buttonText}>Creating...</ThemedText>
                  </View>
                ) : (
                  <ThemedText style={styles.buttonText}>Create Game</ThemedText>
                )}
              </TouchableOpacity>
            </View>

            {/* Join Game Section */}
            <View style={styles.section}>
              <ThemedText type="title" style={styles.sectionTitle}>
                Join Existing Game
              </ThemedText>
              <ThemedText style={styles.sectionDescription}>
                Enter a game ID to join a game created by someone else.
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: isDark ? '#2a2a2a' : '#f5f5f5',
                    color: isDark ? Colors.dark.text : Colors.light.text,
                    borderColor: isDark ? '#444' : '#ddd',
                  },
                ]}
                placeholder="Enter Game ID"
                placeholderTextColor={isDark ? '#888' : '#999'}
                value={gameIdInput}
                onChangeText={setGameIdInput}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={[
                  styles.joinButton,
                  {
                    backgroundColor: '#4CAF50',
                    shadowColor: '#000',
                  },
                  (isJoining || loading || !gameIdInput.trim()) && styles.buttonDisabled,
                ]}
                onPress={handleJoinGame}
                disabled={isJoining || loading || !gameIdInput.trim()}
                activeOpacity={0.8}
              >
                {isJoining ? (
                  <View style={styles.buttonLoading}>
                    <ActivityIndicator size="small" color="#fff" />
                    <ThemedText style={styles.buttonText}>Joining...</ThemedText>
                  </View>
                ) : (
                  <ThemedText style={styles.buttonText}>Join Game</ThemedText>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  notSignedInContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notSignedInText: {
    textAlign: 'center',
    opacity: 0.7,
  },
  actionContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    marginBottom: 8,
  },
  sectionDescription: {
    opacity: 0.7,
    marginBottom: 16,
    fontSize: 14,
    lineHeight: 20,
  },
  input: {
    height: 50,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  createButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 8,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  joinButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 8,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonLoading: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  gameContainer: {
    flex: 1,
  },
  gameInfoCard: {
    backgroundColor: 'transparent',
  },
  gameHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  gameTitle: {
    flex: 1,
  },
  adminBadge: {
    backgroundColor: '#FFA500',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginLeft: 12,
  },
  adminBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  gameIdContainer: {
    marginBottom: 20,
  },
  gameIdLabel: {
    marginBottom: 8,
  },
  gameIdBox: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderWidth: 2,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    borderStyle: 'dashed',
  },
  gameIdText: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  copyHint: {
    fontSize: 12,
    opacity: 0.6,
  },
  gameStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  statusLabel: {
    marginRight: 12,
    fontSize: 16,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  participantsContainer: {
    marginBottom: 24,
  },
  participantsTitle: {
    marginBottom: 12,
  },
  participantItem: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  adminParticipant: {
    backgroundColor: 'rgba(255, 165, 0, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 165, 0, 0.3)',
  },
  participantInfo: {
    flex: 1,
  },
  participantName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  participantEmail: {
    fontSize: 14,
    opacity: 0.7,
  },
  leaveButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  leaveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

