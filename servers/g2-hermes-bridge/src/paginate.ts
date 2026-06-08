/**
 * G2 表示用の 1 ページ最大文字数。
 * 実機 line height 27px・最大10行・576×288px に短文が収まる上限（仕様書 §3.4 / Plans 制約）。
 */
export const G2_PAGE_MAX = 90

/**
 * 回答テキストを G2 表示用に整形・ページ分割する。
 * 連続する空白・改行・全角スペースを 1 つの半角スペースに正規化して trim し、
 * G2_PAGE_MAX 文字ごとに分割する。空文字のときは `['']` を返す
 * （呼び出し側がページ 0 件にならないようにするため）。
 */
export function paginateForG2(text: string): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  const pages: string[] = []
  for (let i = 0; i < cleaned.length; i += G2_PAGE_MAX) {
    pages.push(cleaned.slice(i, i + G2_PAGE_MAX))
  }
  return pages.length ? pages : ['']
}
