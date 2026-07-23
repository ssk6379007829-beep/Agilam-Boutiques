/**
 * Inspire-feed audio coordinator.
 *
 * Instagram-style rules for the feed's songs, kept in one place so every card
 * obeys them:
 *
 *   • Sound is off until the buyer opts in. Browsers block audible autoplay
 *     until a user gesture, and a feed that blares on open is hostile — so a
 *     card only ever plays once the buyer taps a music pill.
 *   • One clip at a time. Whichever card the buyer last turned on (or scrolled
 *     into view while sound is on) is the single "current" card; every other
 *     card stays silent.
 *
 * This is a tiny observable singleton: cards read `soundOn`/`currentId`, react
 * to changes via `subscribe`, and drive their own `<audio>` element from that.
 * State is in-memory — a full reload resets to muted, which is the right default.
 */

type Listener = () => void;

let soundOn = false;
let currentId: string | null = null;
const listeners = new Set<Listener>();

function emit() {
  for (const fn of listeners) fn();
}

/** React to any change in sound/current state. Returns an unsubscribe. */
export function subscribeFeedAudio(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function isFeedSoundOn(): boolean {
  return soundOn;
}

export function getCurrentAudioId(): string | null {
  return currentId;
}

/** Turn the feed's sound on or off for every card at once. */
export function setFeedSoundOn(on: boolean): void {
  if (soundOn === on) return;
  soundOn = on;
  emit();
}

/** Make `id` the single card allowed to play. Pass null for "none". */
export function setCurrentAudioId(id: string | null): void {
  if (currentId === id) return;
  currentId = id;
  emit();
}

/**
 * The buyer tapped a card's music pill.
 *   • Sound off            → turn it on and make this card the one that plays.
 *   • On, but another card → switch the song to this card (stays on).
 *   • On, and this card    → turn the sound back off.
 */
export function toggleFeedAudio(id: string): void {
  if (soundOn && currentId === id) {
    soundOn = false;
  } else {
    currentId = id;
    soundOn = true;
  }
  emit();
}
