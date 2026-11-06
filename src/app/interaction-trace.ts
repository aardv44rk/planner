/**
 * Development Interaction & IPC Telemetry Tracer.
 * Records user actions, route transitions, and Tauri IPC invocations into a
 * structured timeline with automatic redaction of credentials/tokens.
 */

export interface TraceEvent {
  kind: string;
  at: string;
  msFromStart: number;
  route: string;
  data?: Record<string, unknown>;
}

const SECRET_KEY_PATTERN = /pass|secret|token|cookie|credential|otp|auth|seed|matrix/i;
const startTime = performance.now();
const MAX_HISTORY = 150;
const eventHistory: TraceEvent[] = [];
let listenersInstalled = false;

function redact(val: unknown, depth = 0): unknown {
  if (val === null || val === undefined) return val;
  if (typeof val === 'string') {
    return val.length > 120 ? `${val.slice(0, 120)}…(${val.length} chars)` : val;
  }
  if (typeof val !== 'object') return val;
  if (Array.isArray(val)) {
    return val.length > 4 || depth > 2
      ? `[Array(${val.length})]`
      : val.map((item) => redact(item, depth + 1));
  }
  if (depth > 2) return '{…}';

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
    out[k] = SECRET_KEY_PATTERN.test(k) ? '[REDACTED]' : redact(v, depth + 1);
  }
  return out;
}

/** Records a telemetry event in the debug timeline */
export function traceEvent(kind: string, data?: Record<string, unknown>): void {
  const event: TraceEvent = {
    kind,
    at: new Date().toISOString(),
    msFromStart: Math.round(performance.now() - startTime),
    route: typeof window !== 'undefined' && window.location ? window.location.hash || '#/today' : '#/',
    data: data ? (redact(data) as Record<string, unknown>) : undefined,
  };

  eventHistory.push(event);
  if (eventHistory.length > MAX_HISTORY) {
    eventHistory.shift();
  }

  if (import.meta.env.DEV) {
    const timeStr = `+${event.msFromStart}ms`;
    if (kind.startsWith('ipc:err') || kind === 'error') {
      console.warn(`[Trace ${timeStr}] ${kind}`, event.data || '');
    } else {
      console.debug(`[Trace ${timeStr}] ${kind}`, event.data || '');
    }
  }
}

/** Returns the immutable interaction history */
export function getInteractionTrace(): readonly TraceEvent[] {
  return [...eventHistory];
}

/** Installs global interaction observers for clicks, key navigation, and unhandled errors */
export function installInteractionTrace(): void {
  if (listenersInstalled || typeof window === 'undefined') return;
  listenersInstalled = true;

  // Expose inspection object on window for debugging in DevTools
  (window as any).__LIFEOS_TRACE__ = {
    getHistory: getInteractionTrace,
    clear: () => {
      eventHistory.length = 0;
    },
  };

  // Route hash changes
  window.addEventListener('hashchange', () => {
    traceEvent('navigation:route', { hash: window.location.hash });
  });

  // Global uncaught errors
  window.addEventListener('error', (event) => {
    traceEvent('error:uncaught', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    traceEvent('error:unhandledrejection', {
      reason: String(event.reason),
    });
  });

  // Track key actions like Enter or Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || (e.ctrlKey || e.metaKey) && e.key === 'k') {
      traceEvent('input:shortcut', { key: e.key, meta: e.metaKey, ctrl: e.ctrlKey });
    }
  }, { passive: true });

  traceEvent('app:initialized', {
    userAgent: navigator.userAgent,
    screen: `${window.innerWidth}x${window.innerHeight}`,
  });
}
