function toggle(hdr) {
  var b = hdr.nextElementSibling, c = hdr.querySelector('.chev');
  b.classList.toggle('open'); c.classList.toggle('open');
}
function toggleBP(hdr) { toggle(hdr); }

function isImport(code) {
  return /^\s*(?:import\s|import\{|\}\s+from\s)/.test(code);
}
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function toLines(input) {
  if (Array.isArray(input)) return input;
  return typeof input === 'string' && input ? input.split('\n') : [];
}
function loadPrDiffs() {
  var el = document.getElementById('pr-diffs-json');
  if (!el) return null;
  try { return JSON.parse(el.textContent || ''); }
  catch (err) { console.error('Failed to parse PR diff JSON payload', err); return null; }
}

function detectMoves(dels, adds) {
  var TH = 3, md = {}, ma = {};
  for (var di = 0; di < dels.length; di++) {
    if (md[di]) continue;
    var db = [di];
    for (var d2 = di + 1; d2 < dels.length && d2 - di < 40; d2++) {
      if (dels[d2].consecutive && !md[d2]) db.push(d2); else break;
    }
    if (db.length < TH) continue;
    for (var ai = 0; ai < adds.length; ai++) {
      if (ma[ai] || dels[di].oldLine === adds[ai].newLine) continue;
      var ab = [ai];
      for (var a2 = ai + 1; a2 < adds.length && a2 - ai < 40; a2++) {
        if (adds[a2].consecutive && !ma[a2]) ab.push(a2); else break;
      }
      if (ab.length < TH) continue;
      var ml = Math.min(db.length, ab.length), matches = 0;
      for (var m = 0; m < ml; m++) {
        if (dels[db[m]].code === adds[ab[m]].code) matches++;
      }
      if (matches >= TH && matches >= ml * 0.7) {
        for (var k = 0; k < ml; k++) {
          var exact = dels[db[k]].code === adds[ab[k]].code;
          md[db[k]] = { exact: exact }; ma[ab[k]] = { exact: exact };
        }
        break;
      }
    }
  }
  return { movedDels: md, movedAdds: ma };
}

function parseDiff(lines) {
  var oldLine = 0, newLine = 0, inHunk = false;
  var parsed = [], dels = [], adds = [], previousType;
  lines.forEach(function(line) {
    var hunk = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) {
      oldLine = Number(hunk[1]); newLine = Number(hunk[2]); inHunk = true;
      parsed.push({ type: 'hunk', code: line }); previousType = null; return;
    }
    if (line.startsWith('diff --git ')) inHunk = false;
    var prefix = line.charAt(0), entry;
    if (inHunk && prefix === '+') {
      entry = { type: 'add', code: line.slice(1), newLine: newLine++, moveIndex: adds.length,
        consecutive: previousType === 'add' && adds[adds.length - 1].newLine + 1 === newLine - 1 };
      adds.push(entry);
    } else if (inHunk && prefix === '-') {
      entry = { type: 'del', code: line.slice(1), oldLine: oldLine++, moveIndex: dels.length,
        consecutive: previousType === 'del' && dels[dels.length - 1].oldLine + 1 === oldLine - 1 };
      dels.push(entry);
    } else if (inHunk && prefix === ' ') {
      entry = { type: 'ctx', code: line.slice(1), oldLine: oldLine++, newLine: newLine++ };
    } else {
      if (!line) return; // Splitter's trailing empty item is not a source line.
      entry = { type: 'meta', code: line };
    }
    entry.importLine = ['add', 'del', 'ctx'].includes(entry.type) && isImport(entry.code);
    parsed.push(entry); previousType = entry.type;
  });
  return { entries: parsed, moves: detectMoves(dels, adds) };
}

/** Render the complete unified diff by default; filtering is an explicit view option. */
function renderDiff(target, diffInput, options) {
  var el = typeof target === 'string' ? document.getElementById(target) || document.querySelector(target) : target;
  if (!el) return;
  var lines = toLines(diffInput);
  if (!lines.length) {
    el.innerHTML = '<div class="diff-unavailable">Text patch unavailable. Check the source diff for binary files or omitted patches.</div>';
    return;
  }
  var data = parseDiff(lines), hideImports = !!(options && options.hideImports);
  var importCount = data.entries.filter(function(p) { return p.importLine; }).length;
  var rendered = data.entries.filter(function(p) { return !hideImports || !p.importLine; });
  var rows = rendered.map(function(p) {
    var cls = 'diff-' + p.type;
    var move = p.type === 'add' ? data.moves.movedAdds[p.moveIndex] : p.type === 'del' ? data.moves.movedDels[p.moveIndex] : null;
    if (move) cls = 'diff-moved-' + p.type + (move.exact ? '' : '-edited');
    return '<tr class="' + cls + '"><td class="diff-ln">' + (p.oldLine === undefined ? '' : p.oldLine) +
      '</td><td class="diff-ln">' + (p.newLine === undefined ? '' : p.newLine) +
      '</td><td class="diff-code">' + esc(p.code) + '</td></tr>';
  });
  var toolbar = importCount ? '<div class="diff-toolbar"><label><input class="diff-import-toggle" type="checkbox"' +
    (hideImports ? ' checked' : '') + '> Hide import lines</label><span>' + importCount + ' import line(s) ' +
    (hideImports ? 'hidden' : 'shown') + '</span></div>' : '';
  el.innerHTML = toolbar + '<table class="diff-table"><tbody>' + rows.join('') + '</tbody></table>';
  var checkbox = el.querySelector && el.querySelector('.diff-import-toggle');
  if (checkbox) checkbox.onchange = function() { renderDiff(el, diffInput, { hideImports: this.checked }); };
}

document.addEventListener('DOMContentLoaded', function() {
  var prDiffs = loadPrDiffs();
  if (!prDiffs) return;
  var els = document.querySelectorAll('[data-diff]');
  for (var i = 0; i < els.length; i++) {
    var key = els[i].getAttribute('data-diff');
    if (key && Object.prototype.hasOwnProperty.call(prDiffs, key)) renderDiff(els[i], prDiffs[key]);
  }
});
