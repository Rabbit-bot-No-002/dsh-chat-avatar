import test from 'node:test'
import assert from 'node:assert/strict'
import { pickAnswerIndexes, type RowInfo } from '../src/pure/turns.js'

const row = (kind: string, text = ''): RowInfo => ({ kind, text })

test('每轮取最后一条有正文的 assistant-step', () => {
  const rows = [
    row('user', 'Q1'),
    row('assistant-step', '草稿'),
    row('assistant-step', '最终回答'),
    row('user', 'Q2'),
    row('assistant-step', '回答 2'),
  ]
  assert.deepEqual(pickAnswerIndexes(rows, false), [2, 4])
})

test('某轮全无正文时退回该轮最后一条（非生成中）', () => {
  const rows = [
    row('user', 'Q1'),
    row('assistant-step'),
    row('assistant-step'),
    row('user', 'Q2'),
    row('assistant-step', '有正文'),
  ]
  assert.deepEqual(pickAnswerIndexes(rows, false), [2, 4])
})

test('生成中：末尾空轮组被剔除，头像交给状态行', () => {
  const rows = [
    row('user', 'Q1'),
    row('assistant-step', '上一轮回答'),
    row('user', 'Q2'),
    row('assistant-step'),
    row('assistant-step'),
    row('turn-process', '深度求索中，用时 2 秒'),
  ]
  // 不生成时最后一轮会退回空步骤行（旧行为：头像随之漂到视口外）
  assert.deepEqual(pickAnswerIndexes(rows, false), [1, 4])
  // 生成中：只保留上一轮，当前轮由 running 行承载
  assert.deepEqual(pickAnswerIndexes(rows, true), [1])
})

test('生成中但上一轮有正文：不会被误剔除', () => {
  const rows = [
    row('user', 'Q1'),
    row('assistant-step', '上一轮回答'),
    row('user', 'Q2'),
    row('turn-process', '深度求索中'),
  ]
  assert.deepEqual(pickAnswerIndexes(rows, true), [1])
})

test('生成中且尚无任何助手步骤：返回空（不挂隐藏行）', () => {
  const rows = [row('user', 'Q1'), row('turn-process', '深度求索中')]
  assert.deepEqual(pickAnswerIndexes(rows, true), [])
  assert.deepEqual(pickAnswerIndexes(rows, false), [])
})

test('工具调用、状态行等其它行不参与分组；steering 也算用户轮', () => {
  const rows = [
    row('steering', '追问'),
    row('tool-call', 'read_file'),
    row('assistant-step', '回答'),
    row('turn-process', '完成'),
  ]
  assert.deepEqual(pickAnswerIndexes(rows, false), [2])
})
