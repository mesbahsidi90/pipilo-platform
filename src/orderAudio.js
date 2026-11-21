export function handleReadyPush(data, ticket, armed, ring, refresh) {
  if (data?.type !== 'ORDER_READY' || data.ticket !== ticket) return;
  // Delivery in the background is not an acknowledgement that audio was heard.
  if (armed) ring();
  refresh?.();
}

// A user-unlocked Web Audio session remains available between the sample and
// the ready event. No microphone permission is required.
export function createOrderAudio(url, env = globalThis) {
  const Context = env.AudioContext || env.webkitAudioContext;
  if (!Context) {
    const audio = new env.Audio(url);
    audio.dispose = () => audio.pause();
    audio.keepAlive = () => false;
    audio.isPlaying = () => !audio.paused && !audio.ended;
    return audio;
  }
  let context = null,
    buffer = null,
    loading = null,
    source = null,
    gain = null,
    idle = null,
    generation = 0,
    disposed = false;
  const events = new EventTarget();
  const player = {
    loop: true,
    volume: 1,
    currentTime: 0,
    isPlaying: () => Boolean(source && context?.state === 'running'),
    addEventListener: (...args) => events.addEventListener(...args),
    async play() {
      if (disposed) throw new Error('Audio session closed');
      const own = ++generation;
      // Called synchronously from the enable button, before network awaits.
      try {
        if (env.navigator?.audioSession) env.navigator.audioSession.type = 'playback';
      } catch {}
      context ??= new Context();
      const resume = context.state === 'running' ? Promise.resolve() : context.resume();
      loading ??= env
        .fetch(url)
        .then((r) => {
          if (!r.ok) throw new Error('Audio unavailable');
          return r.arrayBuffer();
        })
        .then((bytes) => context.decodeAudioData(bytes))
        .then((value) => (buffer = value))
        .catch((error) => {
          loading = null;
          throw error;
        });
      let timeout;
      try {
        await Promise.all([
          Promise.race([
            resume,
            new Promise((_, reject) => {
              timeout = setTimeout(() => reject(new Error('Audio requires a tap')), 2500);
            }),
          ]),
          loading,
        ]);
      } finally {
        clearTimeout(timeout);
      }
      if (disposed || own !== generation) throw new Error('Audio cancelled');
      if (context.state !== 'running') throw new Error('Audio session suspended');
      if (source) {
        source.onended = null;
        source.stop();
        source.disconnect();
        gain?.disconnect();
      }
      const next = context.createBufferSource();
      source = next;
      gain = context.createGain();
      next.buffer = buffer;
      next.loop = player.loop;
      gain.gain.value = player.volume;
      next.connect(gain);
      gain.connect(context.destination);
      next.onended = () => {
        if (source !== next) return;
        source = null;
        events.dispatchEvent(new Event('ended'));
      };
      next.start(0);
    },
    pause() {
      generation++;
      if (source) {
        source.onended = null;
        try {
          source.stop();
          source.disconnect();
          gain?.disconnect();
        } catch {}
        source = null;
      }
      events.dispatchEvent(new Event('pause'));
    },
    // iPhone Safari freezes a locked page unless it is playing sound. A very
    // quiet loop keeps the page awake while the customer waits, so the ready
    // ring can start; it never plays before the customer's own tap.
    keepAlive(on) {
      if (!on || disposed) {
        if (idle) {
          idle.onended = null;
          try {
            idle.stop();
            idle.disconnect();
          } catch {}
          idle = null;
        }
        return false;
      }
      if (idle || context?.state !== 'running') return Boolean(idle);
      const length = context.sampleRate;
      const quiet = context.createBuffer(1, length, context.sampleRate);
      const data = quiet.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * 0.0004;
      idle = context.createBufferSource();
      idle.buffer = quiet;
      idle.loop = true;
      idle.connect(context.destination);
      idle.start(0);
      return true;
    },
    dispose() {
      disposed = true;
      player.keepAlive(false);
      player.pause();
      context?.close().catch(() => {});
    },
  };
  return player;
}
