import puppeteer from 'puppeteer-core';

async function verifyFeatures() {
  console.log('🧪 Verifying UV editor reset, scrollable sidebar, and fullscreen toggle...');
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });
  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 45000 });

  await page.waitForFunction(() => {
    return window.modelStore && window.modelStore.currentModel && window.modelStore.pieces.length > 0;
  }, { timeout: 20000 });

  await new Promise(r => setTimeout(r, 1500));

  // 1. Verify uv-proj button removed from left toolbar
  const uvProjBtn = await page.$('button[title*="Canonical UV Auto-Projection"]');
  console.log('1. Left toolbar uv-proj button present:', !!uvProjBtn ? '❌ (STILL PRESENT)' : '✅ (REMOVED)');

  // 2. Verify UV ops sidebar is scrollable
  const sidebarStyles = await page.evaluate(() => {
    const el = document.querySelector('.uv-ops-sidebar');
    if (!el) return null;
    const computed = window.getComputedStyle(el);
    return {
      overflowY: computed.overflowY,
      width: computed.width
    };
  });
  console.log('2. UV Ops Sidebar style:', sidebarStyles);

  // 3. Test UV Viewport Fullscreen toggle & ensure only 1 fullscreen button exists
  const fullscreenBtns = await page.$$('.uv-editor-panel button[title*="Fullscreen"]');
  console.log('3. UV Fullscreen button count in UV editor:', fullscreenBtns.length, fullscreenBtns.length === 1 ? '✅ (EXACTLY 1)' : '❌ (DUPLICATE DETECTED)');

  const fullscreenBtn = fullscreenBtns[0];
  if (fullscreenBtn) {
    await fullscreenBtn.click();
    await new Promise(r => setTimeout(r, 300));
    const isMaximized = await page.evaluate(() => {
      const section = document.querySelector('.upper-workspace-section');
      const uvPanel = document.querySelector('.uv-editor-panel');
      return {
        hasMaxClass: section?.classList.contains('maximized-uv'),
        uvPanelWidth: uvPanel ? window.getComputedStyle(uvPanel).width : null,
        is3DHidden: !document.querySelector('.viewport-panel')
      };
    });
    console.log('3B. After UV Fullscreen click:', isMaximized);

    // Toggle back
    const exitBtn = await page.$('.uv-editor-panel button[title*="Exit Fullscreen"]');
    if (exitBtn) await exitBtn.click();
    await new Promise(r => setTimeout(r, 300));
  }

  // 3C. Verify Sub-toolbar has ONLY Pin Island and Snapping buttons (all other tools removed)
  const subToolbarCheck = await page.evaluate(() => {
    const cluster = document.querySelector('.uv-sub-toolbar-cluster');
    if (!cluster) return null;
    const buttons = Array.from(cluster.querySelectorAll('button'));
    const titles = buttons.map(b => b.getAttribute('title'));
    return {
      count: buttons.length,
      titles
    };
  });
  console.log('3C. Sub-toolbar cluster buttons:', subToolbarCheck);

  // 3D. Test Pin Island Functionality
  const pinTest = await page.evaluate(() => {
    const uvStore = window.uvOrganizerStore;
    const modelStore = window.modelStore;
    const p0 = modelStore.pieces[0];

    // Pin p0
    uvStore.pinnedPieceIds = [p0.id];
    const isPinnedInitial = uvStore.isPiecePinned(p0.id);

    const uvBefore = p0.mesh.geometry.attributes.uv.array[0];
    uvStore.translatePiecesGroupUV([p0.id], 0.2, 0.2);
    const uvAfterTranslate = p0.mesh.geometry.attributes.uv.array[0];

    // Unpin p0
    uvStore.pinnedPieceIds = [];
    uvStore.translatePiecesGroupUV([p0.id], 0.2, 0.2);
    const uvAfterUnpinnedTranslate = p0.mesh.geometry.attributes.uv.array[0];

    return {
      isPinnedInitial,
      uvBefore,
      uvAfterTranslate,
      pinnedBlockedMove: uvBefore === uvAfterTranslate,
      unpinnedAllowedMove: uvAfterTranslate !== uvAfterUnpinnedTranslate
    };
  });
  console.log('3D. Pin Island functionality test:', pinTest);

  // 4. Test Reset to Original UV layout
  const resetResult = await page.evaluate(() => {
    const uvStore = window.uvOrganizerStore;
    const modelStore = window.modelStore;

    // Pack UVs first
    uvStore.arrangeAssignedUVs();
    const packedUv0 = modelStore.pieces[0].mesh.geometry.attributes.uv.array[0];

    // Click Reset
    const count = uvStore.resetAllPiecesToOriginalFactoryUV();
    const restoredUv0 = modelStore.pieces[0].mesh.geometry.attributes.uv.array[0];

    return {
      count,
      packedUv0,
      restoredUv0,
      different: packedUv0 !== restoredUv0
    };
  });
  console.log('4. UV Reset to Factory Original Result:', resetResult);

  await browser.close();
  console.log('\n🎉 ALL CHECKS COMPLETED!');
}

verifyFeatures().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
