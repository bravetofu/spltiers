import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  authorizeCollector,
  isCollectorWorkflow,
} from '../lib/ratings/collector-auth'
const valid = {
  repository_id: '1181334053',
  repository_owner_id: '221731944',
  ref: 'refs/heads/main',
  workflow_ref:
    'bravetofu/spltiers/.github/workflows/collect-battles.yml@refs/heads/main',
  event_name: 'schedule',
}
test('collector identity excludes forks, alternate workflows, branches and PR events', () => {
  assert.equal(isCollectorWorkflow(valid), true)
  for (const [key, value] of Object.entries({
    repository_id: '123',
    repository_owner_id: '456',
    ref: 'refs/heads/feature',
    workflow_ref:
      'bravetofu/spltiers/.github/workflows/other.yml@refs/heads/main',
    event_name: 'pull_request',
  }))
    assert.equal(isCollectorWorkflow({ ...valid, [key]: value }), false)
})
test('scheduler authentication fails closed without a valid secret or signed identity', async () => {
  assert.equal(await authorizeCollector('Bearer test', 'test'), true)
  assert.equal(await authorizeCollector('Bearer wrong', 'test'), false)
  assert.equal(await authorizeCollector('Bearer éééé', 'test'), false)
  assert.equal(await authorizeCollector('', ''), false)
  assert.equal(
    await authorizeCollector('Bearer fake.payload.signature', 'test'),
    false,
  )
})
