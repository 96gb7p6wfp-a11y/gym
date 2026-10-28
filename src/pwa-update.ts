export interface UpdateWorkerPort {
  postMessage: (message: unknown, transfer: Transferable[]) => void;
}

/** Older installed workers do not support this message: silence is not success. */
export function requestPwaActivation(worker: UpdateWorkerPort, timeoutMs = 2000): Promise<{ accepted: boolean; reason?: string }> {
  return new Promise(resolve => {
    const channel = new MessageChannel();
    let finished = false;
    const finish = (result: { accepted: boolean; reason?: string }) => {
      if (finished) return;
      finished = true; clearTimeout(timer); channel.port1.close(); channel.port2.close(); resolve(result);
    };
    const timer = setTimeout(() => finish({ accepted: false, reason: 'Close all Setline windows, then reopen the app to finish updating.' }), timeoutMs);
    channel.port1.onmessage = event => {
      if (event.data?.accepted === true) finish({ accepted: true });
      else finish({ accepted: false, reason: typeof event.data?.reason === 'string' ? event.data.reason : 'Close and reopen Setline to finish updating.' });
    };
    try { worker.postMessage({ type: 'SETLINE_ACTIVATE_UPDATE' }, [channel.port2]); }
    catch { finish({ accepted: false, reason: 'Close and reopen Setline to finish updating.' }); }
  });
}
