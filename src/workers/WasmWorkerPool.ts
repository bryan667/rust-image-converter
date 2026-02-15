import type {
  ConvertJob,
  ConvertMessage,
  PendingRequest,
  QueuedJob,
  WorkerRequest,
  WorkerResponse,
  WorkerSlot,
} from '../types/workers.types';

const toError = (value: unknown) =>
  value instanceof Error ? value : new Error(String(value));

export default class WasmWorkerPool {
  private readonly size: number;
  private readonly slots: WorkerSlot[] = [];
  private readonly queue: QueuedJob[] = [];
  private readonly pending = new Map<number, PendingRequest>();
  private readonly initResolvers: Array<{
    resolve: () => void;
    reject: (error: Error) => void;
  }> = [];
  private nextRequestId = 1;
  private initialized = false;
  private destroyed = false;
  private initInFlight = false;

  constructor(size: number) {
    this.size = Math.max(1, size);
  }

  async init(): Promise<void> {
    if (this.destroyed) {
      throw new Error('WasmWorkerPool has been destroyed');
    }
    if (this.initialized) return;

    if (this.initInFlight) {
      return new Promise<void>((resolve, reject) => {
        this.initResolvers.push({ resolve, reject });
      });
    }

    this.initInFlight = true;

    try {
      for (let index = 0; index < this.size; index += 1) {
        const worker = new Worker(
          new URL('./wasmConverter.worker.ts', import.meta.url),
          { type: 'module' },
        );
        this.slots.push({
          worker,
          ready: false,
          busy: false,
        });
        worker.onmessage = (event: MessageEvent<WorkerResponse>) =>
          this.handleMessage(index, event.data);
        worker.onerror = (event) => {
          this.failAll(
            new Error(event.message || 'Worker error during initialization'),
          );
        };
      }

      for (const slot of this.slots) {
        slot.worker.postMessage({ type: 'init' } satisfies WorkerRequest);
      }

      await new Promise<void>((resolve, reject) => {
        this.initResolvers.push({ resolve, reject });
      });
    } finally {
      this.initInFlight = false;
    }
  }

  convert(job: ConvertJob): Promise<Uint8Array> {
    if (this.destroyed) {
      return Promise.reject(new Error('WasmWorkerPool has been destroyed'));
    }
    if (!this.initialized) {
      return Promise.reject(new Error('WasmWorkerPool is not initialized'));
    }

    const requestId = this.nextRequestId;
    this.nextRequestId += 1;

    const payload: ConvertMessage = {
      type: 'convert',
      requestId,
      input: job.input,
      targetFormat: job.targetFormat,
      quality: job.quality,
      maxWidth: job.maxWidth,
      maxHeight: job.maxHeight,
      lossless: job.lossless,
    };

    return new Promise<Uint8Array>((resolve, reject) => {
      this.pending.set(requestId, {
        workerIndex: -1,
        resolve,
        reject,
      });
      this.queue.push({ requestId, payload });
      this.flushQueue();
    });
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.failAll(new Error('WasmWorkerPool destroyed'));

    for (const slot of this.slots) {
      slot.worker.terminate();
    }

    this.slots.length = 0;
  }

  private handleMessage(workerIndex: number, message: WorkerResponse) {
    if (this.destroyed) return;

    if (message.type === 'ready') {
      this.slots[workerIndex].ready = true;
      const allReady =
        this.slots.length === this.size && this.slots.every((s) => s.ready);
      if (allReady && !this.initialized) {
        this.initialized = true;
        for (const resolver of this.initResolvers.splice(0)) {
          resolver.resolve();
        }
      }
      this.flushQueue();
      return;
    }

    if (message.type === 'result') {
      const pending = this.pending.get(message.requestId);
      if (!pending) return;
      this.pending.delete(message.requestId);
      this.slots[pending.workerIndex].busy = false;
      pending.resolve(new Uint8Array(message.output));
      this.flushQueue();
      return;
    }

    if (message.requestId == null) {
      this.failAll(new Error(message.error));
      return;
    }

    const pending = this.pending.get(message.requestId);
    if (!pending) return;
    this.pending.delete(message.requestId);
    this.slots[pending.workerIndex].busy = false;
    pending.reject(new Error(message.error));
    this.flushQueue();
  }

  private flushQueue() {
    if (this.destroyed || !this.initialized) return;

    for (const [index, slot] of this.slots.entries()) {
      if (slot.busy || !slot.ready) continue;
      const queued = this.queue.shift();
      if (!queued) return;

      const pending = this.pending.get(queued.requestId);
      if (!pending) continue;

      pending.workerIndex = index;
      slot.busy = true;
      slot.worker.postMessage(queued.payload satisfies WorkerRequest, [
        queued.payload.input,
      ]);
    }
  }

  private failAll(error: unknown) {
    const normalized = toError(error);

    for (const request of this.pending.values()) {
      request.reject(normalized);
    }
    this.pending.clear();
    this.queue.length = 0;

    for (const resolver of this.initResolvers.splice(0)) {
      resolver.reject(normalized);
    }
  }
}
