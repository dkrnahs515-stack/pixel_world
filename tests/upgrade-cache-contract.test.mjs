import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('every local module reachable from the upgrade entry has a fresh physical release URL',async()=>{
  const visited=new Set();
  async function visit(url){
    if(visited.has(url.href))return;visited.add(url.href);
    assert.ok(url.pathname.endsWith('-20260905-upgrade.js'),url.pathname);
    const source=await readFile(url,'utf8');
    for(const match of source.matchAll(/(?:from\s*|import\s*\(?\s*)["'](\.\/[^"']+\.js)["']/g))await visit(new URL(match[1],url));
  }
  await visit(new URL('../src/main-20260903-volcano-20260905-upgrade.js',import.meta.url));
  assert.ok(visited.size>=78);
});
