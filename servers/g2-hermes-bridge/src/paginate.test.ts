import { describe, expect, test } from 'bun:test'
import { G2_PAGE_MAX, paginateForG2 } from './paginate'

describe('paginateForG2', () => {
  test('連続する空白・改行・全角スペースを 1 つに正規化して trim する', () => {
    expect(paginateForG2('  あ　　い\n\nう  ')).toEqual(['あ い う'])
  })

  test('90字以下は 1 ページ', () => {
    const s = 'あ'.repeat(G2_PAGE_MAX)
    expect(paginateForG2(s)).toEqual([s])
  })

  test('日本語90字超は複数ページに分割され、各ページは90字以下', () => {
    const s = 'あ'.repeat(200)
    const pages = paginateForG2(s)
    expect(pages.length).toBe(3) // 90 + 90 + 20
    expect(pages.every((p) => p.length <= G2_PAGE_MAX)).toBe(true)
    expect(pages.join('')).toBe(s)
    expect(pages[0]?.length).toBe(90)
    expect(pages[2]?.length).toBe(20)
  })

  test('空文字・空白のみは [""] を返す（ページ 0 件にしない）', () => {
    expect(paginateForG2('')).toEqual([''])
    expect(paginateForG2('   ')).toEqual([''])
  })

  test('G2_PAGE_MAX は 90', () => {
    expect(G2_PAGE_MAX).toBe(90)
  })
})
