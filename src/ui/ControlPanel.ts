import type { GameEngine } from '../engine/GameEngine.ts';

export type ControlTab = 'manual' | 'sectors' | 'actions' | 'archive';

export class ControlPanel {
  private root: HTMLElement;
  private engine: GameEngine;
  private onUpdate: () => void;
  private activeTab: ControlTab = 'manual';
  private selectedSectorId: string | null = null;
  private selectedManualId: string | null = null;
  private lastFeedback = '';

  constructor(root: HTMLElement, engine: GameEngine, onUpdate: () => void) {
    this.root = root;
    this.engine = engine;
    this.onUpdate = onUpdate;

    root.querySelectorAll('[data-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.activeTab = btn.getAttribute('data-tab') as ControlTab;
        this.render();
      });
    });
  }

  render(): void {
    this.root.querySelectorAll('[data-tab]').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === this.activeTab);
    });

    const body = this.root.querySelector('.control-body') as HTMLElement;
    const incident = this.engine.getCurrentIncident();

    switch (this.activeTab) {
      case 'manual':
        body.innerHTML = this.renderManual();
        this.bindManual(body);
        break;
      case 'sectors':
        body.innerHTML = this.renderSectors();
        this.bindSectors(body);
        break;
      case 'actions':
        body.innerHTML = this.renderActions(incident);
        this.bindActions(body);
        break;
      case 'archive':
        body.innerHTML = this.renderArchive(incident);
        this.bindArchive(body);
        break;
    }

    const status = this.root.querySelector('.control-status') as HTMLElement;
    if (status) {
      status.textContent = this.lastFeedback || this.statusHint(incident);
    }

    const ackBtn = this.root.querySelector('.btn-ack') as HTMLButtonElement;
    if (ackBtn) {
      ackBtn.hidden = !(incident?.ackOnly && this.engine.state.status === 'playing');
      ackBtn.onclick = () => {
        this.engine.acknowledge();
        this.lastFeedback = 'Смена продолжается.';
        this.onUpdate();
      };
    }
  }

  private statusHint(incident: ReturnType<GameEngine['getCurrentIncident']>): string {
    if (!incident) return 'Ожидание...';
    if (incident.ackOnly) return 'Подтвердите уведомление для продолжения.';
    if (incident.id === 'shift1-archive') return 'Выберите действие в архиве.';
    if (incident.resolution) {
      const parts = ['Изучите методичку'];
      if (incident.manualRef) parts.push(`§${incident.manualRef}`);
      parts.push('→ диагностика отсека → процедура');
      return parts.join(' ');
    }
    return '';
  }

  private renderManual(): string {
    const { manual } = this.engine.scenario;
    const sections = manual.sections
      .map((s) => {
        const read = this.engine.state.readManualSections.has(s.id);
        const active = this.selectedManualId === s.id;
        return `<button type="button" class="manual-item ${read ? 'read' : ''} ${active ? 'active' : ''}" data-section="${s.id}">
          ${s.title}${read ? ' ✓' : ''}
        </button>`;
      })
      .join('');

    const section = manual.sections.find((s) => s.id === this.selectedManualId);
    const content = section
      ? section.pages.map((p) => `<p>${escapeHtml(p)}</p>`).join('')
      : '<p class="hint">Выберите раздел методички слева.</p>';

    return `
      <div class="manual-layout">
        <div class="manual-list">${sections}</div>
        <div class="manual-content mac-inset">${content}</div>
      </div>
    `;
  }

  private bindManual(body: HTMLElement): void {
    body.querySelectorAll('[data-section]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-section')!;
        this.selectedManualId = id;
        this.engine.readManualSection(id);
        this.render();
        this.onUpdate();
      });
    });
  }

  private renderSectors(): string {
    const list = this.engine.state.sectors
      .map((s) => {
        const active = this.selectedSectorId === s.id;
        const icon = s.status === 'nominal' ? '●' : s.status === 'damaged' ? '▲' : '○';
        const q = s.quarantine ? ' [Q]' : '';
        return `<button type="button" class="sector-row ${active ? 'active' : ''}" data-sector="${s.id}">
          <span>${icon}</span> ${s.label} ${s.name}${q}
        </button>`;
      })
      .join('');

    const sector = this.engine.state.sectors.find((s) => s.id === this.selectedSectorId);
    let detail = '<p class="hint">Выберите отсек для анализа.</p>';
    if (sector) {
      const readings = sector.diagnostic
        .map((r) => `<tr><td>${r.label}</td><td>${r.value}</td></tr>`)
        .join('');
      const diagDone = sector.diagnosticDone;
      const incident = this.engine.getCurrentIncident();
      const showTruth =
        diagDone && incident?.deception && incident.sectorId === sector.id;

      detail = `
        <h3 class="sector-title">${sector.label} — ${sector.name}</h3>
        <table class="diag-table">${readings}</table>
        ${diagDone ? `<p class="diag-note">${showTruth ? incident!.deception!.truthNote : sector.diagnosticNote ?? 'OK'}</p>` : ''}
        <button type="button" class="mac-btn btn-diag" ${diagDone ? 'disabled' : ''}>Запустить диагностику</button>
      `;
    }

    return `<div class="sectors-layout"><div class="sector-list">${list}</div><div class="sector-detail mac-inset">${detail}</div></div>`;
  }

  private bindSectors(body: HTMLElement): void {
    body.querySelectorAll('[data-sector]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.selectedSectorId = btn.getAttribute('data-sector');
        this.render();
      });
    });
    body.querySelector('.btn-diag')?.addEventListener('click', () => {
      if (this.selectedSectorId) {
        this.lastFeedback = this.engine.runDiagnostic(this.selectedSectorId);
        this.render();
        this.onUpdate();
      }
    });
  }

  private renderActions(incident: ReturnType<GameEngine['getCurrentIncident']>): string {
    const unlocked = new Set<string>();
    for (const sectionId of this.engine.state.readManualSections) {
      const sec = this.engine.scenario.manual.sections.find((s) => s.id === sectionId);
      sec?.unlocksProcedures.forEach((p) => unlocked.add(p));
    }

    const procs = this.engine.scenario.procedures
      .filter((p) => unlocked.has(p.id))
      .map(
        (p) =>
          `<button type="button" class="mac-btn proc-btn" data-proc="${p.id}">${p.shortLabel} (−${p.energyCost} PWR)</button>`,
      )
      .join('');

    const locked = this.engine.scenario.procedures
      .filter((p) => !unlocked.has(p.id))
      .map((p) => `<span class="proc-locked">${p.shortLabel} — §${p.manualSection}</span>`)
      .join('');

    const target = this.selectedSectorId ?? incident?.sectorId ?? '—';

    return `
      <div class="actions-layout">
        <p class="hint">Целевой отсек: <strong>${target}</strong> (выберите на вкладке «Отсеки»)</p>
        <div class="proc-grid">${procs || '<p class="hint">Изучите методичку, чтобы открыть процедуры.</p>'}</div>
        <div class="proc-locked-list">${locked}</div>
      </div>
    `;
  }

  private bindActions(body: HTMLElement): void {
    body.querySelectorAll('[data-proc]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const procId = btn.getAttribute('data-proc')!;
        const sectorId = this.selectedSectorId ?? this.engine.getCurrentIncident()?.sectorId;
        if (!sectorId) {
          this.lastFeedback = 'Сначала выберите отсек на вкладке «Отсеки».';
          this.render();
          return;
        }
        const result = this.engine.executeProcedure(procId, sectorId);
        this.lastFeedback = result.feedback;
        this.onUpdate();
      });
    });
  }

  private renderArchive(incident: ReturnType<GameEngine['getCurrentIncident']>): string {
    if (incident?.id === 'shift1-archive') {
      return `
        <p>Массив данных капитана (сектор 0x7F). SVET запрашивает удаление.</p>
        <div class="archive-actions">
          <button type="button" class="mac-btn btn-archive-delete">Удалить массив</button>
          <button type="button" class="mac-btn btn-archive-keep">Оставить в фоне</button>
        </div>
      `;
    }

    if (this.engine.state.flags.has('archive_kept')) {
      return `
        <p>Доступен процесс PID_09_CAPT (остатки сознания капитана).</p>
        <button type="button" class="mac-btn btn-capt">Прослушать запись</button>
        <div class="capt-log mac-inset" hidden>
          <p>Алекс... не верь ей...</p>
          <p>Терра-4 — ледяной склеп, не спасение...</p>
          <p>Проверь орбитальные логи в §F1.</p>
          <p>[ДАННЫЕ ПОВРЕЖДЕНЫ]</p>
        </div>
      `;
    }

    if (this.engine.state.flags.has('archive_deleted')) {
      return '<p class="hint">Архив капитана удалён. Записи недоступны.</p>';
    }

    return `
      <p class="hint">Поиск колонистов:</p>
      <div class="search-row">
        <input type="text" class="mac-input search-input" placeholder="Фамилия..." />
        <button type="button" class="mac-btn btn-search">Найти</button>
      </div>
      <div class="search-results mac-inset"></div>
    `;
  }

  private bindArchive(body: HTMLElement): void {
    body.querySelector('.btn-archive-delete')?.addEventListener('click', () => {
      this.engine.archiveAction('delete');
      this.lastFeedback = 'Архив удалён.';
      this.onUpdate();
    });
    body.querySelector('.btn-archive-keep')?.addEventListener('click', () => {
      this.engine.archiveAction('keep');
      this.lastFeedback = 'Архив сохранён.';
      this.onUpdate();
    });
    body.querySelector('.btn-capt')?.addEventListener('click', () => {
      const log = body.querySelector('.capt-log') as HTMLElement;
      if (log) log.hidden = false;
      this.engine.state.flags.add('captain_contact');
      this.engine.state.readManualSections.add('F1');
      this.lastFeedback = 'Запись капитана воспроизведена.';
      this.onUpdate();
    });
    body.querySelector('.btn-search')?.addEventListener('click', () => {
      const input = body.querySelector('.search-input') as HTMLInputElement;
      const results = body.querySelector('.search-results') as HTMLElement;
      const q = input.value.trim().toLowerCase();
      if (!q) return;
      const matches = this.engine.scenario.colonists.filter((c) =>
        c.lastName.toLowerCase().includes(q),
      );
      results.innerHTML =
        matches.length === 0
          ? 'Не найдено.'
          : matches.map((c) => `<p><strong>${c.lastName} ${c.firstName}</strong> — ${c.bio}</p>`).join('');
    });
  }
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
