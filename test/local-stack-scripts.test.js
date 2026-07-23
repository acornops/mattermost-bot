import assert from 'node:assert/strict';
import test from 'node:test';

import {
  extractMmctlToken,
  mmctlJsonHas
} from '../scripts/local/mmctl-json.mjs';

test('mmctl JSON helper finds seeded entities in arrays and nested responses', () => {
  assert.equal(mmctlJsonHas('[{"username":"dev"}]', 'username', 'dev'), true);
  assert.equal(mmctlJsonHas('{"items":[{"name":"chatops-lab"}]}', 'name', 'chatops-lab'), true);
  assert.equal(mmctlJsonHas('[{"username":"other"}]', 'username', 'dev'), false);
});

test('mmctl JSON helper extracts a generated token without printing other state', () => {
  assert.equal(
    extractMmctlToken('{"bot":{"username":"acorn-ops-bot"},"token":{"token":"generated_token_1"}}'),
    'generated_token_1'
  );
  assert.throws(() => extractMmctlToken('{"bot":{"username":"acorn-ops-bot"}}'));
});
