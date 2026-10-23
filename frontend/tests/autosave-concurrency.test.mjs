import assert from 'node:assert';

let passed = 0;
let failed = 0;

function it(name, fn) {
  try {
    const res = fn();
    if (res instanceof Promise) {
      return res.then(() => {
        console.log(`  ✓ ${name}`);
        passed++;
      }).catch(err => {
        console.error(`  ✗ ${name}`);
        console.error(`    ${err.message}`);
        failed++;
      });
    }
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

console.log('\n--- AUTOSAVE & OPTIMISTIC CONCURRENCY TESTS (STEP 5 & 6) ---');

class AutosaveManager {
  constructor({ onSave, debounceMs = 1000, maxUnsavedWaitMs = 3000 }) {
    this.onSave = onSave;
    this.debounceMs = debounceMs;
    this.maxUnsavedWaitMs = maxUnsavedWaitMs;
    this.timer = null;
    this.firstDirtyTime = null;
    this.status = 'saved';
    this.currentVersion = 1;
    this.localDoc = '';
    this.localCanvas = '{}';
    this.lastSavedDoc = '';
    this.lastSavedCanvas = '{}';
    this.conflictData = null;
    this.retryAttempts = 0;
    this.saveCount = 0;
    this.keepaliveCalls = 0;
    this.normalCalls = 0;
  }

  updateContent(doc, canvas) {
    this.localDoc = doc;
    this.localCanvas = canvas;
    if (this.firstDirtyTime === null) {
      this.firstDirtyTime = Date.now();
    }
    const elapsed = Date.now() - this.firstDirtyTime;
    const remaining = Math.max(0, this.maxUnsavedWaitMs - elapsed);
    const delay = Math.min(this.debounceMs, remaining);

    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.performSave();
    }, delay);
  }

  async performSave({ isFlush = false, force = false, keepalive = false } = {}) {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    const isDirty = (this.localDoc !== this.lastSavedDoc || this.localCanvas !== this.lastSavedCanvas);
    if (!isDirty && !force) {
      this.firstDirtyTime = null;
      return;
    }

    if (keepalive) {
      this.keepaliveCalls++;
    } else {
      this.normalCalls++;
    }

    this.status = 'saving';
    this.saveCount++;

    try {
      const res = await this.onSave({
        docContent: this.localDoc,
        canvasData: this.localCanvas,
        expected_version: force ? undefined : this.currentVersion,
        force,
        keepalive
      });

      this.status = 'saved';
      this.currentVersion = res.version;
      this.lastSavedDoc = this.localDoc;
      this.lastSavedCanvas = this.localCanvas;
      this.firstDirtyTime = null;
      this.conflictData = null;
      this.retryAttempts = 0;
      return res;
    } catch (err) {
      if (err.status === 409 || err.isConflict) {
        this.status = 'conflict';
        this.conflictData = err.data;
      } else {
        this.status = 'error';
        this.retryAttempts++;
      }
      throw err;
    }
  }

  // Handle visibilitychange to hidden (fires before pagehide while standard requests are supported)
  handleVisibilityChange(state) {
    if (state === 'hidden') {
      const isDirty = (this.localDoc !== this.lastSavedDoc || this.localCanvas !== this.lastSavedCanvas);
      if (isDirty) {
        return this.performSave({ keepalive: false });
      }
    }
  }

  // Handle pagehide with keepalive cap check
  handlePageHide() {
    const payload = JSON.stringify({
      docContent: this.localDoc,
      canvasData: this.localCanvas,
      expected_version: this.currentVersion
    });
    const byteLength = Buffer.byteLength(payload, 'utf8');
    const KEEPALIVE_CAP_BYTES = 60 * 1024; // 60KB

    if (byteLength > KEEPALIVE_CAP_BYTES) {
      // Exceeds 64KB browser keepalive quota; rely on earlier visibilitychange normal flush
      return;
    }
    return this.performSave({ keepalive: true });
  }

  flush() {
    return this.performSave({ isFlush: true });
  }

  resolveOverwrite() {
    return this.performSave({ force: true });
  }

  resolveReload(serverFile) {
    this.localDoc = serverFile.doc_content;
    this.localCanvas = serverFile.canvas_data;
    this.lastSavedDoc = serverFile.doc_content;
    this.lastSavedCanvas = serverFile.canvas_data;
    this.currentVersion = serverFile.version;
    this.status = 'saved';
    this.conflictData = null;
  }
}

