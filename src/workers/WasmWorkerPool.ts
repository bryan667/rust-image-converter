import type {
  ConvertJob,
  ConvertMessage,
  PendingRequest,
  QueuedJob,
  WorkerRequest,
  WorkerResponse,
  WorkerSlot,
} from '../types/workers.types';

const toError = (value: unknown): Error =>
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
      return this.waitForInit();
    }

    this.initInFlight = true;

    try {
      this.createWorkers();
      this.sendInitToWorkers();
      await this.waitForInit();
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

    const requestId = this.getNextRequestId();
    const payload = this.toConvertMessage(requestId, job);

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

  private waitForInit(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.initResolvers.push({ resolve, reject });
    });
  }

  private createWorkers() {
    for (let index = 0; index < this.size; index += 1) {
      const worker = new Worker(
        new URL('./wasmConverter.worker.ts', import.meta.url),
        { type: 'module' },
      );

      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        this.handleMessage(index, event.data);
      };
      worker.onerror = (event) => {
        this.failAll(new Error(event.message || 'Worker initialization error'));
      };

      this.slots.push({
        worker,
        ready: false,
        busy: false,
      });
    }
  }

  private sendInitToWorkers() {
    for (const slot of this.slots) {
      slot.worker.postMessage({ type: 'init' } satisfies WorkerRequest);
    }
  }

  private getNextRequestId(): number {
    const requestId = this.nextRequestId;
    this.nextRequestId += 1;
    return requestId;
  }

  private toConvertMessage(requestId: number, job: ConvertJob): ConvertMessage {
    return {
      type: 'convert',
      requestId,
      input: job.input,
      targetFormat: job.targetFormat,
      quality: job.quality,
      maxWidth: job.maxWidth,
      maxHeight: job.maxHeight,
      lossless: job.lossless,
    };
  }

  private handleMessage(workerIndex: number, message: WorkerResponse) {
    if (this.destroyed) return;

    switch (message.type) {
      case 'ready':
        this.handleReady(workerIndex);
        return;
      case 'result':
        this.handleResult(message.requestId, message.output);
        return;
      case 'error':
        this.handleError(message.requestId, message.error);
        return;
      default:
        return;
    }
  }

  private handleReady(workerIndex: number) {
    const slot = this.slots[workerIndex];
    if (!slot) return;

    slot.ready = true;

    const allReady =
      this.slots.length === this.size && this.slots.every((workerSlot) => workerSlot.ready);

    if (allReady && !this.initialized) {
      this.initialized = true;
      for (const resolver of this.initResolvers.splice(0)) {
        resolver.resolve();
      }
    }

    this.flushQueue();
  }

  private handleResult(requestId: number, output: Uint8Array) {
    const pending = this.pending.get(requestId);
    if (!pending) return;

    this.pending.delete(requestId);
    this.releaseWorker(pending.workerIndex);
    pending.resolve(new Uint8Array(output));
    this.flushQueue();
  }

  private handleError(requestId: number | undefined, error: string) {
    if (requestId == null) {
      this.failAll(new Error(error));
      return;
    }

    const pending = this.pending.get(requestId);
    if (!pending) return;

    this.pending.delete(requestId);
    this.releaseWorker(pending.workerIndex);
    pending.reject(new Error(error));
    this.flushQueue();
  }

  private releaseWorker(workerIndex: number) {
    const slot = this.slots[workerIndex];
    if (!slot) return;

    slot.busy = false;
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
