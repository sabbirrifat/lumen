import { animate } from 'motion/react';
import { type ReactNode, useEffect, useRef, useState } from 'react';

interface Props {
  value: number;
  duration?: number;
  children: (value: number) => ReactNode;
}

/** Eases from the previous value to `value`, rendering each frame through `children`. */
export function CountUp({ value, duration = 1.1, children }: Props) {
  const [shown, setShown] = useState(value);
  const current = useRef(value);
  useEffect(() => {
    const controls = animate(current.current, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        current.current = v;
        setShown(v);
      },
    });
    return () => controls.stop();
  }, [value, duration]);
  return <>{children(shown)}</>;
}
