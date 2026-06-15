/// <reference types="vite/client" />

declare const __APP_VERSION__: string

// upng-js ships no types. Only the encode signature we use is declared.
declare module 'upng-js' {
  export function encode(
    imgs: ArrayBuffer[],
    w: number,
    h: number,
    cnum: number,
  ): ArrayBuffer
}
