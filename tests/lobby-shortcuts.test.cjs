'use strict';

// Static smoke checks for the lobby shortcuts and stylesheet ordering.
// They do not replace a browser layout test.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const index = read('index.html');
const mobile = read('lobby-mobile-polish.css');
const roles = read('role-visuals.js');

function buttonsInShortcutRow() {
  const row = index.match(/<div id="lobbyStatsActions"[^>]*>(.*?)<\/div>/s);
  assert.ok(row, 'Missing lobby shortcut row');
  return [...row[1].matchAll(/<button\b[^>]*id="([^"]+)"[^>]*onclick="location\.href='([^']+)'"[^>]*>([^<]+)<\/button>/g)]
    .map(([, id, url, label]) => ({ id, url, label }));
}

test('one player-and-stats link, then form, history and ScoringArena', () => {
  assert.deepEqual(buttonsInShortcutRow(), [
    { id: 'playersBtn', url: 'players.html', label: 'Spillere og statistikk' },
    { id: 'formStatsBtn', url: 'form-stats.html', label: 'Form stats' },
    { id: 'matchHistoryBtn', url: 'match-history.html', label: 'Kamphistorikk' },
    { id: 'scoringArenaBtn', url: 'scoringarena.html', label: 'ScoringArena · Lokal 1v1' }
  ]);
  assert.doesNotMatch(index, /playerCareerStatsBtn/);
});

test('later mobile stylesheet owns two-column shortcut grid', () => {
  const header = index.indexOf('lobby-header.css?v=');
  const polish = index.indexOf('lobby-mobile-polish.css?v=');
  assert.ok(header >= 0 && polish > header, 'Mobile polish must load after lobby header');
  assert.match(mobile, /@media\s*\(max-width:\s*760px\)[\s\S]*?#lobbyView\s+#lobbyStatsActions\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
});

test('role-render fallback reuses rather than duplicates player shortcut', () => {
  assert.match(roles, /let button=document\.getElementById\(id\)/);
  assert.match(roles, /add\('playersBtn','Spillere og statistikk','players\.html'\)/);
});
