import { describe, expect, test } from 'bun:test'
import type { AskOutcome } from '../api/bridgeClient'
import { ASK_SESSION_ID, CUSTOM_ASK_LABEL, runAsk } from './ask'
import { type Event, initialState, reduce, type State } from './reducer'

// 実 reducer を通して event を畳み、idle→thinking→answer/error の遷移を観測する小さなストア。
function makeStore(start: State = initialState) {
  let state = start
  const events: Event[] = []
  const dispatch = (e: Event) => {
    events.push(e)
    state = reduce(state, e)
  }
  return {
    dispatch,
    events,
    get state() {
      return state
    },
  }
}

const okOutcome = (pages: string[], text = ''): AskOutcome => ({
  ok: true,
  result: {
    ok: true,
    sessionId: ASK_SESSION_ID,
    responseId: null,
    text,
    pages,
    audioUrl: null,
  },
})

const failOutcome = (error: string): AskOutcome => ({ ok: false, error })

describe('runAsk（ask 配線：Phase 1 askBridge 経由）', () => {
  test('送信成功: idle→thinking→answer（pages を反映）', async () => {
    const store = makeStore()
    await runAsk(store.dispatch, CUSTOM_ASK_LABEL, 'こんにちは', {
      ask: async () => okOutcome(['回答1', '回答2']),
    })
    expect(store.events.map((e) => e.type)).toEqual(['ASK', 'ANSWERED'])
    expect(store.state.phase).toBe('answer')
    expect(store.state.pages).toEqual(['回答1', '回答2'])
  })

  test('ASK で thinking に入り askingLabel が付く（中間遷移）', async () => {
    const store = makeStore()
    await runAsk(store.dispatch, CUSTOM_ASK_LABEL, 'q', {
      ask: async () => okOutcome(['a']),
    })
    const afterAsk = reduce(initialState, store.events[0])
    expect(afterAsk.phase).toBe('thinking')
    expect(afterAsk.askingLabel).toBe(CUSTOM_ASK_LABEL)
  })

  test('pages 空でも text があれば 1 ページに畳む', async () => {
    const store = makeStore()
    await runAsk(store.dispatch, 'q', 'q', {
      ask: async () => okOutcome([], '本文だけ'),
    })
    expect(store.state.pages).toEqual(['本文だけ'])
  })

  test('pages も text も空なら 回答なしプレースホルダ', async () => {
    const store = makeStore()
    await runAsk(store.dispatch, 'q', 'q', {
      ask: async () => okOutcome([], ''),
    })
    expect(store.state.pages).toEqual(['(回答がありません)'])
  })

  test('送信失敗: idle→thinking→error（errorMsg を反映）', async () => {
    const store = makeStore()
    await runAsk(store.dispatch, 'q', 'q', {
      ask: async () => failOutcome('接続できません'),
    })
    expect(store.events.map((e) => e.type)).toEqual(['ASK', 'FAIL'])
    expect(store.state.phase).toBe('error')
    expect(store.state.errorMsg).toBe('接続できません')
  })

  test('isCurrent が false なら結果 dispatch を捨てる（ASK のみで thinking 維持）', async () => {
    const store = makeStore()
    await runAsk(store.dispatch, 'q', 'q', {
      ask: async () => okOutcome(['a']),
      isCurrent: () => false,
    })
    expect(store.events.map((e) => e.type)).toEqual(['ASK'])
    expect(store.state.phase).toBe('thinking')
  })

  test('既定で ASK_SESSION_ID と mode=short を使う', async () => {
    const calls: Array<[string, string, string | undefined]> = []
    await runAsk(() => {}, 'L', 'テキスト', {
      ask: async (sid, txt, mode) => {
        calls.push([sid, txt, mode])
        return okOutcome(['a'])
      },
    })
    expect(calls).toEqual([[ASK_SESSION_ID, 'テキスト', 'short']])
  })

  test('カスタム送信ラベルは (カスタム)', () => {
    expect(CUSTOM_ASK_LABEL).toBe('(カスタム)')
  })
})
