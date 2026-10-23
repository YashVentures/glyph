import assert from 'node:assert';

const API_BASE = 'http://127.0.0.1:8000/api/v1';

async function testDashboardCrud() {
  console.log('Testing Dashboard CRUD Operations against live FastAPI + MongoDB backend...\n');

  // 1. Create a Folder
  console.log('1. Creating folder "Microservices Architecture"...');
  let res = await fetch(`${API_BASE}/folders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Microservices Architecture' })
  });
  assert.strictEqual(res.status, 201);
  let json = await res.json();
  assert.strictEqual(json.success, true);
  const folderId = json.folder.id;
  assert.strictEqual(json.folder.name, 'Microservices Architecture');
  console.log(`   ✓ Folder created with ID: ${folderId}`);

  // 2. Rename the Folder
  console.log('2. Renaming folder to "Backend & Microservices"...');
  res = await fetch(`${API_BASE}/folders/${folderId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Backend & Microservices' })
  });
  assert.strictEqual(res.status, 200);
  json = await res.json();
  assert.strictEqual(json.folder.name, 'Backend & Microservices');
  console.log('   ✓ Folder renamed successfully');

  // 3. Create a File
  console.log('3. Creating file "Auth & API Gateway Flow"...');
  res = await fetch(`${API_BASE}/files`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Auth & API Gateway Flow',
      folderId: null,
      docContent: '# Auth & API Gateway Flow',
      canvasData: JSON.stringify({ diagrams: [] })
    })
  });
  assert.strictEqual(res.status, 201);
  json = await res.json();
  const fileId = json.file.id;
  assert.strictEqual(json.file.title, 'Auth & API Gateway Flow');
  console.log(`   ✓ File created with ID: ${fileId}`);

  // 4. Rename the File
  console.log('4. Renaming file to "Auth & API Gateway Flow v2"...');
  res = await fetch(`${API_BASE}/files/${fileId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Auth & API Gateway Flow v2' })
  });
  assert.strictEqual(res.status, 200);
  json = await res.json();
  assert.strictEqual(json.file.title, 'Auth & API Gateway Flow v2');
  console.log('   ✓ File renamed successfully');

  // 5. Move the File into Folder
  console.log(`5. Moving file into folder "${folderId}"...`);
  res = await fetch(`${API_BASE}/files/${fileId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder_id: folderId })
  });
  assert.strictEqual(res.status, 200);
  json = await res.json();
  assert.strictEqual(json.file.folder_id, folderId);
  console.log('   ✓ File moved into folder successfully');

  // 6. Duplicate the File
  console.log('6. Duplicating file...');
  res = await fetch(`${API_BASE}/files/${fileId}/duplicate`, {
    method: 'POST'
  });
  assert.strictEqual(res.status, 201);
  json = await res.json();
  const dupId = json.file.id;
  assert.notStrictEqual(dupId, fileId);
  assert.strictEqual(json.file.title, 'Auth & API Gateway Flow v2 (Copy)');
  console.log(`   ✓ Duplicate created with ID: ${dupId}`);

  // 7. Delete Duplicated File
  console.log(`7. Deleting duplicated file "${dupId}"...`);
  res = await fetch(`${API_BASE}/files/${dupId}`, {
    method: 'DELETE'
  });
  assert.strictEqual(res.status, 200);
  console.log('   ✓ Duplicated file deleted');

  // 8. Delete Original File
  console.log(`8. Deleting original file "${fileId}"...`);
  res = await fetch(`${API_BASE}/files/${fileId}`, {
    method: 'DELETE'
  });
  assert.strictEqual(res.status, 200);
  console.log('   ✓ Original file deleted');

  // 9. Delete Folder
  console.log(`9. Deleting folder "${folderId}"...`);
  res = await fetch(`${API_BASE}/folders/${folderId}`, {
    method: 'DELETE'
  });
  assert.strictEqual(res.status, 200);
  console.log('   ✓ Folder deleted');

  console.log('\n========================================');
  console.log('ALL 9 DASHBOARD CRUD OPERATIONS VERIFIED!');
  console.log('========================================\n');
}

testDashboardCrud().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
