// Work that runs after the response is sent: the second ring one minute after
// the first, unless the customer already answered «راني جاي».
declare const EdgeRuntime: { waitUntil(task: Promise<unknown>): void } | undefined;
export const SECOND_RING_MS = 60000;
export function later(task: () => Promise<unknown>, delay = SECOND_RING_MS) {
  const run = new Promise((resolve) => setTimeout(resolve, delay)).then(task).catch(() => {});
  if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(run);
  return run;
}
