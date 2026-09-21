const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
const path = require('node:path');
function loadTs(name) {
  const file = path.join(__dirname, '..', 'lib', name + '.ts');
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const m = new Module(file, module); m._compile(output, file); return m.exports;
}
const { extractEvents } = loadTs('chatStream');
const event = data => '\0EVT:' + JSON.stringify(data) + '\0';
function parseChunks(chunks) {
  let rest = ''; const result = [];
  for (const chunk of chunks) { const parsed = extractEvents(rest + chunk); result.push(...parsed.segments); rest = parsed.rest; }
  return { text: result.filter(s => s.type === 'text').map(s => s.value).join(''), events: result.filter(s => s.type === 'event').map(s => s.value), rest };
}
test('every split point preserves Unicode dialogue and all control events', () => {
  const wire = 'Hello 🌙.' + event({type:'ping'}) + event({type:'failover'}) + 'Next.' + event({type:'relationship', level:12});
  for(let split=0;split<=wire.length;split++) {
    assert.deepEqual(parseChunks([wire.slice(0,split),wire.slice(split)]), { text:'Hello 🌙.Next.',events:[{type:'ping'},{type:'failover'},{type:'relationship',level:12}],rest:'' });
  }
  assert.equal(parseChunks([...wire]).text, 'Hello 🌙.Next.');
});
test('malformed events do not leak into dialogue', () => {
  assert.equal(parseChunks(['Hi\0EVT:{bad}\0there.']).text, 'Hithere.');
  assert.deepEqual(extractEvents('Reply\0EV'), {segments:[{type:'text',value:'Reply'}], rest:'\0EV'});
});
test('optional local settings survive unavailable or corrupt storage', () => {
  const { loadStory, writeLocal } = loadTs('storySettings');
  global.localStorage = {getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}};
  assert.equal(loadStory('test').tone, 'character'); assert.equal(writeLocal('test', {}), false);
  global.localStorage = {getItem(){return '{broken'}};
  assert.equal(loadStory('test').persona, '');
  global.localStorage = {getItem(){return JSON.stringify({scene: 'x'.repeat(2000), tone:'unknown', persona:23})}};
  assert.equal(loadStory('test').scene.length,1200); assert.equal(loadStory('test').persona,''); assert.equal(loadStory('test').tone,'character');
});

test('final reconciliation and incomplete notices survive every transport split',()=>{
 const final={type:'reply_final',text:'"All done."\n*She waves*'};
 const incomplete={type:'reply_incomplete',message:'Use Continue to finish.'};
 const wire='Draft'+event(final)+event(incomplete);
 for(let i=0;i<=wire.length;i++)assert.deepEqual(parseChunks([wire.slice(0,i),wire.slice(i)]),{text:'Draft',events:[final,incomplete],rest:''});
});
