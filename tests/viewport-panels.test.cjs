const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = html.indexOf('      function floatingPanelPosition(');
const end = html.indexOf('      function placeFloatingPanel(', start);
const context = vm.createContext({});
vm.runInContext(html.slice(start, end), context);
test('floating panels remain within desktop, mobile, zoomed and keyboard viewports', () => {
  for (const viewport of [
    { left: 0, top: 0, width: 1100, height: 900 },
    { left: 0, top: 0, width: 360, height: 640 },
    { left: 0, top: 0, width: 320, height: 230 },
    { left: 120, top: 75, width: 280, height: 300 },
  ]) {
    for (const x of [-100, 0, viewport.width / 2, viewport.width + 200]) {
      for (const y of [-100, 0, viewport.height / 2, viewport.height + 200]) {
        const result = context.floatingPanelPosition(
          { right: x, top: y, bottom: y + 34 }, viewport, { width: 360, height: 650 });
        assert.ok(result.left >= viewport.left + 12);
        assert.ok(result.left + result.width <= viewport.left + viewport.width - 12);
        assert.ok(result.top >= viewport.top + 12);
        assert.ok(result.top + Math.min(650, result.maxHeight) <= viewport.top + viewport.height - 12);
      }
    }
  }
});
test('panels flip above the trigger when there is insufficient space below', () => {
  const result = context.floatingPanelPosition({ right: 1000, top: 700, bottom: 734 },
    { left: 0, top: 0, width: 1100, height: 800 }, { width: 360, height: 300 });
  assert.equal(result.top, 392);
  assert.equal(result.left, 640);
});
test('all inline application scripts compile', () => {
  for (const [, script] of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) new vm.Script(script);
});

