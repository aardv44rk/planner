if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = globalThis;
}

type InvokeHandler = (cmd: string, args?: Record<string, unknown>) => unknown | Promise<unknown>;

let activeHandler: InvokeHandler | null = null;

export function installMockIpc(handler: InvokeHandler) {
  activeHandler = handler;
  const target = (typeof window !== 'undefined' ? window : globalThis) as any;

  if (!target.__TAURI_INTERNALS__) {
    target.__TAURI_INTERNALS__ = {};
  }

  target.__TAURI_INTERNALS__.invoke = async (cmd: string, args?: Record<string, unknown>) => {
    if (activeHandler) {
      return activeHandler(cmd, args);
    }
    throw new Error(`Unhandled mock IPC command: ${cmd}`);
  };
}

export function teardownMockIpc() {
  activeHandler = null;
  const target = (typeof window !== 'undefined' ? window : globalThis) as any;
  if (target.__TAURI_INTERNALS__) {
    delete target.__TAURI_INTERNALS__.invoke;
  }
}
