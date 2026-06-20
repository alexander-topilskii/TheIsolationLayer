import type { Locale } from '../i18n/types.ts';
import type {
  SectorState,
  ShipMapDeck,
  ShipMapModule,
  ShipMapRegion,
} from '../engine/types.ts';

interface CellMeta {
  sectorId: string;
}

export class ShipMapView {
  static render(
    shipMap: ShipMapModule,
    sectors: SectorState[],
    selectedSectorId: string | null,
    locale: Locale,
  ): string {
    const decks = shipMap.decks
      .map((deck) => this.renderDeck(deck, sectors, selectedSectorId, locale))
      .join('');
    return `<div class="ship-map-panel mac-inset">${decks}</div>`;
  }

  static bind(container: HTMLElement, onSelect: (sectorId: string) => void): void {
    container.querySelectorAll('.map-cell[data-sector]').forEach((el) => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-sector');
        if (id) onSelect(id);
      });
    });
  }

  private static renderDeck(
    deck: ShipMapDeck,
    sectors: SectorState[],
    selectedSectorId: string | null,
    locale: Locale,
  ): string {
    const meta = buildCellMeta(deck);
    const rows = deck.lines
      .map((line, rowIndex) => {
        const rowHtml = ShipMapView.renderRow(
          line,
          meta[rowIndex] ?? [],
          sectors,
          selectedSectorId,
        );
        return `<div class="ship-map-row">${rowHtml}</div>`;
      })
      .join('');

    const label = deck.label[locale] ?? deck.label.ru;
    return `
      <div class="ship-map-deck">
        <div class="deck-label">${escapeHtml(label)}</div>
        <pre class="ship-map-grid" aria-label="${escapeHtml(label)}">${rows}</pre>
      </div>
    `;
  }

  private static renderRow(
    line: string,
    rowMeta: (CellMeta | null)[],
    sectors: SectorState[],
    selectedSectorId: string | null,
  ): string {
    let html = '';
    let col = 0;

    while (col < line.length) {
      const sectorId = rowMeta[col]?.sectorId;
      if (sectorId) {
        let end = col;
        while (end < line.length && rowMeta[end]?.sectorId === sectorId) {
          end += 1;
        }
        const chunk = line.slice(col, end);
        const sector = sectors.find((s) => s.id === sectorId);
        html += `<span class="${cellClasses(sector, selectedSectorId === sectorId)}" data-sector="${sectorId}">${escapeHtml(chunk)}</span>`;
        col = end;
      } else {
        html += escapeHtml(line[col] ?? '');
        col += 1;
      }
    }

    return html;
  }
}

function buildCellMeta(deck: ShipMapDeck): (CellMeta | null)[][] {
  const rowCount = deck.lines.length;
  const colCount = Math.max(...deck.lines.map((l) => l.length), 0);
  const meta: (CellMeta | null)[][] = Array.from({ length: rowCount }, () =>
    Array<CellMeta | null>(colCount).fill(null),
  );

  for (const region of deck.regions) {
    applyRegion(meta, region);
  }

  return meta;
}

function applyRegion(meta: (CellMeta | null)[][], region: ShipMapRegion): void {
  for (let dr = 0; dr < region.h; dr += 1) {
    for (let dc = 0; dc < region.w; dc += 1) {
      const r = region.r + dr;
      const c = region.c + dc;
      if (meta[r]?.[c] !== undefined) {
        meta[r][c] = { sectorId: region.sectorId };
      }
    }
  }
}

function cellClasses(sector: SectorState | undefined, selected: boolean): string {
  const parts = ['map-cell', 'map-room'];
  if (selected) parts.push('selected');
  if (sector?.quarantine) parts.push('quarantine');
  if (sector?.status === 'damaged') parts.push('status-damaged');
  else if (sector?.status === 'offline') parts.push('status-offline');
  else if (sector) parts.push('status-nominal');
  return parts.join(' ');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
