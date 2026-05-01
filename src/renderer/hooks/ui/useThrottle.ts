import type React from 'react';
import { useCallback, useRef } from 'react';

/**
 * @param callback
 * @param delay
 * @returns
 */
function useThrottle<T extends (...args: any[]) => any>(callback: T, delay: number, deps: React.DependencyList): T {
  const lastExecTime = useRef<number>(0);
  const timeoutId = useRef<NodeJS.Timeout | null>(null);

  const throttledFunction = useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();
      const timeSinceLastExec = now - lastExecTime.current;

      if (timeSinceLastExec >= delay) {
        callback(...args);
        lastExecTime.current = now;
      } else {
        if (timeoutId.current) {
          clearTimeout(timeoutId.current);
        }

        timeoutId.current = setTimeout(() => {
          callback(...args);
          lastExecTime.current = Date.now();
          timeoutId.current = null;
        }, delay - timeSinceLastExec);
      }
    },
    [delay, ...deps]
  );

  return throttledFunction as T;
}

export default useThrottle;
