import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useGame, Game } from '../contexts/GameContext';
import { useAlert } from '../hooks/useAlert';
import { AuthScreen } from '../components/auth/AuthScreen';

function toDisplayDate(value: unknown): string {
  if (!value) return '—';
  if (value instanceof Date) return value.toLocaleString();
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate().toLocaleString();
  }
  return '—';
}

export function AdminCleanupPage() {
  const { isSignedIn } = useAuth();
  const { listAllGames, deleteGames, checkAdminPassword } = useGame();
  const { showAlert, AlertModal } = useAlert();

  const [passwordInput, setPasswordInput] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [checkingPassword, setCheckingPassword] = useState(false);
  const [gateError, setGateError] = useState<string | null>(null);

  const [threshold, setThreshold] = useState(4);
  const [scanning, setScanning] = useState(false);
  const [candidates, setCandidates] = useState<Game[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  if (!isSignedIn) {
    return <AuthScreen />;
  }

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckingPassword(true);
    setGateError(null);
    try {
      const ok = await checkAdminPassword(passwordInput);
      if (ok) {
        setUnlocked(true);
      } else {
        setGateError('Incorrect password.');
      }
    } catch (err) {
      setGateError(
        (err instanceof Error && err.message) || 'Could not verify password.',
      );
    } finally {
      setCheckingPassword(false);
    }
  };

  if (!unlocked) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold text-center mb-6 text-gray-900 dark:text-white">
            Admin Cleanup
          </h1>
          <form onSubmit={handleUnlock} className="space-y-4">
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="Admin password"
              className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-game-blue bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
            {gateError && (
              <p className="text-sm text-game-danger text-center">{gateError}</p>
            )}
            <button
              type="submit"
              disabled={checkingPassword || !passwordInput.trim()}
              className="w-full bg-game-blue text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {checkingPassword ? 'Checking...' : 'Unlock'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const handleScan = async () => {
    setScanning(true);
    setScanError(null);
    setSelectedIds(new Set());
    try {
      const allGames = await listAllGames();
      const filtered = allGames
        .filter((g) => (g.participants?.length ?? 0) < threshold)
        .sort((a, b) => {
          const aTime =
            a.createdAt instanceof Date
              ? a.createdAt.getTime()
              : (a.createdAt as { toDate: () => Date })?.toDate?.().getTime() ?? 0;
          const bTime =
            b.createdAt instanceof Date
              ? b.createdAt.getTime()
              : (b.createdAt as { toDate: () => Date })?.toDate?.().getTime() ?? 0;
          return bTime - aTime;
        });
      setCandidates(filtered);
    } catch (err) {
      setScanError(
        (err instanceof Error && err.message) || 'Could not scan games.',
      );
      setCandidates(null);
    } finally {
      setScanning(false);
    }
  };

  const toggleSelected = (gameId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(gameId)) {
        next.delete(gameId);
      } else {
        next.add(gameId);
      }
      return next;
    });
  };

  const handleDeleteSelected = () => {
    const idsToDelete = Array.from(selectedIds);
    if (idsToDelete.length === 0) return;

    showAlert(
      'Confirm deletion',
      `Delete ${idsToDelete.length} game(s)? This cannot be undone.`,
      [
        { text: 'Cancel', onPress: () => {}, style: 'secondary' },
        {
          text: 'Delete',
          style: 'danger',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteGames(idsToDelete);
              setCandidates(
                (prev) => prev?.filter((g) => !selectedIds.has(g.id)) ?? null,
              );
              setSelectedIds(new Set());
            } catch (err) {
              setScanError(
                (err instanceof Error && err.message) || 'Could not delete games.',
              );
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

  return (
    <>
      {AlertModal}
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Admin Cleanup
        </h1>

        <div className="flex items-end gap-3">
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
              Fewer than this many participants
            </label>
            <input
              type="number"
              min={1}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value) || 1)}
              className="w-24 px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>
          <button
            type="button"
            onClick={handleScan}
            disabled={scanning}
            className="bg-game-blue text-white px-6 py-2 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {scanning ? 'Scanning...' : 'Scan'}
          </button>
        </div>

        {scanError && (
          <p className="text-sm text-game-danger">{scanError}</p>
        )}

        {candidates && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {candidates.length} game(s) found
              </p>
              <button
                type="button"
                onClick={handleDeleteSelected}
                disabled={deleting || selectedIds.size === 0}
                className="bg-game-danger text-white px-6 py-2 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {deleting
                  ? 'Deleting...'
                  : `Delete selected (${selectedIds.size})`}
              </button>
            </div>

            <div className="space-y-3">
              {candidates.map((game) => (
                <div
                  key={game.id}
                  className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 flex gap-3"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(game.id)}
                    onChange={() => toggleSelected(game.id)}
                    className="w-5 h-5 mt-1 accent-game-danger flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0 text-sm">
                    <p className="font-mono font-bold text-gray-900 dark:text-white">
                      {game.id}
                    </p>
                    <p className="text-gray-500 dark:text-gray-400">
                      Created: {toDisplayDate(game.createdAt)} · Type:{' '}
                      {game.gameType ?? 'mirror'} · Status: {game.status} ·
                      Rounds: {game.rounds?.length ?? 0}
                    </p>
                    <p className="text-gray-700 dark:text-gray-300 mt-1">
                      Admin: {game.adminName} ({game.adminEmail})
                    </p>
                    <p className="text-gray-700 dark:text-gray-300">
                      Participants ({game.participants?.length ?? 0}):{' '}
                      {game.participants
                        ?.map((p) => `${p.userName} (${p.userEmail})`)
                        .join(', ') || 'none'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
