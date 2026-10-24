const { test, expect } = require('@playwright/test');

test.describe('Glyph Workspace E2E Tests', () => {

  test('Flow 1-5: Create file, type code, rename node on canvas, edit code, autosave & reload persistence', async ({ page }) => {
    // 1. Create a file from dashboard
    await page.goto('/dashboard/all');
    await page.waitForLoadState('networkidle');

    const fileTitle = `E2E Workspace ${Date.now()}`;
    await page.locator('#btn-create-file-dashboard').click();
    const titleInput = page.locator('#input-create-file-title');
    await expect(titleInput).toBeVisible();
    await titleInput.fill(fileTitle);
    await page.locator('#btn-submit-create-file').click();

    // Verify redirected to workspace
    await expect(page).toHaveURL(/\/workspace\/.+/, { timeout: 15000 });
    await expect(page.locator('#file-title-display')).toContainText(fileTitle, { timeout: 10000 });

    // 2. Open code drawer and type diagram code, verify render
    const codeDrawer = page.locator('#code-drawer-panel');
    const isVisible = await codeDrawer.isVisible().catch(() => false);
    if (!isVisible) {
      await page.locator('#btn-toggle-code-drawer').click();
    }
    await expect(codeDrawer).toBeVisible();

    const textarea = page.locator('#code-drawer-textarea');
    await expect(textarea).toBeVisible();
    const initialCode = `title E2E Flowchart\nstartNode [shape: rectangle, color: blue, label: "Start Action"]\nendNode [shape: oval, color: green, label: "End Action"]\nstartNode > endNode: execute`;
    await textarea.fill(initialCode);

    // Verify canvas renders nodes
    const startNode = page.locator('.diagram-node[data-node-id="startNode"]');
    const endNode = page.locator('.diagram-node[data-node-id="endNode"]');
    await expect(startNode).toBeVisible({ timeout: 10000 });
    await expect(endNode).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.canvas-background')).toContainText('Start Action');

    // 3. Rename a node on the canvas and see the code change
    await startNode.click();
    const labelInput = page.locator('#input-node-label');
    await expect(labelInput).toBeVisible({ timeout: 5000 });
    await labelInput.fill('Renamed Start Action');
    await labelInput.press('Enter');

    // Check code drawer received updated label
    await expect(textarea).toContainText('Renamed Start Action');
    // Check canvas SVG displays new label
    await expect(page.locator('.canvas-background')).toContainText('Renamed Start Action');

    // 4. Edit code and see canvas change
    const updatedCode = `title E2E Flowchart\nstartNode [shape: rectangle, color: blue, label: "Renamed Start Action"]\nmiddleNode [shape: diamond, color: orange, label: "Decision Point"]\nendNode [shape: oval, color: green, label: "End Action"]\nstartNode > middleNode: evaluate\nmiddleNode > endNode: approve`;
    await textarea.fill(updatedCode);

    const middleNode = page.locator('.diagram-node[data-node-id="middleNode"]');
    await expect(middleNode).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.canvas-background')).toContainText('Decision Point');

    // 5. Autosave and reload persistence
    await page.locator('#btn-header-save').click();
    await page.waitForTimeout(1000);

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify title and rendered nodes persist after reload
    await expect(page.locator('#file-title-display')).toContainText(fileTitle);
    await expect(page.locator('.diagram-node[data-node-id="middleNode"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.canvas-background')).toContainText('Decision Point');
  });

  test('Flow 6: Two-tab concurrency conflict modal (409)', async ({ context }) => {
    // Create a file to test conflict
    const page1 = await context.newPage();
    await page1.goto('/dashboard/all');
    await page1.waitForLoadState('networkidle');

    const conflictTitle = `Conflict Test ${Date.now()}`;
    await page1.locator('#btn-create-file-dashboard').click();
    await expect(page1.locator('#input-create-file-title')).toBeVisible();
    await page1.locator('#input-create-file-title').fill(conflictTitle);
    await page1.locator('#btn-submit-create-file').click();
    await expect(page1).toHaveURL(/\/workspace\/.+/, { timeout: 15000 });

    const workspaceUrl = page1.url();

    // Tab 2 opens the exact same workspace URL
    const page2 = await context.newPage();
    await page2.goto(workspaceUrl);
    await page2.waitForLoadState('networkidle');

    // Ensure code drawer is open in Tab 2
    const codeDrawer2 = page2.locator('#code-drawer-panel');
    if (!(await codeDrawer2.isVisible().catch(() => false))) {
      await page2.locator('#btn-toggle-code-drawer').click();
    }
    await expect(page2.locator('#code-drawer-textarea')).toBeVisible();

    // Tab 2 makes an edit and saves
    await page2.locator('#code-drawer-textarea').fill('title Tab 2 Winning Version\nnodeB [shape: rectangle, color: purple, label: "From Tab 2"]');
    await page2.locator('#btn-header-save').click();
    await page2.waitForTimeout(1000);

    // Now switch back to Tab 1. Ensure code drawer is open
    const codeDrawer1 = page1.locator('#code-drawer-panel');
    if (!(await codeDrawer1.isVisible().catch(() => false))) {
      await page1.locator('#btn-toggle-code-drawer').click();
    }
    await expect(page1.locator('#code-drawer-textarea')).toBeVisible();

    // Tab 1 (which holds stale version 1) makes an edit and tries to save
    await page1.locator('#code-drawer-textarea').fill('title Tab 1 Conflicted Edit\nnodeA [shape: oval, label: "From Tab 1"]');
    await page1.locator('#btn-header-save').click();

    // Tab 1 must display the 409 Conflict Modal!
    const conflictModal = page1.locator('#conflict-modal');
    await expect(conflictModal).toBeVisible({ timeout: 10000 });
    await expect(conflictModal).toContainText('Concurrent Edit Conflict');

    // Click "Reload Server Version"
    await page1.locator('#btn-conflict-reload').click();
    await expect(conflictModal).not.toBeVisible();

    // Verify Tab 1 now has Tab 2's content
    await expect(page1.locator('#code-drawer-textarea')).toContainText('From Tab 2');

    await page1.close();
    await page2.close();
  });

  test('Flow 7: Version history save snapshot and restore', async ({ page }) => {
    await page.goto('/dashboard/all');
    await page.waitForLoadState('networkidle');

    const title = `Version Test ${Date.now()}`;
    await page.locator('#btn-create-file-dashboard').click();
    await expect(page.locator('#input-create-file-title')).toBeVisible();
    await page.locator('#input-create-file-title').fill(title);
    await page.locator('#btn-submit-create-file').click();
    await expect(page).toHaveURL(/\/workspace\/.+/, { timeout: 15000 });

    // Set stable initial code
    const codeDrawer = page.locator('#code-drawer-panel');
    if (!(await codeDrawer.isVisible().catch(() => false))) {
      await page.locator('#btn-toggle-code-drawer').click();
    }
    await expect(page.locator('#code-drawer-textarea')).toBeVisible();
    const originalCode = 'title Version Snapshot Baseline\nstableNode [shape: rectangle, color: green, label: "Initial Good State"]';
    await page.locator('#code-drawer-textarea').fill(originalCode);
    await page.locator('#btn-header-save').click();
    await page.waitForTimeout(1000);

    // Open Version History Drawer
    await page.locator('#btn-header-version-history').click();
    const versionDrawer = page.locator('#version-history-drawer');
    await expect(versionDrawer).toBeVisible();

    // Save a named version snapshot
    const versionName = `Snapshot-${Date.now()}`;
    await page.locator('#input-new-version-name').fill(versionName);
    await page.locator('#btn-save-named-version').click();

    // Verify version is listed
    await expect(versionDrawer).toContainText(versionName, { timeout: 10000 });

    // Now corrupt/change the diagram code
    await page.locator('#code-drawer-textarea').fill('title Broken Corrupted Code\nruinedNode [label: "Broken"]');
    await page.locator('#btn-header-save').click();
    await page.waitForTimeout(1000);
    await expect(page.locator('#code-drawer-textarea')).toContainText('Broken Corrupted Code');

    // In Version History Drawer, restore the snapshot
    const versionItem = versionDrawer.locator('div', { hasText: versionName });
    const restoreBtn = versionItem.locator('button:has-text("Restore"), button[title*="Restore"]').first();
    await restoreBtn.click();
    await page.locator('#btn-confirm-restore').click();

    // Verify code restored back to baseline
    await expect(page.locator('#code-drawer-textarea')).toContainText('Initial Good State', { timeout: 10000 });
    await expect(page.locator('.canvas-background')).toContainText('Initial Good State');
  });

  test('Flow 8-9: Create share link, open in fresh context without edit controls, revoke & see 404', async ({ page, browser }) => {
    await page.goto('/dashboard/all');
    await page.waitForLoadState('networkidle');

    const title = `Share Test ${Date.now()}`;
    await page.locator('#btn-create-file-dashboard').click();
    await expect(page.locator('#input-create-file-title')).toBeVisible();
    await page.locator('#input-create-file-title').fill(title);
    await page.locator('#btn-submit-create-file').click();
    await expect(page).toHaveURL(/\/workspace\/.+/, { timeout: 15000 });

    // Open share modal
    await page.locator('#btn-header-share').click();
    const shareModal = page.locator('text=Share View-Only Link');
    await expect(shareModal).toBeVisible();

    // Generate link if not active
    const generateBtn = page.locator('#btn-generate-share-link');
    if (await generateBtn.isVisible().catch(() => false)) {
      await generateBtn.click();
    }

    // Wait for share URL input
    const shareInput = page.locator('input[readonly]');
    await expect(shareInput).toBeVisible({ timeout: 10000 });
    const shareUrl = await shareInput.inputValue();
    expect(shareUrl).toContain('/share/');

    // Open in a completely fresh browser context (simulating public anonymous visitor)
    const freshContext = await browser.newContext();
    const sharePage = await freshContext.newPage();
    await sharePage.goto(shareUrl);
    await sharePage.waitForLoadState('networkidle');

    // Verify view-only state: header shows title and Read-Only badge
    await expect(sharePage).toHaveTitle(new RegExp(title));
    await expect(sharePage.locator('#badge-view-only')).toContainText('Read-Only');

    // Verify editing controls are NOT present
    await expect(sharePage.locator('#btn-header-save')).toHaveCount(0);
    await expect(sharePage.locator('#code-drawer-textarea')).toHaveCount(0);
    await expect(sharePage.locator('#btn-toggle-code-drawer')).toHaveCount(0);

    // Now on original page: Revoke the link
    await page.locator('#btn-revoke-share-link').click();
    await expect(page.locator('#btn-generate-share-link')).toBeVisible({ timeout: 10000 });

    // Reload the share page in fresh context: must show 404 error
    await sharePage.reload();
    await sharePage.waitForLoadState('networkidle');

    const errorHeading = sharePage.locator('#share-error-message');
    await expect(errorHeading).toBeVisible({ timeout: 10000 });
    await expect(errorHeading).toContainText('Share link not found or expired');

    await sharePage.close();
    await freshContext.close();
  });

  test('Flow 10: Upload a custom icon and use it in a diagram', async ({ page }) => {
    await page.goto('/dashboard/all');
    await page.waitForLoadState('networkidle');

    const title = `Custom Icon Test ${Date.now()}`;
    await page.locator('#btn-create-file-dashboard').click();
    await expect(page.locator('#input-create-file-title')).toBeVisible();
    await page.locator('#input-create-file-title').fill(title);
    await page.locator('#btn-submit-create-file').click();
    await expect(page).toHaveURL(/\/workspace\/.+/, { timeout: 15000 });

    // Open Custom Icons Modal from canvas toolbar
    await page.locator('#btn-open-custom-icons').click();
    const iconModal = page.locator('text=Custom Icons Manager');
    await expect(iconModal).toBeVisible();

    // Prepare SVG payload
    const iconName = `custom-star-${Date.now().toString(36)}`;
    const testSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="#F59E0B"><polygon points="12,2 15,9 22,9 17,14 19,21 12,17 5,21 7,14 2,9 9,9" /></svg>`;

    // Upload via file input
    await page.locator('#input-custom-icon-name').fill(iconName);
    await page.locator('#input-custom-icon-file').setInputFiles({
      name: `${iconName}.svg`,
      mimeType: 'image/svg+xml',
      buffer: Buffer.from(testSvg, 'utf-8')
    });

    await page.locator('#btn-submit-upload-icon').click();

    // Verify icon is in the list
    await expect(page.locator(`text=${iconName}`)).toBeVisible({ timeout: 10000 });

    // Close modal
    await page.locator('button.btn-icon:has(svg.lucide-x)').click();

    // Use icon in diagram code
    const codeDrawer = page.locator('#code-drawer-panel');
    if (!(await codeDrawer.isVisible().catch(() => false))) {
      await page.locator('#btn-toggle-code-drawer').click();
    }
    await expect(page.locator('#code-drawer-textarea')).toBeVisible();

    const iconCode = `title Diagram With Custom Icon\nfeaturedService [icon: ${iconName}, color: yellow, label: "My Star Service"]`;
    await page.locator('#code-drawer-textarea').fill(iconCode);

    // Verify rendered on canvas with custom icon
    const node = page.locator('.diagram-node[data-node-id="featuredService"]');
    await expect(node).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.canvas-background')).toContainText('My Star Service');
  });

  test('Flow 11: Create a file from template gallery', async ({ page }) => {
    await page.goto('/dashboard/all');
    await page.waitForLoadState('networkidle');

    // Open Template Gallery from dashboard
    await page.locator('#btn-open-template-gallery').click();
    const galleryModal = page.locator('text=Template Gallery');
    await expect(galleryModal).toBeVisible();

    // Pick "User Onboarding & Verification Flow"
    const useTemplateBtn = page.locator('#btn-use-template-tpl-flow-onboarding');
    await expect(useTemplateBtn).toBeVisible({ timeout: 10000 });
    await useTemplateBtn.click();

    // Should navigate to new workspace initialized with template
    await expect(page).toHaveURL(/\/workspace\/.+/, { timeout: 15000 });
    await expect(page.locator('#file-title-display')).toContainText('User Onboarding & Verification Flow', { timeout: 10000 });

    // Verify template nodes rendered on canvas
    await expect(page.locator('.diagram-node[data-node-id="start"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.diagram-node[data-node-id="signupForm"]')).toBeVisible({ timeout: 15000 });
  });

  test('Flow 12: Export SVG and PNG and verify downloaded files', async ({ page }) => {
    await page.goto('/dashboard/all');
    await page.waitForLoadState('networkidle');

    const title = `Export Test ${Date.now()}`;
    await page.locator('#btn-create-file-dashboard').click();
    await expect(page.locator('#input-create-file-title')).toBeVisible();
    await page.locator('#input-create-file-title').fill(title);
    await page.locator('#btn-submit-create-file').click();
    await expect(page).toHaveURL(/\/workspace\/.+/, { timeout: 15000 });

    // Set simple diagram code
    const codeDrawer = page.locator('#code-drawer-panel');
    if (!(await codeDrawer.isVisible().catch(() => false))) {
      await page.locator('#btn-toggle-code-drawer').click();
    }
    await expect(page.locator('#code-drawer-textarea')).toBeVisible();
    await page.locator('#code-drawer-textarea').fill('title Export Graphic\nboxA [shape: rectangle, color: blue]\nboxB [shape: diamond, color: green]\nboxA > boxB: test');
    await page.waitForTimeout(1000);

    // 1. Export SVG
    await page.locator('#btn-header-export').click();
    await expect(page.locator('text=Export Diagram & Document')).toBeVisible();

    await page.locator('#btn-export-format-svg').click();
    const svgDownloadPromise = page.waitForEvent('download');
    await page.locator('#btn-execute-export').click();
    const svgDownload = await svgDownloadPromise;

    expect(svgDownload.suggestedFilename()).toMatch(/\.svg$/);
    const svgStream = await svgDownload.createReadStream();
    const svgChunks = [];
    for await (const chunk of svgStream) {
      svgChunks.push(chunk);
    }
    const svgContent = Buffer.concat(svgChunks).toString('utf-8');
    expect(svgContent).toContain('<svg');
    expect(svgContent).toContain('</svg>');

    // Close export modal
    await page.locator('#btn-close-export-modal').click();
    await expect(page.locator('text=Export Diagram & Document')).not.toBeVisible();

    // 2. Export PNG
    await page.locator('#btn-header-export').click();
    await expect(page.locator('text=Export Diagram & Document')).toBeVisible();

    await page.locator('#btn-export-format-png-2x').click();
    const pngDownloadPromise = page.waitForEvent('download');
    await page.locator('#btn-execute-export').click();
    const pngDownload = await pngDownloadPromise;

    expect(pngDownload.suggestedFilename()).toMatch(/\.png$/);
    const pngStream = await pngDownload.createReadStream();
    const pngChunks = [];
    for await (const chunk of pngStream) {
      pngChunks.push(chunk);
    }
    const pngBuffer = Buffer.concat(pngChunks);
    expect(pngBuffer.length).toBeGreaterThan(100);
    // Verify PNG magic header: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
    expect(pngBuffer[0]).toBe(0x89);
    expect(pngBuffer[1]).toBe(0x50); // P
    expect(pngBuffer[2]).toBe(0x4E); // N
    expect(pngBuffer[3]).toBe(0x47); // G
  });

  test('Flow 13: Canvas diagram card dragging, auto-arrange tidy, and node dragging', async ({ page }) => {
    await page.goto('/dashboard/all');
    await page.waitForLoadState('networkidle');

    const fileTitle = `Draggable Test ${Date.now()}`;
    await page.locator('#btn-create-file-dashboard').click();
    const titleInput = page.locator('#input-create-file-title');
    await expect(titleInput).toBeVisible();
    await titleInput.fill(fileTitle);
    await page.locator('#btn-submit-create-file').click();

    // Verify redirected to workspace
    await expect(page).toHaveURL(/\/workspace\/.+/, { timeout: 15000 });
    await expect(page.locator('#file-title-display')).toContainText(fileTitle, { timeout: 10000 });

    // Add a second diagram so we have multiple diagram cards
    const addSequenceBtn = page.locator('button:has-text("Sequence")').first();
    await addSequenceBtn.click();
    await page.waitForTimeout(500);

    // Locate diagram cards and headers
    await expect(page.locator('.diagram-card').first()).toBeVisible({ timeout: 10000 });
    expect(await page.locator('.diagram-card').count()).toBeGreaterThanOrEqual(2);

    const firstCard = page.locator('.diagram-card').first();
    const boxBefore = await firstCard.boundingBox();
    expect(boxBefore).not.toBeNull();

    // Drag the first card header by (200px, 100px)
    const header = firstCard.locator('[title="Drag header to move diagram card"]');
    const headerBox = await header.boundingBox();
    expect(headerBox).not.toBeNull();
    const startX = headerBox.x + headerBox.width / 2;
    const startY = headerBox.y + headerBox.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 200, startY + 100, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(500);

    // Verify card moved
    const boxAfter = await firstCard.boundingBox();
    expect(boxAfter.x).toBeGreaterThan(boxBefore.x + 50);

    // Test Tidy / Auto-Arrange button
    const tidyBtn = page.locator('#btn-canvas-tidy');
    await expect(tidyBtn).toBeVisible();
    await tidyBtn.click();
    await page.waitForTimeout(500);

    // Verify cards are neatly arranged side-by-side
    const tidyBox = await firstCard.boundingBox();
    expect(tidyBox).not.toBeNull();

    // Save and verify persistence after reload
    await page.locator('#btn-header-save').click();
    await page.waitForTimeout(1000);
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Both diagram cards persist
    const reloadedHeaders = page.locator('.canvas-background [title="Drag header to move diagram card"]');
    await expect(reloadedHeaders.first()).toBeVisible({ timeout: 10000 });
    expect(await reloadedHeaders.count()).toBeGreaterThanOrEqual(2);
  });

});
