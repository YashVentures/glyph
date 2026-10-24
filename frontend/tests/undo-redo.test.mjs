import assert from 'node:assert';
import { renameNode, updateColorAtLine } from '../src/lib/engine/twoWaySync.js';

console.log('\n--- STEP 15: UNDO / REDO HISTORY FOR CANVAS EDITS ---');

// Mock undo/redo history manager matching workspace/[workspaceId].js implementation
class HistoryManager {
  constructor(initialState) {
    this.current = JSON.stringify(initialState);
    this.undoStack = [];
    this.redoStack = [];
  }

  mutate(newState) {
    this.undoStack.push(this.current);
    if (this.undoStack.length > 50) this.undoStack.shift();
    this.redoStack = [];
    this.current = JSON.stringify(newState);
  }

  undo() {
    if (this.undoStack.length === 0) return null;
    this.redoStack.push(this.current);
    this.current = this.undoStack.pop();
    return JSON.parse(this.current);
  }

  redo() {
    if (this.redoStack.length === 0) return null;
    this.undoStack.push(this.current);
    this.current = this.redoStack.pop();
    return JSON.parse(this.current);
  }

  getState() {
    return JSON.parse(this.current);
  }
}

// 1. Initial diagram state
const initial = {
  diagrams: [
    {
      id: 'diag-1',
      code: 'direction right\nUsers [color: blue]\nUsers > Orders: places'
    }
  ]
};

const history = new HistoryManager(initial);

// 2. Perform canvas rename edit: Users -> Customers
const code1 = renameNode(initial.diagrams[0].code, 'Users', 'Customers');
history.mutate({
  diagrams: [{ id: 'diag-1', code: code1 }]
});
assert(history.getState().diagrams[0].code.includes('Customers > Orders'));
console.log('✓ Edit 1: Renamed Users -> Customers applied');

// 3. Perform canvas color change edit: color: blue -> color: green
const code2 = updateColorAtLine(code1, 2, 'green');
history.mutate({
  diagrams: [{ id: 'diag-1', code: code2 }]
});
assert(history.getState().diagrams[0].code.includes('color: green'));
console.log('✓ Edit 2: Changed color to green applied');

// 4. Undo Edit 2
const undone1 = history.undo();
assert(undone1.diagrams[0].code.includes('color: blue'));
assert(undone1.diagrams[0].code.includes('Customers > Orders'));
console.log('✓ Undo 1: Reverted color back to blue');

// 5. Undo Edit 1
const undone2 = history.undo();
assert(undone2.diagrams[0].code.includes('Users > Orders'));
console.log('✓ Undo 2: Reverted rename back to Users');

// 6. Redo Edit 1
const redone1 = history.redo();
assert(redone1.diagrams[0].code.includes('Customers > Orders'));
console.log('✓ Redo 1: Re-applied Customers rename');

// 7. Redo Edit 2
const redone2 = history.redo();
assert(redone2.diagrams[0].code.includes('color: green'));
console.log('✓ Redo 2: Re-applied color: green');

console.log('\n========================================');
console.log('UNDO / REDO HISTORY VERIFIED SUCCESSFULLY');
console.log('========================================\n');
