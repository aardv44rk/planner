/**
 * Single IPC Gateway for LifeOS Command Center.
 * Wraps `@tauri-apps/api/core` `invoke` to provide:
 * 1. Dev-mode duration and error tracing
 * 2. Typed `NativeError` normalization
 * 3. Strict abstraction layer over Tauri IPC
 */
import { invoke as tauriInvoke, type InvokeArgs, type InvokeOptions } from '@tauri-apps/api/core';
import { toNativeError } from '../platform/native-error';
import { traceEvent } from './interaction-trace';

export * from '@tauri-apps/api/core';

export async function invoke<T>(cmd: string, args?: InvokeArgs, options?: InvokeOptions): Promise<T> {
  const started = performance.now();
  try {
    const result = await tauriInvoke<T>(cmd, args, options);
    const elapsedMs = Math.round(performance.now() - started);
    traceEvent('ipc:ok', { cmd, ms: elapsedMs, args });
    return result;
  } catch (rawError) {
    const nativeErr = toNativeError(rawError, `${cmd} failed`);
    const elapsedMs = Math.round(performance.now() - started);
    traceEvent('ipc:err', {
      cmd,
      ms: elapsedMs,
      code: nativeErr.code,
      message: nativeErr.message,
      args,
    });
    throw nativeErr;
  }
}
