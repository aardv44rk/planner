import { describe, it, expect } from 'vitest';
import { NativeError, toNativeError } from '../../src/platform/native-error';

describe('NativeError normalization', () => {
  it('normalizes structured CommandError JSON from Rust', () => {
    const rawRustError = {
      code: 'NETWORK_TIMEOUT',
      message: 'Connection timed out while querying LMS',
      retryable: true,
    };
    const err = toNativeError(rawRustError);
    expect(err).toBeInstanceOf(NativeError);
    expect(err.code).toBe('NETWORK_TIMEOUT');
    expect(err.message).toBe('Connection timed out while querying LMS');
    expect(err.retryable).toBe(true);
  });

  it('normalizes plain string errors to SHELL_ERROR', () => {
    const err = toNativeError('database locked');
    expect(err).toBeInstanceOf(NativeError);
    expect(err.code).toBe('SHELL_ERROR');
    expect(err.message).toBe('database locked');
    expect(err.retryable).toBe(false);
  });

  it('normalizes standard JavaScript Error instances', () => {
    const err = toNativeError(new Error('SyntaxError: unexpected token'));
    expect(err.code).toBe('SHELL_ERROR');
    expect(err.message).toBe('SyntaxError: unexpected token');
  });

  it('preserves existing NativeError instances without double-wrapping', () => {
    const original = new NativeError({
      code: 'NOT_FOUND',
      message: 'Assignment not found',
      retryable: false,
    });
    const normalized = toNativeError(original);
    expect(normalized).toBe(original);
  });

  it('uses fallback message on null or undefined errors', () => {
    const err = toNativeError(null, 'Custom fallback error');
    expect(err.code).toBe('UNKNOWN_ERROR');
    expect(err.message).toBe('Custom fallback error');
  });
});
