/** Hermes（OpenAI Responses API 互換）レスポンスの content part の最小構造。 */
export interface HermesContentPart {
  type: string
  text?: string
}

/**
 * output item の最小構造。実 API には `function_call` の `name`/`arguments` など
 * 多くのフィールドが付くが、本モジュールは `type` と `content` だけを読む。
 */
export interface HermesOutputItem {
  type: string
  content?: HermesContentPart[]
  [key: string]: unknown
}

/** Responses API レスポンスのうち、本文抽出に必要な部分だけの型。 */
export interface HermesResponse {
  output?: HermesOutputItem[]
}

/**
 * Responses API の `output` から `message` の `output_text` 本文だけを抽出する。
 * `function_call` など message 以外の item、`output_text` 以外の content（refusal 等）は
 * スキップする。複数 message は改行で連結し、前後の空白は trim する。
 */
export function extractOutputText(response: HermesResponse): string {
  const chunks: string[] = []
  for (const item of response.output ?? []) {
    if (item.type !== 'message') continue
    for (const part of item.content ?? []) {
      if (part.type === 'output_text' && part.text) chunks.push(part.text)
    }
  }
  return chunks.join('\n').trim()
}
