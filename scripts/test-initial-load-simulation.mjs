import puppeteer from 'puppeteer-core';

async function runAuditSimulation() {
  console.log('🚀 Starting Initial Load & Piece Interaction Simulation...');
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-webgpu'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[Store]') || text.includes('ThreeViewer') || text.includes('Error')) {
      console.log(`  [Browser Console] ${text}`);
    }
  });

  page.on('pageerror', err => {
    console.error(`  [Browser Error] ${err.toString()}`);
  });

  console.log('Navigating to http://localhost:5173/ ...');
  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 45000 });

  // Wait for 3D model to be loaded into modelStore
  console.log('Waiting for model to load in store...');
  await page.waitForFunction(() => {
    const win = window;
    const store = win.modelStore;
    return store && store.currentModel && store.pieces && store.pieces.length > 0;
  }, { timeout: 20000 }).catch(() => {
    console.log('Timeout waiting for store, checking DOM...');
  });

  // Delay 2 seconds for scene stabilization
  await new Promise(r => setTimeout(r, 2000));

  // Inspect initial state
  const initialState = await page.evaluate(() => {
    const treeRows = Array.from(document.querySelectorAll('.tree-row')).map(r => ({
      text: r.textContent ? r.textContent.trim() : '',
      isSelected: r.classList.contains('selected')
    }));

    const transformInputs = Array.from(document.querySelectorAll('.num-box input')).map(inp => inp.value);

    const store = window.modelStore;
    const storeData = store ? {
      selectedPieceId: store.selectedPiece ? store.selectedPiece.id : null,
      selectedPieceName: store.selectedPiece ? store.selectedPiece.name : null,
      piecesCount: store.pieces ? store.pieces.length : 0,
      hasGizmoAttached: !!(store.transformControls && store.transformControls.object),
      gizmoAttachedName: store.transformControls && store.transformControls.object ? store.transformControls.object.name : null,
      selectedNodeName: store.viewer && store.viewer.runtimeRoot && store.viewer.runtimeRoot.selectedNode ? store.viewer.runtimeRoot.selectedNode.name : null,
      emissiveHex: store.selectedPiece && store.selectedPiece.material && store.selectedPiece.material.emissive ? store.selectedPiece.material.emissive.getHexString() : null,
      emissiveIntensity: store.selectedPiece && store.selectedPiece.material ? store.selectedPiece.material.emissiveIntensity : 0
    } : null;

    return {
      treeRows,
      transformInputs,
      storeData
    };
  });

  console.log('\n📊 --- INITIAL STATE AUDIT ---');
  console.log('DOM Tree Rows found:', initialState.treeRows.length);
  const selectedTreeRow = initialState.treeRows.find(r => r.isSelected);
  console.log('DOM Selected Tree Row:', selectedTreeRow ? selectedTreeRow.text : 'NONE');
  console.log('Transform inputs (Pos X/Y/Z, Rot X/Y/Z, Scl X/Y/Z):', initialState.transformInputs);
  if (initialState.storeData) {
    console.log('Store Selected Piece:', initialState.storeData.selectedPieceName, `(ID: ${initialState.storeData.selectedPieceId})`);
    console.log('Store Pieces Count:', initialState.storeData.piecesCount);
    console.log('Gizmo Attached Object:', initialState.storeData.gizmoAttachedName || 'NONE');
    console.log('Viewer runtimeRoot Selected Node:', initialState.storeData.selectedNodeName || 'NONE');
    console.log('Selected Piece Emissive Glow:', `#${initialState.storeData.emissiveHex}`, `intensity: ${initialState.storeData.emissiveIntensity}`);
  }

  // Click on the second garment piece row (style paddingLeft = 28px)
  console.log('\n🖱️ --- SIMULATING PIECE CLICK INTERACTION ---');
  const clickedPieceName = await page.evaluate(() => {
    // Garment pieces have style paddingLeft = 28px
    const pieceElements = Array.from(document.querySelectorAll('.tree-row')).filter(el => {
      return el.style.paddingLeft === '28px';
    });

    if (pieceElements.length > 1) {
      const secondPiece = pieceElements[1];
      secondPiece.click();
      return secondPiece.textContent ? secondPiece.textContent.trim() : '';
    }
    return null;
  });

  console.log(`Clicked on Garment Panel Tree Row: "${clickedPieceName}"`);

  // Wait 1.5 seconds for reactivity & state propagation
  await new Promise(r => setTimeout(r, 1500));

  // Inspect state after click
  const afterClickState = await page.evaluate(() => {
    const treeRows = Array.from(document.querySelectorAll('.tree-row')).map(r => ({
      text: r.textContent ? r.textContent.trim() : '',
      isSelected: r.classList.contains('selected')
    }));

    const transformInputs = Array.from(document.querySelectorAll('.num-box input')).map(inp => inp.value);

    const store = window.modelStore;
    const storeData = store ? {
      selectedPieceId: store.selectedPiece ? store.selectedPiece.id : null,
      selectedPieceName: store.selectedPiece ? store.selectedPiece.name : null,
      hasGizmoAttached: !!(store.transformControls && store.transformControls.object),
      gizmoAttachedName: store.transformControls && store.transformControls.object ? store.transformControls.object.name : null,
      selectedNodeName: store.viewer && store.viewer.runtimeRoot && store.viewer.runtimeRoot.selectedNode ? store.viewer.runtimeRoot.selectedNode.name : null,
      emissiveHex: store.selectedPiece && store.selectedPiece.material && store.selectedPiece.material.emissive ? store.selectedPiece.material.emissive.getHexString() : null,
      emissiveIntensity: store.selectedPiece && store.selectedPiece.material ? store.selectedPiece.material.emissiveIntensity : 0
    } : null;

    return {
      treeRows,
      transformInputs,
      storeData
    };
  });

  console.log('\n📊 --- POST-CLICK STATE AUDIT ---');
  const postSelectedTreeRow = afterClickState.treeRows.find(r => r.isSelected);
  console.log('DOM Selected Tree Row after click:', postSelectedTreeRow ? postSelectedTreeRow.text : 'NONE');
  console.log('Transform inputs after click:', afterClickState.transformInputs);
  if (afterClickState.storeData) {
    console.log('Store Selected Piece after click:', afterClickState.storeData.selectedPieceName, `(ID: ${afterClickState.storeData.selectedPieceId})`);
    console.log('Gizmo Attached Object after click:', afterClickState.storeData.gizmoAttachedName || 'NONE');
    console.log('Viewer runtimeRoot Selected Node after click:', afterClickState.storeData.selectedNodeName || 'NONE');
    console.log('Selected Piece Emissive Glow after click:', `#${afterClickState.storeData.emissiveHex}`, `intensity: ${afterClickState.storeData.emissiveIntensity}`);
  }

  // Verification Checks
  console.log('\n⚖️ --- AUDIT RESULTS ---');
  const checks = [
    {
      name: 'Initial piece selected in tree',
      pass: !!selectedTreeRow
    },
    {
      name: 'Initial piece selected in store',
      pass: !!initialState.storeData?.selectedPieceId
    },
    {
      name: 'Initial piece highlighted (#ef4444 emissive glow)',
      pass: initialState.storeData?.emissiveHex === 'ef4444' || (initialState.storeData?.emissiveIntensity || 0) > 0
    },
    {
      name: 'Initial gizmo attached to selected piece',
      pass: !!initialState.storeData?.hasGizmoAttached
    },
    {
      name: 'Initial transform inputs populated with numeric coordinates',
      pass: initialState.transformInputs.length === 9 && initialState.transformInputs.every(v => v !== '')
    },
    {
      name: 'Post-click piece changed in tree',
      pass: postSelectedTreeRow?.text !== selectedTreeRow?.text
    },
    {
      name: 'Post-click store updated selected piece',
      pass: afterClickState.storeData?.selectedPieceId !== initialState.storeData?.selectedPieceId
    },
    {
      name: 'Post-click gizmo attached to newly selected piece',
      pass: afterClickState.storeData?.gizmoAttachedName === afterClickState.storeData?.selectedPieceName
    },
    {
      name: 'Post-click newly selected piece has emissive glow',
      pass: afterClickState.storeData?.emissiveHex === 'ef4444' || (afterClickState.storeData?.emissiveIntensity || 0) > 0
    }
  ];

  let allPassed = true;
  for (const c of checks) {
    if (c.pass) {
      console.log(`  ✅ [PASS] ${c.name}`);
    } else {
      console.log(`  ❌ [FAIL] ${c.name}`);
      allPassed = false;
    }
  }

  await browser.close();

  if (allPassed) {
    console.log('\n🎉 ALL INITIAL LOAD & INTERACTION SIMULATION TESTS PASSED!');
    process.exit(0);
  } else {
    console.log('\n⚠️ SOME SIMULATION AUDIT CHECKS FAILED!');
    process.exit(1);
  }
}

runAuditSimulation().catch(err => {
  console.error('Audit simulation error:', err);
  process.exit(1);
});
