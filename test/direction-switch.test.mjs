import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const load=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('both pages have symmetric explicit flight-direction links outside the mobile-hidden header',()=>{
 for(const [file,active] of [['web/index.html','/'],['web/returns.html','/returns.html']]){
  const html=load(file);
  assert.match(html,/<link rel="stylesheet" href="\/direction-switch.css">/);
  const nav=html.match(/<nav class="direction-switch"[^>]*>([\s\S]*?)<\/nav>/)?.[1];
  assert.ok(nav, file+' missing switch navigation');
  assert.match(nav,/<a href="\/">[^<]*인천 → 해외<\/a>|<a href="\/" aria-current="page">[^<]*인천 → 해외<\/a>/);
  assert.match(nav,/<a href="\/returns.html"(?: aria-current="page")?>[^<]*유럽 → 인천<\/a>/);
  assert.match(nav,new RegExp('<a href="'+active.replaceAll('/','\\/')+'" aria-current="page">'));
  const position=html.indexOf('class="direction-switch-wrap"');
  assert.ok(position>html.indexOf('<main'),file+' switch must be in main content');
 }
});
test('mobile direction switch is visible and uses finger-friendly navigation hit targets',()=>{
 const css=load('web/direction-switch.css'),home=load('web/style.css');
 assert.match(home,/\.outline-label\{display:none\}/);
 assert.match(css,/\.direction-switch a\{[^}]*min-height:48px/);
 assert.match(css,/@media\(max-width:850px\)/);
 assert.match(css,/position:sticky/);
});
test('built site and service-worker install both directions',()=>{
 const builder=load('scripts/build-cloud.mjs'),serviceWorker=load('web/service-worker.js');
 assert.match(builder,/'direction-switch\.css'/);
 for(const asset of ['/direction-switch.css','/returns.html','/returns.js','/returns.css'])assert.ok(serviceWorker.includes("'"+asset+"'"),'Missing shell asset '+asset);
});
