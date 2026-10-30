import { useEffect, useRef } from 'react';
import type { LumenEvents } from '~shared/types';

/** Subscribes to a main-process event for the component's lifetime. */
export function useLumenEvent<K extends keyof LumenEvents>(channel: K, listener: (payload: LumenEvents[K]) => void) {
  const latest = useRef(listener);
  useEffect(() => {
    latest.current = listener;
  });
  useEffect(() => window.lumen.on(channel, (payload) => latest.current(payload)), [channel]);
}
