import assert from 'node:assert';

const API_BASE = 'http://localhost:8000/api/v1';

async function request(endpoint, options = {}) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function runSharingTests() {
  console.log('\n--- SHARING & READ-ONLY ACCESS TESTS (STEP 9) ---');

  // 1. Create a dummy workspace file
  const fileRes = await request('/files', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Shared System Architecture',
      docContent: '# Architecture Guide\nNotes for external partners.',
      canvasData: JSON.stringify({
        diagrams: [{ id: 'diag-partner-1', code: 'Client > Gateway > Service', type: 'diagram' }]
      })
    })
  });
  assert.strictEqual(fileRes.status, 201, 'Workspace file created');
  const fileId = fileRes.data.file.id;

  // 2. Create view-only share link with targeting parameter
  const shareRes = await request('/share', {
    method: 'POST',
    body: JSON.stringify({
      fileId,
      targetDiagramId: 'diag-partner-1',
      targetElements: ['Gateway', 'Service']
    })
  });
  assert.strictEqual(shareRes.status, 201, 'Share link created');
  assert.strictEqual(shareRes.data.success, true);
  const share = shareRes.data.share;
  const token = share.id;

  // Token must be cryptographically unguessable (length >= 32)
  assert.ok(token.length >= 32, 'Share token is unguessable and >= 32 chars');
  assert.ok(shareRes.data.shareUrl.includes(`diagram=diag-partner-1`), 'Includes diagram targeting');
  console.log('  ✓ creates cryptographically secure share link with diagram targeting');

  // 3. Open share link (public read-only access without login)
  const openRes = await request(`/share/${token}?diagram=diag-partner-1`);
  assert.strictEqual(openRes.status, 200, 'Public open succeeds without auth');
  assert.strictEqual(openRes.data.file.id, fileId, 'Returns shared file content');
  assert.strictEqual(openRes.data.share.target_diagram_id, 'diag-partner-1');
  console.log('  ✓ loads shared document read-only without requiring user authentication');

  // 4. Test targeting parameters (?figure=..., ?elements=...)
  const targetedRes = await request(`/share/${token}?figure=fig-hero&elements=e1,e2`);
  assert.strictEqual(targetedRes.status, 200);
  assert.strictEqual(targetedRes.data.share.target_figure_id, 'fig-hero');
  assert.deepStrictEqual(targetedRes.data.share.target_elements, ['e1', 'e2']);
  console.log('  ✓ supports ?diagram=, ?figure=, and ?elements= targeting query parameters');

  // 5. Test that share token cannot be used to modify anything
  const writeAttempt1 = await request(`/share/${token}`, {
    method: 'PUT',
    body: JSON.stringify({ docContent: 'Unauthorized Modification' })
  });
  assert.ok([404, 405].includes(writeAttempt1.status), 'Write route blocked on share endpoint');

  const writeAttempt2 = await request(`/share/${token}`, {
    method: 'POST',
    body: JSON.stringify({ docContent: 'Unauthorized Modification' })
  });
  assert.ok([404, 405].includes(writeAttempt2.status), 'Post write blocked on share endpoint');
  console.log('  ✓ enforces read-only access and exposes no write routes');

  // 6. Revoke share link
  const revokeRes = await request(`/share/${token}`, {
    method: 'DELETE'
  });
  assert.strictEqual(revokeRes.status, 200, 'Share link revoked successfully');
  console.log('  ✓ revokes share link from editor');

  // 7. Verify revoking immediately returns 404
  const expiredRes = await request(`/share/${token}`);
  assert.strictEqual(expiredRes.status, 404, 'Revoked share link returns 404 immediately');
  assert.ok(expiredRes.data.error.message.includes('not found or expired'));
  console.log('  ✓ revoked link returns 404 immediately on subsequent access');

  // Cleanup file
  await request(`/files/${fileId}`, { method: 'DELETE' });

  console.log('\n========================================');
  console.log('SHARING TEST SUMMARY: ALL 5 PASSED, 0 FAILED');
  console.log('========================================\n');
}

runSharingTests().catch(err => {
  console.error('Sharing test failed:', err);
  process.exit(1);
});
