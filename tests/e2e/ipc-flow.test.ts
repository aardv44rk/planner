import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { invoke } from '../../src/app/traced-tauri-core';
import { NativeError } from '../../src/platform/native-error';
import { getInteractionTrace } from '../../src/app/interaction-trace';
import { installMockIpc, teardownMockIpc } from '../harness/mock-ipc';

describe('IPC Gateway & Native Error Pipeline', () => {
  beforeEach(() => {
    teardownMockIpc();
  });

  afterEach(() => {
    teardownMockIpc();
  });

  it('routes successful commands through tracedInvoke and returns domain records', async () => {
    installMockIpc(async (cmd) => {
      if (cmd === 'get_courses') {
        return [
          {
            id: 'c1',
            code: 'TSE.A301',
            title: 'Distributed Systems',
            term: '2026-3Q',
            assignments: [],
          },
        ];
      }
      return null;
    });

    const courses = await invoke<any[]>('get_courses');
    expect(courses).toHaveLength(1);
    expect(courses[0].code).toBe('TSE.A301');

    const trace = getInteractionTrace();
    const okEvent = trace.find((t) => t.kind === 'ipc:ok' && (t.data as any)?.cmd === 'get_courses');
    expect(okEvent).toBeDefined();
  });

  it('normalizes Rust CommandError JSON into typed NativeError', async () => {
    installMockIpc(async (cmd) => {
      if (cmd === 'fetch_lms_courses') {
        throw {
          code: 'AUTH_FAILED',
          message: 'Extic Matrix challenge required',
          retryable: false,
        };
      }
      return null;
    });

    await expect(invoke('fetch_lms_courses')).rejects.toThrow(NativeError);

    try {
      await invoke('fetch_lms_courses');
    } catch (err: any) {
      expect(err).toBeInstanceOf(NativeError);
      expect(err.code).toBe('AUTH_FAILED');
      expect(err.retryable).toBe(false);
    }

    const trace = getInteractionTrace();
    const errEvent = trace.find((t) => t.kind === 'ipc:err' && (t.data as any)?.cmd === 'fetch_lms_courses');
    expect(errEvent).toBeDefined();
    expect((errEvent?.data as any)?.code).toBe('AUTH_FAILED');
  });

  it('redacts sensitive credentials from IPC argument telemetry', async () => {
    installMockIpc(async () => ({ success: true }));

    await invoke('store_credentials', {
      account: 'tokyotech',
      password: 'SuperSecretPassword123!',
      matrix_token: '1234567890',
    });

    const trace = getInteractionTrace();
    const event = trace.find((t) => (t.data as any)?.cmd === 'store_credentials');
    expect(event).toBeDefined();

    const args = (event?.data as any)?.args;
    expect(args.password).toBe('[REDACTED]');
    expect(args.matrix_token).toBe('[REDACTED]');
    expect(args.account).toBe('tokyotech');
  });
});
