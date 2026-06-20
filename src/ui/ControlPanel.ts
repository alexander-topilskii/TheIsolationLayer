import type { GameEngine } from '../engine/GameEngine.ts';
import {
  colonistBio,
  incidentTruthNote,
  procedureShortLabel,
  sectionPages,
  sectionTitle,
  sectorDiagnosticNote,
  sectorName,
} from '../i18n/scenario-en.ts';

import { ShipMapView } from './ShipMapView.ts';

export type ControlTab = 'manual' | 'ship' | 'actions' | 'archive';

export interface ControlUiState {
  activeTab: ControlTab;
  selectedSectorId: string | null;
  selectedManualId: string | null;
}

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

  getUiState(): ControlUiState {
    return {
      activeTab: this.activeTab,
      selectedSectorId: this.selectedSectorId,
      selectedManualId: this.selectedManualId,
    };
  }

  applyUiState(state: ControlUiState): void {
    const tab = state.activeTab as string;
    this.activeTab = tab === 'sectors' ? 'ship' : (state.activeTab as ControlTab);
    this.selectedSectorId = state.selectedSectorId;
    this.selectedManualId = state.selectedManualId;
    this.lastFeedback = this.statusHint(this.engine.getCurrentIncident());
  }

  onIncidentPresented(incident: import('../engine/types.ts').Incident | null): void {
    if (incident?.sectorId) {
      this.selectedSectorId = incident.sectorId;
    }
    if (incident?.manualRef) {
      this.selectedManualId = incident.manualRef;
    }
    this.lastFeedback = this.statusHint(incident);
  }

  renderTabs(): void {
    const t = this.engine.i18n.t.bind(this.engine.i18n);
    const labels: Record<ControlTab, string> = {
      manual: t('tabManual'),
      ship: t('tabShip'),
      actions: t('tabActions'),
      archive: t('tabArchive'),
    };
    this.root.querySelectorAll('[data-tab]').forEach((btn) => {
      const tab = btn.getAttribute('data-tab') as ControlTab;
      btn.textContent = labels[tab];
    });
    const ackBtn = this.root.querySelector('.btn-ack') as HTMLButtonElement;
    if (ackBtn) ackBtn.textContent = t('btnAck');
  }

  render(): void {
    this.renderTabs();

    this.root.querySelectorAll('[data-tab]').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === this.activeTab);
    });

    const body = this.root.querySelector('.control-body') as HTMLElement;
    const incident = this.engine.getCurrentIncident();
    const t = this.engine.i18n.t.bind(this.engine.i18n);

    switch (this.activeTab) {
      case 'manual':
        body.innerHTML = this.renderManual();
        this.bindManual(body);
        break;
      case 'ship':
        body.innerHTML = this.renderShip();
        this.bindShip(body);
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
        this.lastFeedback = t('shiftContinues');
        this.onUpdate();
      };
    }
  }

  private statusHint(incident: ReturnType<GameEngine['getCurrentIncident']>): string {
    const t = this.engine.i18n.t.bind(this.engine.i18n);
    if (!incident) return t('waiting');
    if (incident.ackOnly) return t('ackHint');
    if (incident.id === 'shift1-archive') return t('archiveHint');
    if (incident.resolution) {
      const steps: string[] = [];
      const res = incident.resolution;
      if (res.requiresManual) {
        const done = this.engine.state.readManualSections.has(res.requiresManual);
        steps.push(
          `${done ? '✓' : '1.'} ${t('stepManual', { section: res.requiresManual })}`,
        );
      }
      if (res.requiresDiagnostic) {
        const sector = this.engine.state.sectors.find((s) => s.id === res.sectorId);
        steps.push(
          `${sector?.diagnosticDone ? '✓' : '2.'} ${t('stepDiagnostic', { sector: res.sectorId })}`,
        );
      }
      const proc = this.engine.scenario.procedureMap.get(res.procedure);
      const actionLabel = proc
        ? procedureShortLabel(proc, this.engine.i18n.locale)
        : res.procedure;
      steps.push(`3. ${t('stepAction', { action: actionLabel })}`);
      return steps.join(' → ');
    }
    return '';
  }

  private renderManual(): string {
    const { manual } = this.engine.scenario;
    const locale = this.engine.i18n.locale;
    const t = this.engine.i18n.t.bind(this.engine.i18n);

    const sections = manual.sections
      .map((s) => {
        const read = this.engine.state.readManualSections.has(s.id);
        const active = this.selectedManualId === s.id;
        const title = sectionTitle(s, locale);
        return `<button type="button" class="manual-item ${read ? 'read' : ''} ${active ? 'active' : ''}" data-section="${s.id}">
          ${escapeHtml(title)}${read ? ' ✓' : ''}
        </button>`;
      })
      .join('');

    const section = manual.sections.find((s) => s.id === this.selectedManualId);
    const sectionContent = section
      ? sectionPages(section, locale).map((p) => `<p>${escapeHtml(p)}</p>`).join('')
      : `<p class="hint">${t('manualSelectHint')}</p>`;

    return `
      <div class="manual-layout">
        <div class="manual-list">${sections}</div>
        <div class="manual-content mac-inset">${sectionContent}</div>
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

  private renderShip(): string {
    const locale = this.engine.i18n.locale;
    const t = this.engine.i18n.t.bind(this.engine.i18n);
    const qTag = t('quarantineTag');

    const list = this.engine.state.sectors
      .map((s) => {
        const active = this.selectedSectorId === s.id;
        const icon = s.status === 'nominal' ? '●' : s.status === 'damaged' ? '▲' : '○';
        const q = s.quarantine ? qTag : '';
        const def = this.engine.scenario.sectors.find((d) => d.id === s.id)!;
        const name = sectorName(def, locale);
        return `<button type="button" class="sector-row ${active ? 'active' : ''}" data-sector="${s.id}">
          <span>${icon}</span> ${s.label} ${escapeHtml(name)}${q}
        </button>`;
      })
      .join('');

    const sector = this.engine.state.sectors.find((s) => s.id === this.selectedSectorId);
    let detail = `<p class="hint">${t('sectorSelectHint')}</p>`;
    if (sector) {
      const def = this.engine.scenario.sectors.find((d) => d.id === sector.id)!;
      const readings = sector.diagnostic
        .map((r) => `<tr><td>${escapeHtml(r.label)}</td><td>${escapeHtml(r.value)}</td></tr>`)
        .join('');
      const diagDone = sector.diagnosticDone;
      const incident = this.engine.getCurrentIncident();
      const showTruth =
        diagDone && incident?.deception && incident.sectorId === sector.id;

      let noteText = sector.diagnosticNote ?? 'OK';
      if (showTruth && incident) {
        noteText = incidentTruthNote(incident, locale) ?? noteText;
      } else if (diagDone) {
        noteText = sectorDiagnosticNote(def, locale) ?? noteText;
      }

      detail = `
        <h3 class="sector-title">${sector.label} — ${escapeHtml(sectorName(def, locale))}</h3>
        <table class="diag-table">${readings}</table>
        ${diagDone ? `<p class="diag-note">${escapeHtml(noteText)}</p>` : ''}
        <button type="button" class="mac-btn btn-diag" ${diagDone ? 'disabled' : ''}>${t('runDiagnostic')}</button>
      `;
    }

    const shipMap = this.engine.scenario.shipMap;
    const mapHtml = shipMap
      ? ShipMapView.render(
          shipMap,
          this.engine.state.sectors,
          this.selectedSectorId,
          locale,
        )
      : '';

    return `
      <div class="ship-layout">
        <div class="ship-upper sectors-layout">
          <div class="sector-list">${list}</div>
          <div class="sector-detail mac-inset">${detail}</div>
        </div>
        ${mapHtml}
      </div>
    `;
  }

  private bindShip(body: HTMLElement): void {
    const t = this.engine.i18n.t.bind(this.engine.i18n);

    const selectSector = (id: string | null) => {
      if (!id) return;
      this.selectedSectorId = id;
      this.render();
    };

    body.querySelectorAll('.sector-row[data-sector]').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectSector(btn.getAttribute('data-sector'));
      });
    });

    ShipMapView.bind(body, (sectorId) => {
      selectSector(sectorId);
    });

    body.querySelector('.btn-diag')?.addEventListener('click', () => {
      if (!this.selectedSectorId) {
        this.lastFeedback = t('sectorSelectFirst');
        this.pushLocalFeedback();
        return;
      }
      this.lastFeedback = this.engine.runDiagnostic(this.selectedSectorId);
      this.onUpdate();
    });
  }

  private pushLocalFeedback(): void {
    this.render();
  }

  private renderActions(incident: ReturnType<GameEngine['getCurrentIncident']>): string {
    const locale = this.engine.i18n.locale;
    const t = this.engine.i18n.t.bind(this.engine.i18n);
    const unlocked = new Set<string>();
    for (const sectionId of this.engine.state.readManualSections) {
      const sec = this.engine.scenario.manual.sections.find((s) => s.id === sectionId);
      sec?.unlocksProcedures.forEach((p) => unlocked.add(p));
    }

    const procs = this.engine.scenario.procedures
      .filter((p) => unlocked.has(p.id))
      .map(
        (p) =>
          `<button type="button" class="mac-btn proc-btn" data-proc="${p.id}">${escapeHtml(procedureShortLabel(p, locale))} (−${p.energyCost} PWR)</button>`,
      )
      .join('');

    const locked = this.engine.scenario.procedures
      .filter((p) => !unlocked.has(p.id))
      .map(
        (p) =>
          `<span class="proc-locked">${escapeHtml(procedureShortLabel(p, locale))} ${t('procLocked', { section: p.manualSection })}</span>`,
      )
      .join('');

    const target = incident?.resolution?.sectorId ?? this.selectedSectorId ?? '—';
    const proc = incident?.resolution
      ? this.engine.scenario.procedureMap.get(incident.resolution.procedure)
      : null;

    return `
      <div class="actions-layout">
        <p class="hint">${t('targetSector')}: <strong>${target}</strong></p>
        ${proc ? `<p class="hint">${t('requiredProcedure')}: <strong>${escapeHtml(procedureShortLabel(proc, locale))}</strong> (§${proc.manualSection})</p>` : ''}
        <div class="proc-grid">${procs || `<p class="hint">${t('unlockManualHint')}</p>`}</div>
        <div class="proc-locked-list">${locked}</div>
      </div>
    `;
  }

  private bindActions(body: HTMLElement): void {
    body.querySelectorAll('[data-proc]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const procId = btn.getAttribute('data-proc')!;
        const incident = this.engine.getCurrentIncident();
        const sectorId = incident?.resolution?.sectorId ?? this.selectedSectorId ?? undefined;
        const result = this.engine.executeProcedure(procId, sectorId);
        this.lastFeedback = result.feedback;
        this.onUpdate();
      });
    });
  }

  private renderArchive(incident: ReturnType<GameEngine['getCurrentIncident']>): string {
    const t = this.engine.i18n.t.bind(this.engine.i18n);

    if (incident?.id === 'shift1-archive') {
      return `
        <p>${t('archiveDeletePrompt')}</p>
        <div class="archive-actions">
          <button type="button" class="mac-btn btn-archive-delete">${t('archiveDelete')}</button>
          <button type="button" class="mac-btn btn-archive-keep">${t('archiveKeep')}</button>
        </div>
      `;
    }

    if (this.engine.state.flags.has('archive_kept')) {
      const lines = this.engine.getCaptLogLines();
      return `
        <p>${t('captProcess')}</p>
        <button type="button" class="mac-btn btn-capt">${t('captListen')}</button>
        <div class="capt-log mac-inset" hidden>
          ${lines.map((p) => `<p>${escapeHtml(p)}</p>`).join('')}
        </div>
      `;
    }

    if (this.engine.state.flags.has('archive_deleted')) {
      return `<p class="hint">${t('archiveDeleted')}</p>`;
    }

    return `
      <p class="hint">${t('searchHint')}</p>
      <div class="search-row">
        <input type="text" class="mac-input search-input" placeholder="${t('searchPlaceholder')}" />
        <button type="button" class="mac-btn btn-search">${t('searchBtn')}</button>
      </div>
      <div class="search-results mac-inset"></div>
    `;
  }

  private bindArchive(body: HTMLElement): void {
    const t = this.engine.i18n.t.bind(this.engine.i18n);
    body.querySelector('.btn-archive-delete')?.addEventListener('click', () => {
      this.engine.archiveAction('delete');
      this.lastFeedback = t('archiveDeleted');
      this.onUpdate();
    });
    body.querySelector('.btn-archive-keep')?.addEventListener('click', () => {
      this.engine.archiveAction('keep');
      this.lastFeedback = t('archiveBackground');
      this.onUpdate();
    });
    body.querySelector('.btn-capt')?.addEventListener('click', () => {
      const log = body.querySelector('.capt-log') as HTMLElement;
      if (log) log.hidden = false;
      this.engine.state.flags.add('captain_contact');
      this.engine.state.readManualSections.add('F1');
      this.lastFeedback = t('captPlayed');
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
          ? t('searchNotFound')
          : matches
              .map(
                (c) =>
                  `<p><strong>${escapeHtml(c.lastName)} ${escapeHtml(c.firstName)}</strong> — ${escapeHtml(colonistBio(c, this.engine.i18n.locale))}</p>`,
              )
              .join('');
    });
  }
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
