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
    await handleInit();
    return;
  }

  await handleConvert(message);
};

async function handleInit() {
  if (initialized) {
    postReady();
    return;
  }

  try {
    const wasmModule = await import('../../wasm/pkg/image_wasm');
    await wasmModule.default();

    convertImageWithOptions = wasmModule.convert_image_with_options;
    initialized = true;

    postReady();
  } catch (error: unknown) {
    postError(String(error));
  }
}

async function handleConvert(message: WorkerRequest) {
  if (message.type !== 'convert') return;

  if (!initialized || !convertImageWithOptions) {
    postError('Worker is not initialized', message.requestId);
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
    postError(String(error), message.requestId);
  }
}

function postReady() {
  workerScope.postMessage({ type: 'ready' } satisfies WorkerResponse);
}

function postError(error: string, requestId?: number) {
  workerScope.postMessage({
    type: 'error',
    requestId,
    error,
  } satisfies WorkerResponse);
}
