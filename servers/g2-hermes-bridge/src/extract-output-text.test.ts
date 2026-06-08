import { describe, expect, test } from 'bun:test'
import { extractOutputText, type HermesResponse } from './extract-output-text'

describe('extractOutputText', () => {
  test('message の output_text 本文だけを抽出し、function_call はスキップする', () => {
    // function_call + message が混在する実レスポンス相当のフィクスチャ
    const response: HermesResponse = {
      output: [
        {
          type: 'function_call',
          name: 'get_schedule',
          arguments: '{"date":"today"}',
        },
        {
          type: 'message',
          content: [
            {
              type: 'output_text',
              text: '今日は13時から打ち合わせがあります。',
            },
            { type: 'refusal', text: '(これは抽出されない)' },
          ],
        },
      ],
    }
    expect(extractOutputText(response)).toBe(
      '今日は13時から打ち合わせがあります。',
    )
  })

  test('複数 message の output_text を改行で連結する', () => {
    const response: HermesResponse = {
      output: [
        { type: 'message', content: [{ type: 'output_text', text: '一行目' }] },
        { type: 'message', content: [{ type: 'output_text', text: '二行目' }] },
      ],
    }
    expect(extractOutputText(response)).toBe('一行目\n二行目')
  })

  test('output が無い / 空のときは空文字を返す', () => {
    expect(extractOutputText({})).toBe('')
    expect(extractOutputText({ output: [] })).toBe('')
  })

  test('output_text が空文字の content はスキップする', () => {
    const response: HermesResponse = {
      output: [
        { type: 'message', content: [{ type: 'output_text', text: '' }] },
      ],
    }
    expect(extractOutputText(response)).toBe('')
  })

  test('前後の空白を trim する', () => {
    const response: HermesResponse = {
      output: [
        {
          type: 'message',
          content: [{ type: 'output_text', text: '  回答  ' }],
        },
      ],
    }
    expect(extractOutputText(response)).toBe('回答')
  })
})
