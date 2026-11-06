/**
 * What a native command rejects with. Core rejects with a typed, serializable CommandError:
 * `{ code: string, message: string, retryable: boolean }`.
 */
export interface CommandErrorPayload {
  code: string;
  message: string;
  retryable?: boolean;
}

export class NativeError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(payload: CommandErrorPayload) {
    super(payload.message || `Command failed with code ${payload.code}`);
    this.name = 'NativeError';
    this.code = payload.code;
    this.retryable = Boolean(payload.retryable);
  }
}

/**
 * Normalizes what a native command rejects with:
 * A typed CommandError (`{ code, message, retryable }`), a shell string, or an Error instance.
 */
export function toNativeError(error: unknown, fallbackMessage = 'Command invocation failed'): NativeError {
  if (error instanceof NativeError) return error;

  if (error && typeof error === 'object') {
    const obj = error as Record<string, unknown>;
    if (typeof obj.code === 'string' && typeof obj.message === 'string') {
      return new NativeError({
        code: obj.code,
        message: obj.message,
        retryable: typeof obj.retryable === 'boolean' ? obj.retryable : false,
      });
    }
    if (typeof obj.message === 'string') {
      return new NativeError({
        code: 'SHELL_ERROR',
        message: obj.message,
        retryable: false,
      });
    }
  }

  if (typeof error === 'string') {
    return new NativeError({
      code: 'SHELL_ERROR',
      message: error,
      retryable: false,
    });
  }

  return new NativeError({
    code: 'UNKNOWN_ERROR',
    message: fallbackMessage,
    retryable: false,
  });
}
