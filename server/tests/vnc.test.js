import test from 'node:test';import assert from 'node:assert/strict';
import {vncSocketUrl,keysymForChar,keysymForKey,KEY_BAR,XK,vncStatusText} from '../../client/src/lib/vnc.js';
test('VNC socket url goes through /iphone on the dashboard origin, wss on https',()=>{
 assert.equal(vncSocketUrl('stue',{protocol:'https:',host:'dash.example'}),'wss://dash.example/iphone/api/mac/vnc?mac=stue');
 assert.equal(vncSocketUrl('a b',{protocol:'http:',host:'localhost:5173'}),'ws://localhost:5173/iphone/api/mac/vnc?mac=a%20b');
});
test('keysyms: latin-1 as is, unicode with the 0x01000000 prefix, specials mapped',()=>{
 assert.equal(keysymForChar('a'),0x61);assert.equal(keysymForChar('æ'),0xe6);assert.equal(keysymForChar('€'),0x01000000|0x20ac);assert.equal(keysymForChar('😀'),0x01000000|0x1f600);
 assert.equal(keysymForChar('\n'),XK.Return);assert.equal(keysymForChar('\t'),XK.Tab);
 assert.equal(keysymForKey('Backspace'),XK.BackSpace);assert.equal(keysymForKey('ArrowLeft'),XK.Left);assert.equal(keysymForKey('a'),null);
 assert.ok(KEY_BAR.some(([label,sym,sticky])=>label==='⌘'&&sym===XK.Super_L&&sticky));
 assert.equal(vncStatusText('error','Feil passord'),'Feil passord');assert.equal(vncStatusText('connected'),'Tilkoblet');
});
