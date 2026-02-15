import type { Format } from './images.types';

export type ConvertMessage = {
  type: 'convert';
  requestId: number;
  input: ArrayBuffer;
  targetFormat: string;
  quality: number;
  maxWidth: number;
  maxHeight: number;
  lossless: boolean;
};

export type ReadyMessage = {
  type: 'ready';
};

export type ResultMessage = {
  type: 'result';
  requestId: number;
  output: Uint8Array;
};

export type WorkerResponse = ReadyMessage | ResultMessage | ErrorMessage;

export type ConvertImageWithOptions = (
  input: Uint8Array,
  target_format: string,
  quality: number,
  max_width: number,
  max_height: number,
  lossless: boolean,
) => Uint8Array;

export type WorkerScope = {
  onmessage:
    | ((event: MessageEvent<WorkerRequest>) => void | Promise<void>)
    | null;
  postMessage: (message: WorkerResponse, transfer?: Transferable[]) => void;
};

export type InitMessage = {
  type: 'init';
};

export type WorkerRequest = InitMessage | ConvertMessage;

export type ErrorMessage = {
  type: 'error';
  requestId?: number;
  error: string;
};

export type WorkerSlot = {
  worker: Worker;
  ready: boolean;
  busy: boolean;
};

export type QueuedJob = {
  requestId: number;
  payload: ConvertMessage;
};

export type PendingRequest = {
  workerIndex: number;
  resolve: (output: Uint8Array) => void;
  reject: (error: Error) => void;
};

export type ConvertJob = {
  input: ArrayBuffer;
  targetFormat: Format;
  quality: number;
  maxWidth: number;
  maxHeight: number;
  lossless: boolean;
};
