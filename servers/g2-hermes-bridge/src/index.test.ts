import { expect, test } from 'bun:test'
import { VERSION } from './index'

// Scaffold スモーク: bun test ランナーと src への import 解決が動くことの確認。
// Bridge のピュア関数テストは Task 1.2 で追加する。
test('VERSION は Phase 1 PoC のバージョン', () => {
  expect(VERSION).toBe('0.1.0')
})
