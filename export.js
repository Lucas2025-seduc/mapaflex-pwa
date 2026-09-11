const DEFAULT_W = 290;
const DEFAULT_H = 160;
const PAD = 80;

function dims(n) { return { w: Number(n.w) || DEFAULT_W, h: Number(n.h) || DEFAULT_H }; }
function esc(s = '') { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c])); }
function safeName(s = 'mapaflex') { return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'mapaflex'; }
function downloadBlob(blob, filename) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1200); }

export function getMapBounds(map) {
  if (!map.nodes?.length) return { minX: 0, minY: 0, maxX: 1200, maxY: 800, width: 1200, height: 800 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of map.nodes) {
    const { w, h } = dims(n);
    minX = Math.min(minX, Number(n.x) || 0);
    minY = Math.min(minY, Number(n.y) || 0);
    maxX = Math.max(maxX, (Number(n.x) || 0) + w);
    maxY = Math.max(maxY, (Number(n.y) || 0) + h);
  }
  return { minX: minX - PAD, minY: minY - PAD, maxX: maxX + PAD, maxY: maxY + PAD, width: maxX - minX + PAD * 2, height: maxY - minY + PAD * 2 };
}

function wrapText(text, maxChars) {
  const words = String(text || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const lines = []; let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) { lines.push(line); line = word; }
    else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function edgePairs(map) {
  const ids = new Set(map.nodes.map(n => n.id));
  const seen = new Set(); const edges = [];
  for (const n of map.nodes) {
    if (n.parentId && ids.has(n.parentId)) {
      const key = `${n.parentId}>${n.id}`; seen.add(key); edges.push({ from: n.parentId, to: n.id, related: false });
    }
    for (const id of n.relatedTo || []) {
      if (!ids.has(id) || id === n.id) continue;
      const key = [n.id, id].sort().join('~');
      if (!seen.has(key)) { seen.add(key); edges.push({ from: n.id, to: id, related: true }); }
    }
  }
  return edges;
}

export function mapToSVG(map) {
  const b = getMapBounds(map);
  const byId = new Map(map.nodes.map(n => [n.id, n]));
  const bg = map.theme === 'light' ? '#f8fafc' : '#0b1020';
  const text = map.theme === 'light' ? '#0f172a' : '#f8fafc';
  const muted = map.theme === 'light' ? '#475569' : '#cbd5e1';
  const lines = [];
  for (const e of edgePairs(map)) {
    const a = byId.get(e.from), z = byId.get(e.to); if (!a || !z) continue;
    const ad = dims(a), zd = dims(z);
    const x1 = a.x + ad.w / 2, y1 = a.y + ad.h / 2, x2 = z.x + zd.w / 2, y2 = z.y + zd.h / 2;
    lines.push(`<path d="M ${x1} ${y1} C ${(x1+x2)/2} ${y1}, ${(x1+x2)/2} ${y2}, ${x2} ${y2}" fill="none" stroke="${e.related ? '#94a3b8' : '#64748b'}" stroke-width="${e.related ? 2 : 3}" ${e.related ? 'stroke-dasharray="8 7"' : ''}/>`);
  }
  const nodes = map.nodes.map(n => {
    const { w, h } = dims(n); const color = n.color || '#7c3aed';
    const title = wrapText(n.title, 28).slice(0, 2);
    const body = wrapText(n.text, 42).slice(0, 6);
    const titleSvg = title.map((t, i) => `<tspan x="${n.x + 18}" dy="${i ? 21 : 0}">${esc(t)}</tspan>`).join('');
    const baseY = n.y + 67 + Math.max(0, title.length - 1) * 20;
    const bodySvg = body.map((t, i) => `<tspan x="${n.x + 18}" dy="${i ? 18 : 0}">${esc(t)}</tspan>`).join('');
    return `<g><rect x="${n.x}" y="${n.y}" width="${w}" height="${h}" rx="20" fill="${map.theme === 'light' ? '#ffffff' : '#111827'}" stroke="${color}" stroke-width="3"/><rect x="${n.x}" y="${n.y}" width="7" height="${h}" rx="4" fill="${color}"/><text x="${n.x+18}" y="${n.y+31}" font-family="Arial, sans-serif" font-size="17" font-weight="700" fill="${text}">${titleSvg}</text><text x="${n.x+18}" y="${baseY}" font-family="Arial, sans-serif" font-size="13" fill="${muted}">${bodySvg}</text></g>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${b.width}" height="${b.height}" viewBox="${b.minX} ${b.minY} ${b.width} ${b.height}"><rect x="${b.minX}" y="${b.minY}" width="${b.width}" height="${b.height}" fill="${bg}"/>${lines.join('')}${nodes}</svg>`;
}

export function exportSVG(map) {
  downloadBlob(new Blob([mapToSVG(map)], { type: 'image/svg+xml;charset=utf-8' }), `${safeName(map.title)}.svg`);
}

export function exportJSON(map) {
  const payload = { format: 'mapaflex', version: 2, exportedAt: new Date().toISOString(), map };
  downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), `${safeName(map.title)}.mapaflex.json`);
}

export async function exportPDF(map) {
  const JsPDF = globalThis.jspdf?.jsPDF;
  if (!JsPDF) throw new Error('O módulo de PDF ainda não carregou. Verifique a conexão e tente novamente.');
  const b = getMapBounds(map);
  const maxPt = 2000;
  const scale = Math.min(maxPt / b.width, maxPt / b.height, 1.4);
  const pageW = Math.max(220, b.width * scale), pageH = Math.max(220, b.height * scale);
  const orientation = pageW >= pageH ? 'landscape' : 'portrait';
  const doc = new JsPDF({ orientation, unit: 'pt', format: [pageW, pageH], compress: true, putOnlyUsedFonts: true });
  const offX = -b.minX, offY = -b.minY;
  const sx = x => (x + offX) * scale, sy = y => (y + offY) * scale;
  const byId = new Map(map.nodes.map(n => [n.id, n]));
  const dark = map.theme !== 'light';
  doc.setFillColor(dark ? 11 : 248, dark ? 16 : 250, dark ? 32 : 252); doc.rect(0, 0, pageW, pageH, 'F');
  for (const e of edgePairs(map)) {
    const a = byId.get(e.from), z = byId.get(e.to); if (!a || !z) continue;
    const ad = dims(a), zd = dims(z);
    const x1 = sx(a.x + ad.w/2), y1 = sy(a.y + ad.h/2), x2 = sx(z.x + zd.w/2), y2 = sy(z.y + zd.h/2);
    doc.setDrawColor(e.related ? 148 : 100, e.related ? 163 : 116, e.related ? 184 : 139);
    doc.setLineWidth((e.related ? 1.4 : 2) * scale);
    if (e.related && doc.setLineDashPattern) doc.setLineDashPattern([5*scale, 4*scale], 0); else if (doc.setLineDashPattern) doc.setLineDashPattern([], 0);
    doc.line(x1, y1, x2, y2);
  }
  if (doc.setLineDashPattern) doc.setLineDashPattern([], 0);
  for (const n of map.nodes) {
    const { w, h } = dims(n); const x = sx(n.x), y = sy(n.y), W = w*scale, H = h*scale;
    const hex = (n.color || '#7c3aed').replace('#',''); const c = hex.length===6 ? [parseInt(hex.slice(0,2),16),parseInt(hex.slice(2,4),16),parseInt(hex.slice(4,6),16)] : [124,58,237];
    doc.setFillColor(dark ? 17 : 255, dark ? 24 : 255, dark ? 39 : 255); doc.setDrawColor(...c); doc.setLineWidth(Math.max(1, 2.2*scale)); doc.roundedRect(x,y,W,H,12*scale,12*scale,'FD');
    doc.setFillColor(...c); doc.roundedRect(x,y,6*scale,H,3*scale,3*scale,'F');
    doc.setTextColor(dark ? 248 : 15, dark ? 250 : 23, dark ? 252 : 42); doc.setFont('helvetica','bold'); doc.setFontSize(Math.max(5, 13*scale));
    const titleLines = doc.splitTextToSize(String(n.title || ''), Math.max(40, W-28*scale)).slice(0,2); doc.text(titleLines, x+16*scale, y+24*scale);
    const titleH = titleLines.length * 14*scale;
    doc.setTextColor(dark ? 203 : 71, dark ? 213 : 85, dark ? 225 : 105); doc.setFont('helvetica','normal'); doc.setFontSize(Math.max(4.2, 9.2*scale));
    const bodyLines = doc.splitTextToSize(String(n.text || ''), Math.max(40, W-28*scale)).slice(0,7); doc.text(bodyLines, x+16*scale, y+30*scale+titleH);
  }
  doc.setProperties({ title: map.title || 'MapaFlex', subject: 'Mapa conceitual em página única', creator: 'MapaFlex PWA' });
  doc.save(`${safeName(map.title)}.pdf`);
}

export async function exportPNG(map, multiplier = 2) {
  const svg = mapToSVG(map); const b = getMapBounds(map);
  const blob = new Blob([svg], { type: 'image/svg+xml' }); const url = URL.createObjectURL(blob);
  const img = new Image();
  await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = url; });
  const maxSide = 12000; const scale = Math.min(Number(multiplier)||2, maxSide/b.width, maxSide/b.height);
  const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(b.width*scale)); canvas.height = Math.max(1, Math.round(b.height*scale));
  const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, canvas.width, canvas.height); URL.revokeObjectURL(url);
  const out = await new Promise(resolve => canvas.toBlob(resolve, 'image/png', 1));
  downloadBlob(out, `${safeName(map.title)}.png`);
}
