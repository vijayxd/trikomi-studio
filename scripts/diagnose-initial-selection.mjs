import puppeteer from 'puppeteer-core';

async function diagnose() {
  console.log('🔍 Starting Deep Diagnostic for selectedNode on Initial Load...');
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
    if (text.includes('[Store]') || text.includes('[ThreeViewer]') || text.includes('Raycast') || text.includes('selectedNode')) {
      console.log(`  [Console] ${text}`);
    }
  });

  console.log('Navigating to http://localhost:5173/ ...');
  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded', timeout: 45000 });

  // Wait for initial model to be loaded
  await page.waitForFunction(() => {
    const win = window;
    return win.modelStore && win.modelStore.currentModel && win.modelStore.pieces.length > 0;
  }, { timeout: 20000 });

  await new Promise(r => setTimeout(r, 2000));

  // Check 1: Initial state of selectedNode, pieces, and runtimeRoot
  const initialDiagnosis = await page.evaluate(() => {
    const store = window.modelStore;
    const root = store.viewer?.runtimeRoot;
    return {
      hasViewer: !!store.viewer,
      hasRuntimeRoot: !!root,
      runtimeRootChildrenCount: root ? root.children.length : 0,
      runtimeRootChildrenNames: root ? root.children.map(c => c.name) : [],
      runtimeRootChild0SubChildrenCount: root && root.children[0] ? root.children[0].children.length : 0,
      selectedNodeName: root?.selectedNode?.name || null,
      selectedNodeObjectExists: !!root?.selectedNode?.nativeObject,
      selectedPieceName: store.selectedPiece?.name || null,
      selectedPieceNodeName: store.selectedPiece?.meshNode?.name || null,
      selectedPieceMatchesRootSelectedNode: root?.selectedNode === store.selectedPiece?.meshNode,
      editingMode: store.viewer?.store?.editingMode
    };
  });

  console.log('\n--- 1. INITIAL LOAD STATE ---');
  console.log(JSON.stringify(initialDiagnosis, null, 2));

  // Check 2: Try 3D viewport raycast clicks on canvas
  console.log('\n--- 2. TESTING 3D VIEWPORT CANVAS CLICKS ---');
  const canvasBox = await page.evaluate(() => {
    const canvas = document.querySelector('.viewport-canvas-mount canvas') || document.querySelector('canvas');
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
  });

  console.log('Canvas bounding box:', canvasBox);

  if (canvasBox) {
    // Click at center (should hit the garment)
    const centerX = canvasBox.x + canvasBox.width * 0.5;
    const centerY = canvasBox.y + canvasBox.height * 0.5;
    console.log(`Clicking canvas center (${centerX.toFixed(0)}, ${centerY.toFixed(0)})...`);
    await page.mouse.click(centerX, centerY);
    await new Promise(r => setTimeout(r, 1000));

    const postClickCenter = await page.evaluate(() => {
      const store = window.modelStore;
      const root = store.viewer?.runtimeRoot;
      return {
        selectedNodeName: root?.selectedNode?.name || null,
        selectedPieceName: store.selectedPiece?.name || null
      };
    });
    console.log('After center click:', postClickCenter);

    // Click slightly to the left (should hit left panel or background)
    const leftX = canvasBox.x + canvasBox.width * 0.42;
    const leftY = canvasBox.y + canvasBox.height * 0.48;
    console.log(`Clicking left panel point (${leftX.toFixed(0)}, ${leftY.toFixed(0)})...`);
    await page.mouse.click(leftX, leftY);
    await new Promise(r => setTimeout(r, 1000));

    const postClickLeft = await page.evaluate(() => {
      const store = window.modelStore;
      const root = store.viewer?.runtimeRoot;
      return {
        selectedNodeName: root?.selectedNode?.name || null,
        selectedPieceName: store.selectedPiece?.name || null
      };
    });
    console.log('After left click:', postClickLeft);

    // Click slightly to the right (should hit right panel)
    const rightX = canvasBox.x + canvasBox.width * 0.58;
    const rightY = canvasBox.y + canvasBox.height * 0.48;
    console.log(`Clicking right panel point (${rightX.toFixed(0)}, ${rightY.toFixed(0)})...`);
    await page.mouse.click(rightX, rightY);
    await new Promise(r => setTimeout(r, 1000));

    const postClickRight = await page.evaluate(() => {
      const store = window.modelStore;
      const root = store.viewer?.runtimeRoot;
      return {
        selectedNodeName: root?.selectedNode?.name || null,
        selectedPieceName: store.selectedPiece?.name || null
      };
    });
    console.log('After right click:', postClickRight);
  }

  // Check 3: Now switch to model #2 (index 1) and test what changes!
  console.log('\n--- 3. SWITCHING TO MODEL 2 & TESTING SELECTION ---');
  await page.evaluate(async () => {
    await window.modelStore.loadCuratedModelByIndex(1, window.uvOrganizerStore);
  });
  await new Promise(r => setTimeout(r, 3000));

  const model2State = await page.evaluate(() => {
    const store = window.modelStore;
    const root = store.viewer?.runtimeRoot;
    return {
      modelTitle: store.modelMeta.title,
      piecesCount: store.pieces.length,
      selectedNodeName: root?.selectedNode?.name || null,
      selectedPieceName: store.selectedPiece?.name || null,
      selectedPieceMatchesRootSelectedNode: root?.selectedNode === store.selectedPiece?.meshNode
    };
  });
  console.log('Model 2 State immediately after switch:', model2State);

  if (canvasBox) {
    const centerX = canvasBox.x + canvasBox.width * 0.5;
    const centerY = canvasBox.y + canvasBox.height * 0.5;
    console.log(`Clicking center on Model 2...`);
    await page.mouse.click(centerX, centerY);
    await new Promise(r => setTimeout(r, 1000));

    const postModel2Click = await page.evaluate(() => {
      const store = window.modelStore;
      const root = store.viewer?.runtimeRoot;
      return {
        selectedNodeName: root?.selectedNode?.name || null,
        selectedPieceName: store.selectedPiece?.name || null
      };
    });
    console.log('After center click on Model 2:', postModel2Click);
  }

  await browser.close();
  console.log('\n✅ Diagnostic completed.');
}

diagnose().catch(err => {
  console.error('Diagnosis failed:', err);
  process.exit(1);
});
