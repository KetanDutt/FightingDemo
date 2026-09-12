import { ANIMS } from '../config/constants.js';

/**
 * Metadata for every animation in the monkey sprite library.
 *
 * `frameRate` is tuned per clip (the original prototype ran everything at
 * 30fps, which made the idle/walk cycles look frantic). Durations below are
 * derived and shown in the gallery so the team can see timing at a glance.
 */
export const ANIMATION_DATA = [
  {
    key: ANIMS.IDLE,
    label: 'Idle',
    description: 'Neutral stance. Loops seamlessly and is the pose the fighter returns to.',
    frameRate: 24,
    loop: true,
  },
  {
    key: ANIMS.MOVE_FORWARD,
    label: 'Advance',
    description: 'Walking towards the opponent. Used for closing the gap.',
    frameRate: 26,
    loop: true,
  },
  {
    key: ANIMS.MOVE_BACK,
    label: 'Retreat',
    description: 'Backpedalling away from danger. Slightly slower than advancing.',
    frameRate: 26,
    loop: true,
  },
  {
    key: ANIMS.JUMP,
    label: 'Jump',
    description: 'Leap with the arc baked into the frames — airborne frames dodge attacks.',
    frameRate: 30,
    loop: false,
  },
  {
    key: ANIMS.PUNCH,
    label: 'Punch',
    description: 'Fast light attack. Low damage, very short recovery.',
    frameRate: 30,
    loop: false,
  },
  {
    key: ANIMS.HEAD,
    label: 'Headbutt',
    description: 'Medium attack. Slower than a punch but hits harder and lunges forward.',
    frameRate: 30,
    loop: false,
  },
  {
    key: ANIMS.STOMP,
    label: 'Stomp',
    description: 'Heavy attack. Big damage and a knock down, but heavily punishable.',
    frameRate: 30,
    loop: false,
  },
  {
    key: ANIMS.BLOCK,
    label: 'Block',
    description: 'Guard stance. Held while the block input is down and loops.',
    frameRate: 26,
    loop: true,
  },
  {
    key: ANIMS.HIT,
    label: 'Hurt',
    description: 'Hit reaction. Plays once and holds on the final frame.',
    frameRate: 30,
    loop: false,
  },
  {
    key: ANIMS.DIE,
    label: 'Defeat',
    description: 'Knock out. Played on the final hit of a round (reversed for get-up).',
    frameRate: 30,
    loop: false,
  },
];

const BY_KEY = new Map(ANIMATION_DATA.map((entry) => [entry.key, entry]));

export function getAnimationData(key) {
  return BY_KEY.get(key) ?? null;
}

/** Duration of one play-through in milliseconds. */
export function animationDuration(key, frameCount = 0) {
  const data = BY_KEY.get(key);
  if (!data || !frameCount) return 0;
  return (frameCount / data.frameRate) * 1000;
}