async function runTests() {
  await it('debounces multiple rapid edits into a single save after delay', async () => {
    let mockServerSaves = 0;
    const manager = new AutosaveManager({
      debounceMs: 50,
      onSave: async (payload) => {
        mockServerSaves++;
        return { success: true, version: 2 };
      }
    });

    // 5 rapid edits
    manager.updateContent('H', '{}');
    manager.updateContent('He', '{}');
    manager.updateContent('Hel', '{}');
    manager.updateContent('Hell', '{}');
    manager.updateContent('Hello World', '{"diagrams":[]}');

    assert.strictEqual(manager.saveCount, 0);
    assert.strictEqual(mockServerSaves, 0);

    // Wait for debounce timeout
    await new Promise(r => setTimeout(r, 80));

    assert.strictEqual(manager.saveCount, 1);
    assert.strictEqual(mockServerSaves, 1);
    assert.strictEqual(manager.status, 'saved');
    assert.strictEqual(manager.lastSavedDoc, 'Hello World');
  });

  await it('flushes pending changes immediately on blur or pagehide without waiting for debounce', async () => {
    let mockServerSaves = 0;
    const manager = new AutosaveManager({
      debounceMs: 5000, // long debounce
      onSave: async (payload) => {
        mockServerSaves++;
        return { success: true, version: 2 };
      }
    });

    manager.updateContent('Quick Notes', '{}');
    assert.strictEqual(manager.saveCount, 0);

    // Immediate blur/pagehide flush
    await manager.flush();

    assert.strictEqual(manager.saveCount, 1);
    assert.strictEqual(mockServerSaves, 1);
    assert.strictEqual(manager.status, 'saved');
    assert.strictEqual(manager.lastSavedDoc, 'Quick Notes');
  });

  await it('detects 409 stale write conflict and allows clear choice to overwrite or reload', async () => {
    let serverVersion = 2; // Server advanced ahead
    const manager = new AutosaveManager({
      onSave: async (payload) => {
        if (!payload.force && payload.expected_version < serverVersion) {
          const err = new Error('Conflict: stale version');
          err.status = 409;
          err.isConflict = true;
          err.data = {
            server_version: serverVersion,
            server_file: { doc_content: 'Remote Changes', canvas_data: '{}', version: 2 }
          };
          throw err;
        }
        return { success: true, version: payload.force ? 3 : serverVersion + 1 };
      }
    });

    manager.currentVersion = 1;
    manager.localDoc = 'Local Conflicting Edit';

    // 1. Attempt save with stale version -> Expect 409
    let caughtConflict = false;
    try {
      await manager.performSave();
    } catch (e) {
      caughtConflict = true;
    }

    assert.strictEqual(caughtConflict, true);
    assert.strictEqual(manager.status, 'conflict');
    // Verify local changes are NOT discarded
    assert.strictEqual(manager.localDoc, 'Local Conflicting Edit');

    // 2. User chooses Overwrite (force: true)
    await manager.resolveOverwrite();
    assert.strictEqual(manager.status, 'saved');
    assert.strictEqual(manager.currentVersion, 3);
    assert.strictEqual(manager.lastSavedDoc, 'Local Conflicting Edit');
  });

  await it('allows reloading server version upon 409 conflict and clears conflict state', async () => {
    const manager = new AutosaveManager({
      onSave: async () => {}
    });

    manager.status = 'conflict';
    manager.localDoc = 'Unsaved local draft';

    const serverFile = {
      doc_content: 'Authoritative server content',
      canvas_data: '{"diagrams":[{"id":"d1"}]}',
      version: 5
    };

    manager.resolveReload(serverFile);

    assert.strictEqual(manager.status, 'saved');
    assert.strictEqual(manager.currentVersion, 5);
    assert.strictEqual(manager.localDoc, 'Authoritative server content');
    assert.strictEqual(manager.conflictData, null);
  });

  await it('preserves local changes when server fails with network error', async () => {
    let callCount = 0;
    const manager = new AutosaveManager({
      onSave: async () => {
        callCount++;
        const netErr = new Error('Failed to fetch');
        netErr.status = 500;
        throw netErr;
      }
    });

    manager.localDoc = 'Very Important Local Work';

    try {
      await manager.performSave({ force: true });
    } catch (e) {
      // Expected network error
    }

    assert.strictEqual(manager.status, 'error');
    assert.strictEqual(manager.retryAttempts, 1);
    // Crucial requirement: A failed save must never discard local changes
    assert.strictEqual(manager.localDoc, 'Very Important Local Work');
  });

  await it('caps debounce timer so continuous edits cannot delay saves beyond maxUnsavedWaitMs', async () => {
    let mockServerSaves = 0;
    // maxUnsavedWaitMs set to 120ms, debounceMs is 100ms
    const manager = new AutosaveManager({
      debounceMs: 100,
      maxUnsavedWaitMs: 120,
      onSave: async () => {
        mockServerSaves++;
        return { success: true, version: 2 };
      }
    });

    // Simulate continuous typing every 30ms for 180ms
    // With unbounded debounce, this would never fire until 100ms after the LAST keystroke.
    // With capped debounce, it MUST fire within ~120ms of the first dirty keystroke!
    const startTime = Date.now();
    manager.updateContent('k1', '{}');

    await new Promise(r => setTimeout(r, 30));
    manager.updateContent('k2', '{}');

    await new Promise(r => setTimeout(r, 30));
    manager.updateContent('k3', '{}');

    await new Promise(r => setTimeout(r, 30));
    manager.updateContent('k4', '{}');

    await new Promise(r => setTimeout(r, 50)); // total elapsed ~140ms > 120ms cap

    assert.strictEqual(mockServerSaves >= 1, true, 'Autosave should have fired due to maxUnsavedWaitMs cap');
    assert.strictEqual(manager.status, 'saved');
  });

  await it('handles keepalive 64KB cap: oversized payloads flush on visibilitychange (normal) and skip pagehide keepalive', async () => {
    const manager = new AutosaveManager({
      onSave: async () => ({ success: true, version: 2 })
    });

    // 1. Small payload (<60KB): pagehide executes keepalive: true
    manager.localDoc = 'Small document content';
    manager.localCanvas = '{}';
    manager.handlePageHide();
    assert.strictEqual(manager.keepaliveCalls, 1, 'Small payload should use keepalive');
    assert.strictEqual(manager.normalCalls, 0);

    // 2. Large payload (>60KB, e.g. 70KB):
    // Browser keepalive limit is ~64KB. pagehide keepalive must be skipped,
    // and visibilitychange to hidden executes with a normal request.
    const largeDoc = 'X'.repeat(70 * 1024); // 70 KB
    manager.updateContent(largeDoc, '{}');

    // On visibilitychange to hidden, normal request is sent
    await manager.handleVisibilityChange('hidden');
    assert.strictEqual(manager.normalCalls, 1, 'Oversized payload flushed on visibilitychange with normal request');

    // On pagehide, keepalive call is NOT made because byteLength > 60KB
    manager.handlePageHide();
    assert.strictEqual(manager.keepaliveCalls, 1, 'Oversized keepalive call was prevented');
  });

  console.log(`\n========================================`);
  console.log(`AUTOSAVE TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
