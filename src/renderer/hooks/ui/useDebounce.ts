import type React from 'react';
import { useCallback, useEffect, useRef } from 'react';

/**
 * @param callback
 * @param delay
 * @returns
 */
function useDebounce<T extends (...args: any[]) => any>(callback: T, delay: number, deps: React.DependencyList): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, [clearTimer]);

  const debouncedFunction = useCallback(
    (...args: Parameters<T>) => {
      clearTimer();
      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [delay, clearTimer, ...deps]
  );

  return debouncedFunction as T;
}

export default useDebounce;
