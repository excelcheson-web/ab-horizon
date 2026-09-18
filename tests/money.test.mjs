import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseAmountCents } from '../src/services/money.js'

test('USD amounts are parsed completely into exact cents', () => {
  for (const [input, cents] of [['20224.71', 2022471], ['20,224.71', 2022471], ['0.29', 29], ['1.01', 101], [' 10.5 ', 1050], [20224.71, 2022471]]) {
    assert.equal(parseAmountCents(input), cents)
  }
})

test('ambiguous, fractional-cent, unsafe, and non-numeric amounts are rejected', () => {
  for (const input of ['20.224.71', '20.224,71', '20224,71', '20,22.71', '20.224', '1e3', '10 USD', '', '0', '-1', Infinity, NaN, null, '90071992547409.92']) {
    assert.throws(() => parseAmountCents(input), /valid amount/)
  }
})
