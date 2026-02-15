import type {
  ConvertImageWithOptions,
  WorkerRequest,
  WorkerResponse,
  WorkerScope,
} from '../types/workers.types';

let convertImageWithOptions: ConvertImageWithOptions | null = null;
let initialized = false;
const workerScope = self as unknown as WorkerScope;

workerScope.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;

  if (message.type === 'init') {
    if (initialized) {
      workerScope.postMessage({ type: 'ready' } satisfies WorkerResponse);
      return;
    }

    try {
      const wasmModule = await import('../../wasm/pkg/image_wasm');
      await wasmModule.default();
      convertImageWithOptions = wasmModule.convert_image_with_options;
      initialized = true;
      workerScope.postMessage({ type: 'ready' } satisfies WorkerResponse);
    } catch (error: unknown) {
      workerScope.postMessage({
        type: 'error',
        error: String(error),
      } satisfies WorkerResponse);
    }
    return;
  }

  if (!initialized || !convertImageWithOptions) {
    workerScope.postMessage({
      type: 'error',
      requestId: message.requestId,
      error: 'Worker is not initialized',
    } satisfies WorkerResponse);
    return;
  }

  try {
    const output = convertImageWithOptions(
      new Uint8Array(message.input),
      message.targetFormat,
      message.quality,
      message.maxWidth,
      message.maxHeight,
      message.lossless,
    );

    const outputBytes = new Uint8Array(output.byteLength);
    outputBytes.set(output);
    workerScope.postMessage(
      {
        type: 'result',
        requestId: message.requestId,
        output: outputBytes,
      } satisfies WorkerResponse,
      [outputBytes.buffer],
    );
  } catch (error: unknown) {
    workerScope.postMessage({
      type: 'error',
      requestId: message.requestId,
      error: String(error),
    } satisfies WorkerResponse);
  }
};
