/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ProtocolDetectionResponse } from '@/common/utils/protocolDetector';
import { ipcBridge } from '@/common';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Protocol detection hook configuration
 */
interface UseProtocolDetectionOptions {
  /** / Debounce delay in milliseconds*/
  debounceMs?: number;
  /*Whether to auto-detect*/
  autoDetect?: boolean;
  /** / Timeout in milliseconds*/
  timeout?: number;
  /*Whether to test all keys*/
  testAllKeys?: boolean;
}

/**
 * Protocol detection hook return value
 */
interface UseProtocolDetectionResult {
  /*Whether detecting*/
  isDetecting: boolean;
  /*Detection result*/
  result: ProtocolDetectionResponse | null;
  /*Error message*/
  error: string | null;
  /*Manually trigger detection*/
  detect: (baseUrl: string, apiKey: string) => Promise<void>;
  /*Reset state*/
  reset: () => void;
}

/**
 * Protocol Detection Hook
 *
 * Used to auto-detect the protocol type used by an API endpoint
 *
 * @param baseUrl - Base URL
 * @param apiKey - API Key
 * @param options
 */
export function useProtocolDetection(
  baseUrl: string,
  apiKey: string,
  options: UseProtocolDetectionOptions = {}
): UseProtocolDetectionResult {
  const { debounceMs = 800, autoDetect = true, timeout = 10000, testAllKeys = false } = options;

  const [isDetecting, setIsDetecting] = useState(false);
  const [result, setResult] = useState<ProtocolDetectionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const requestVersionRef = useRef(0);

  /**
   * Execute protocol detection
   */
  const detect = useCallback(
    async (url: string, key: string) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

      if (!url || !key) {
        setResult(null);
        setError(null);
        return;
      }

      const currentVersion = ++requestVersionRef.current;

      setIsDetecting(true);
      setError(null);

      try {
        const response = await ipcBridge.mode.detectProtocol.invoke({
          baseUrl: url,
          apiKey: key,
          timeout,
          testAllKeys,
        });

        if (currentVersion !== requestVersionRef.current) {
          return;
        }

        if (response.success && response.data) {
          setResult(response.data);
          setError(null);
        } else {
          setResult(response.data || null);
          setError(response.msg || 'Detection failed');
        }
      } catch (e: any) {
        if (currentVersion !== requestVersionRef.current) {
          return;
        }

        setResult(null);
        setError(e.message || String(e));
      } finally {
        if (currentVersion === requestVersionRef.current) {
          setIsDetecting(false);
        }
      }
    },
    [timeout, testAllKeys]
  );

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    requestVersionRef.current++;
    setIsDetecting(false);
    setResult(null);
    setError(null);
  }, []);

  /**
   * Auto-detect with debounce
   */
  useEffect(() => {
    if (!autoDetect) {
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!baseUrl || !apiKey) {
      setResult(null);
      setError(null);
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      void detect(baseUrl, apiKey);
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [baseUrl, apiKey, autoDetect, debounceMs, detect]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      requestVersionRef.current++;
    };
  }, []);

  return {
    isDetecting,
    result,
    error,
    detect,
    reset,
  };
}

export default useProtocolDetection;
