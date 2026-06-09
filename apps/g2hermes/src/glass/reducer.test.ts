import { describe, expect, test } from 'bun:test'
import { initialState, reduce } from './reducer'

describe('reducer 初期状態', () => {
  test('idle で始まる', () => {
    expect(initialState.phase).toBe('idle')
    expect(initialState.transcript).toBeNull()
    expect(initialState.errorMsg).toBeNull()
  })
})

describe('録音フロー idle→recording→transcribing→review→thinking→answer', () => {
  test('idle + START_RECORDING → recording（前回の transcript/error/notice をクリア）', () => {
    const s = reduce(
      {
        ...initialState,
        transcript: '古い',
        errorMsg: '古いエラー',
        notice: 'x',
      },
      { type: 'START_RECORDING' },
    )
    expect(s.phase).toBe('recording')
    expect(s.transcript).toBeNull()
    expect(s.errorMsg).toBeNull()
    expect(s.notice).toBeNull()
  })

  test('recording + STOP_RECORDING → transcribing', () => {
    const s = reduce(
      { ...initialState, phase: 'recording' },
      { type: 'STOP_RECORDING' },
    )
    expect(s.phase).toBe('transcribing')
  })

  test('recording + REC_TOO_SHORT → recording のまま notice を出す', () => {
    const s = reduce(
      { ...initialState, phase: 'recording' },
      { type: 'REC_TOO_SHORT' },
    )
    expect(s.phase).toBe('recording')
    expect(s.notice).toBe('もう一度話してください')
  })

  test('transcribing + TRANSCRIBED → review（transcript を保持）', () => {
    const s = reduce(
      { ...initialState, phase: 'transcribing' },
      { type: 'TRANSCRIBED', text: 'こんにちは' },
    )
    expect(s.phase).toBe('review')
    expect(s.transcript).toBe('こんにちは')
  })

  test('review + ASK → thinking（送信。askingLabel に文字起こし文）', () => {
    const s = reduce(
      { ...initialState, phase: 'review', transcript: 'こんにちは' },
      { type: 'ASK', label: 'こんにちは' },
    )
    expect(s.phase).toBe('thinking')
    expect(s.askingLabel).toBe('こんにちは')
  })

  test('review + START_RECORDING → recording（録り直し・transcript クリア）', () => {
    const s = reduce(
      { ...initialState, phase: 'review', transcript: 'こんにちは' },
      { type: 'START_RECORDING' },
    )
    expect(s.phase).toBe('recording')
    expect(s.transcript).toBeNull()
  })

  test('thinking + ANSWERED → answer（pages 設定・pageIndex 0）', () => {
    const s = reduce(
      { ...initialState, phase: 'thinking', pageIndex: 3 },
      { type: 'ANSWERED', pages: ['p1', 'p2'] },
    )
    expect(s.phase).toBe('answer')
    expect(s.pages).toEqual(['p1', 'p2'])
    expect(s.pageIndex).toBe(0)
  })
})

describe('プリセット質問フロー（Phase 1 併存）', () => {
  test('idle + ASK → thinking（askingLabel にラベル）', () => {
    const s = reduce(initialState, { type: 'ASK', label: '自己紹介' })
    expect(s.phase).toBe('thinking')
    expect(s.askingLabel).toBe('自己紹介')
    expect(s.errorMsg).toBeNull()
  })
})

describe('ページ送り（answer）', () => {
  const base = {
    ...initialState,
    phase: 'answer' as const,
    pages: ['a', 'b', 'c'],
    pageIndex: 0,
  }
  test('NEXT_PAGE は末尾で先頭へ循環', () => {
    let s = reduce(base, { type: 'NEXT_PAGE' })
    expect(s.pageIndex).toBe(1)
    s = reduce({ ...base, pageIndex: 2 }, { type: 'NEXT_PAGE' })
    expect(s.pageIndex).toBe(0)
  })
  test('PREV_PAGE は先頭で末尾へ循環', () => {
    const s = reduce(base, { type: 'PREV_PAGE' })
    expect(s.pageIndex).toBe(2)
  })
})

describe('待ち時間スピナー frame（Phase 4）', () => {
  test('initialState.frame は 0', () => {
    expect(initialState.frame).toBe(0)
  })

  test('TICK で frame +1（phase/askingLabel 等は不変）', () => {
    const s = reduce(
      { ...initialState, phase: 'thinking', askingLabel: 'q', frame: 2 },
      { type: 'TICK' },
    )
    expect(s.frame).toBe(3)
    expect(s.phase).toBe('thinking')
    expect(s.askingLabel).toBe('q')
  })

  test('STOP_RECORDING（transcribing 入場）で frame=0 リセット', () => {
    const s = reduce(
      { ...initialState, phase: 'recording', frame: 5 },
      { type: 'STOP_RECORDING' },
    )
    expect(s.phase).toBe('transcribing')
    expect(s.frame).toBe(0)
  })

  test('ASK（thinking 入場）で frame=0 リセット', () => {
    const s = reduce(
      { ...initialState, phase: 'review', transcript: 'q', frame: 7 },
      { type: 'ASK', label: 'q' },
    )
    expect(s.phase).toBe('thinking')
    expect(s.frame).toBe(0)
  })
})

describe('エラーと戻る', () => {
  test('FAIL → error（errorMsg 設定）', () => {
    const s = reduce(
      { ...initialState, phase: 'transcribing' },
      { type: 'FAIL', error: '文字起こしに失敗' },
    )
    expect(s.phase).toBe('error')
    expect(s.errorMsg).toBe('文字起こしに失敗')
  })

  test('BACK → idle にリセット', () => {
    const s = reduce(
      {
        phase: 'answer',
        askingLabel: 'x',
        transcript: 't',
        pages: ['a'],
        pageIndex: 1,
        errorMsg: 'e',
        notice: 'n',
        frame: 9,
      },
      { type: 'BACK' },
    )
    expect(s).toEqual(initialState)
  })
})
