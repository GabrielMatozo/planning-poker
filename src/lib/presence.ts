export const ONLINE_WINDOW_MS = 60_000;
export const REMOVABLE_AFTER_MS = 300_000;

type PresenceState = { online: boolean; lastSeen: number | null };
type HostCandidate = PresenceState & { uid: string; joinedAt: number };
type RemovableCandidate = PresenceState & { hasVoted: boolean };

function lastSeenOf(presence: PresenceState): number {
  return presence.lastSeen ?? 0;
}

export function isOnline(presence: PresenceState, now: number): boolean {
  return now - lastSeenOf(presence) <= ONLINE_WINDOW_MS;
}

export function pickNextHost(participants: readonly HostCandidate[], now: number, currentHostId: string): string | null {
  const candidates = participants
    .filter((participant) => participant.uid !== currentHostId && isOnline(participant, now))
    .sort((a, b) => a.joinedAt - b.joinedAt || a.uid.localeCompare(b.uid));

  return candidates[0]?.uid ?? null;
}

export function isRemovable(participant: RemovableCandidate, now: number): boolean {
  if (participant.hasVoted) return false;
  if (isOnline(participant, now)) return false;
  return now - lastSeenOf(participant) > REMOVABLE_AFTER_MS;
}
