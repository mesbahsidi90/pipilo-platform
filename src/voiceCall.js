import { callClips } from './voiceNumbers';

// Plays «الطلب رقم 57 جاهز» from recorded clips (public/voice/ar), one call
// after another. Needs one tap on the TV to unlock sound, like the ring.
const pauseAfter = { order: 0.14 };
const pauseBefore = { ready: 0.16 };

export function createVoiceCaller({ base = '/voice/ar/', env = globalThis } = {}) {
  const Context = env.AudioContext || env.webkitAudioContext;
  let context = null;
  let disposed = false;
  let queue = Promise.resolve();
  const cache = new Map();

  const load = (key) => {
    if (!cache.has(key))
      cache.set(
        key,
        env
          .fetch(base + key + '.wav')
          .then((response) => {
            if (!response.ok) throw new Error('Voice clip unavailable');
            return response.arrayBuffer();
          })
          .then((bytes) => context.decodeAudioData(bytes))
          .catch((error) => {
            cache.delete(key);
            throw error;
          }),
      );
    return cache.get(key);
  };

  async function ready() {
    if (disposed || !Context) return false;
    context ??= new Context();
    if (context.state !== 'running') await context.resume().catch(() => {});
    return context.state === 'running';
  }

  // Plays one call; resolves when it has finished speaking.
  async function sayOne(number) {
    const keys = callClips(number);
    if (!keys || !(await ready())) return false;
    const buffers = await Promise.all(keys.map(load));
    let at = context.currentTime + 0.05;
    buffers.forEach((buffer, i) => {
      at += pauseBefore[keys[i]] || 0;
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      source.start(at);
      at += buffer.duration + (pauseAfter[keys[i]] ?? 0.03);
    });
    const seconds = at - context.currentTime;
    await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
    return true;
  }

  return {
    // Call from a tap: unlocks sound on TV browsers.
    unlock: ready,
    // Says each number in turn; false when sound or clips are unavailable.
    say(numbers) {
      const run = queue.then(async () => {
        let ok = true;
        for (const number of numbers.slice(0, 4)) ok = (await sayOne(number)) && ok;
        return ok;
      });
      queue = run.catch(() => false);
      return run.catch(() => false);
    },
    dispose() {
      disposed = true;
      context?.close?.().catch?.(() => {});
    },
  };
}
