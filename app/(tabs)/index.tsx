import { AuthScreen } from '@/components/auth/AuthScreen';
import { GameScreen } from '@/components/game/GameScreen';
import { useAuth } from '@/contexts/AuthContext';

export default function Index() {
  const { isSignedIn } = useAuth();

  if (!isSignedIn) {
    return <AuthScreen />;
  }
  return <GameScreen />;
}