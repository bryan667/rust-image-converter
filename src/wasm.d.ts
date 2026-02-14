declare module '../wasm/pkg/image_wasm' {
  export default function init(): Promise<void>
  export function convert_image(input: Uint8Array, targetFormat: string): Uint8Array
  export function convert_image_with_options(
    input: Uint8Array,
    targetFormat: string,
    quality: number,
    maxWidth: number,
    maxHeight: number,
    lossless: boolean
  ): Uint8Array
}
