/** Shared sheet-inspired styling for the import dialogs. */
export function styleImport(dialog){
  dialog.className='crows crows-import-ui';
  dialog.setAttribute('aria-label','Crows PDF Importer');
  if(document.getElementById('crows-import-style'))return;
  const style=document.createElement('style');style.id='crows-import-style';
  style.textContent=`
/* Reuse fonts supplied by the Crows system; no separate network font request. */

.crows-import-ui {
  box-sizing: border-box;
  width: min(1120px, 94vw);
  height: 90vh;
  max-height: 94vh;
  margin: auto;
  padding: 28px;
  border: 1px solid rgba(96, 165, 250, 0.25);
  border-radius: 14px;
  background: radial-gradient(130% 120% at 85% 0%, #172033 0%, #0d121c 55%, #070a10 100%);
  color: #cbd5e1;
  font: 14px/1.6 'Inter', system-ui, sans-serif;
  box-shadow: 0 25px 90px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.1);
  overflow-y: auto;
  overflow-x: hidden;
  color-scheme: dark;
}

.crows-import-ui::backdrop {
  background: rgba(4, 7, 13, 0.82);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

.crows-import-ui * {
  box-sizing: border-box;
}

/* Scrollbars */
.crows-import-ui::-webkit-scrollbar,
.crows-import-ui *::-webkit-scrollbar {
  width: 7px;
  height: 7px;
}
.crows-import-ui::-webkit-scrollbar-track,
.crows-import-ui *::-webkit-scrollbar-track {
  background: rgba(10, 15, 26, 0.6);
  border-radius: 4px;
}
.crows-import-ui::-webkit-scrollbar-thumb,
.crows-import-ui *::-webkit-scrollbar-thumb {
  background: #334155;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}
.crows-import-ui::-webkit-scrollbar-thumb:hover,
.crows-import-ui *::-webkit-scrollbar-thumb:hover {
  background: #475569;
}

/* Typography */
.crows-import-ui h1,
.crows-import-ui h2,
.crows-import-ui h3,
.crows-import-ui legend {
  font-family: 'Cinzel', Georgia, serif;
  letter-spacing: 0.04em;
  color: #f8fafc;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.7);
}

.crows-import-ui h1 {
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 8px;
  border: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.crows-import-ui h2 {
  font-size: 17px;
  font-weight: 700;
  margin: 0 0 12px;
  border: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #e2e8f0;
}

.crows-import-ui .step-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(59, 130, 246, 0.2);
  border: 1px solid rgba(96, 165, 250, 0.4);
  color: #93c5fd;
  font-size: 12px;
  font-family: 'Inter', sans-serif;
  font-weight: 700;
  margin-right: 6px;
}

.crows-import-ui .eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #60a5fa;
  text-transform: uppercase;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.16em;
  margin: 0 0 8px;
  padding: 3px 10px;
  background: rgba(37, 99, 235, 0.15);
  border: 1px solid rgba(96, 165, 250, 0.25);
  border-radius: 9999px;
  width: fit-content;
}

.crows-import-ui p {
  margin: 8px 0 14px;
  color: #94a3b8;
  line-height: 1.6;
}

.crows-import-ui header {
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 20px;
  margin-bottom: 22px;
  position: relative;
}

.crows-import-ui header p.subtitle {
  font-size: 14.5px;
  color: #94a3b8;
  max-width: 800px;
  margin-bottom: 0;
}

/* Sections, Cards, and Details */
.crows-import-ui section,
.crows-import-ui fieldset,
.crows-import-ui details {
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 20px;
  margin: 18px 0;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  transition: border-color 0.2s;
}

.crows-import-ui section:hover,
.crows-import-ui fieldset:hover {
  border-color: rgba(255, 255, 255, 0.14);
}

.crows-import-ui summary {
  cursor: pointer;
  color: #e2e8f0;
  font-weight: 600;
  font-size: 14px;
  padding: 4px 0;
  user-select: none;
  transition: color 0.15s;
}

.crows-import-ui summary:hover {
  color: #60a5fa;
}

/* Dropzones / Pickers */
.crows-import-ui .pickers {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin: 14px 0;
}

.crows-import-ui .picker {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 20px;
  border: 2px dashed rgba(96, 165, 250, 0.35);
  border-radius: 10px;
  background: rgba(20, 30, 48, 0.45);
  font-weight: 600;
  cursor: pointer;
  text-align: center;
  transition: all 0.2s ease;
  position: relative;
}

.crows-import-ui .picker:hover,
.crows-import-ui .picker.dragover {
  border-color: #60a5fa;
  background: rgba(30, 58, 100, 0.35);
  box-shadow: 0 0 24px rgba(96, 165, 250, 0.15);
  transform: translateY(-2px);
}

.crows-import-ui .picker-icon {
  font-size: 30px;
  margin-bottom: 8px;
  color: #60a5fa;
  display: inline-block;
  line-height: 1;
}

.crows-import-ui .picker-title {
  color: #f1f5f9;
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 4px;
}

.crows-import-ui .picker small {
  color: #94a3b8;
  font-size: 12px;
  font-weight: 400;
  display: block;
}

.crows-import-ui input[type=file] {
  display: block;
  margin-top: 10px;
  width: 100%;
  font-size: 12px;
  color: #cbd5e1;
}

.crows-import-ui input[type=file]::file-selector-button {
  background: #1e293b;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 5px;
  color: #e2e8f0;
  padding: 4px 10px;
  font: 500 12px 'Inter', sans-serif;
  cursor: pointer;
  margin-right: 10px;
  transition: all 0.15s;
}

.crows-import-ui input[type=file]::file-selector-button:hover {
  background: #334155;
  border-color: #60a5fa;
  color: #ffffff;
}

/* Form Inputs & Selects */
.crows-import-ui input:not([type=checkbox]):not([type=file]),
.crows-import-ui select {
  max-width: 100%;
  min-height: 38px;
  background: rgba(15, 23, 42, 0.85);
  color: #f9fafb;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 6px;
  padding: 6px 12px;
  font: inherit;
  transition: all 0.15s ease-in-out;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.4);
}

.crows-import-ui input:not([type=checkbox]):not([type=file]):focus,
.crows-import-ui select:focus {
  border-color: #60a5fa;
  background: rgba(15, 23, 42, 0.98);
  box-shadow: 0 0 10px rgba(96, 165, 250, 0.4), inset 0 1px 3px rgba(0, 0, 0, 0.4);
  outline: none;
}

.crows-import-ui input[type=checkbox] {
  accent-color: #3b82f6;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  cursor: pointer;
}

.crows-import-ui select option {
  background-color: #1e293b;
  color: #f9fafb;
  padding: 6px;
}

/* Buttons */
.crows-import-ui button {
  width: auto;
  height: auto;
  min-height: 38px;
  padding: 8px 16px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  background: #1e293b;
  color: #e2e8f0;
  font: 600 13px 'Inter', system-ui;
  cursor: pointer;
  margin: 3px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.15s ease;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.crows-import-ui button:hover:not(:disabled) {
  background: #334155;
  border-color: rgba(255, 255, 255, 0.25);
  color: #ffffff;
  transform: translateY(-1px);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.4);
}

.crows-import-ui button:active:not(:disabled) {
  transform: translateY(0);
}

.crows-import-ui button.primary {
  background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%);
  border-color: #60a5fa;
  color: #ffffff;
  box-shadow: 0 2px 10px rgba(37, 99, 235, 0.35);
}

.crows-import-ui button.primary:hover:not(:disabled) {
  background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%);
  border-color: #93c5fd;
  box-shadow: 0 4px 16px rgba(59, 130, 246, 0.5);
}

.crows-import-ui button.btn-finish {
  background: linear-gradient(135deg, #059669 0%, #10b981 100%);
  border-color: #34d399;
  color: #ffffff;
  box-shadow: 0 2px 10px rgba(16, 185, 129, 0.35);
  font-weight: 700;
}

.crows-import-ui button.btn-finish:hover:not(:disabled) {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  border-color: #6ee7b7;
  box-shadow: 0 4px 16px rgba(16, 185, 129, 0.55);
}

.crows-import-ui button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none !important;
  box-shadow: none !important;
}

.crows-import-ui :focus-visible {
  outline: 2px solid #60a5fa;
  outline-offset: 2px;
}

/* Sticky Action Footer */
.crows-import-ui .actions {
  position: sticky;
  bottom: -28px;
  background: rgba(12, 17, 26, 0.95);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-top: 1px solid rgba(255, 255, 255, 0.12);
  padding: 16px 28px;
  margin: 24px -28px -28px;
  z-index: 10;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  box-shadow: 0 -10px 25px rgba(0, 0, 0, 0.45);
}

/* Status Notifications */
.crows-import-ui [role=status]:not(:empty) {
  border-left: 4px solid #3b82f6;
  background: rgba(15, 23, 42, 0.85);
  border-top: 1px solid rgba(96, 165, 250, 0.2);
  border-right: 1px solid rgba(96, 165, 250, 0.2);
  border-bottom: 1px solid rgba(96, 165, 250, 0.2);
  border-radius: 6px;
  padding: 12px 18px;
  color: #e0f2fe;
  font-size: 13.5px;
  line-height: 1.5;
  margin: 12px 0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.crows-import-ui .status-success {
  border-left-color: #10b981 !important;
  color: #d1fae5 !important;
}

.crows-import-ui .status-warn {
  border-left-color: #f59e0b !important;
  color: #fef3c7 !important;
}

/* Progress Bar */
.crows-import-ui progress {
  width: 100%;
  height: 8px;
  border: none;
  border-radius: 9999px;
  background: rgba(30, 41, 59, 0.8);
  overflow: hidden;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.6);
  margin: 10px 0;
}
.crows-import-ui progress::-webkit-progress-bar {
  background: rgba(30, 41, 59, 0.8);
}
.crows-import-ui progress::-webkit-progress-value {
  background: linear-gradient(90deg, #2563eb, #60a5fa, #38bdf8);
  border-radius: 9999px;
  box-shadow: 0 0 12px rgba(96, 165, 250, 0.6);
}
.crows-import-ui progress::-moz-progress-bar {
  background: linear-gradient(90deg, #2563eb, #60a5fa, #38bdf8);
  border-radius: 9999px;
}

/* Tables */
.crows-import-ui table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  margin: 12px 0;
  background: rgba(11, 17, 29, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  overflow: hidden;
}

.crows-import-ui thead {
  background: rgba(30, 41, 59, 0.9);
  font-family: 'Cinzel', Georgia, serif;
  letter-spacing: 0.04em;
  font-size: 12px;
  color: #e2e8f0;
}

.crows-import-ui td,
.crows-import-ui th {
  padding: 10px 14px;
  text-align: left;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
}

.crows-import-ui tbody tr:nth-child(even) {
  background: rgba(15, 23, 42, 0.45);
}

.crows-import-ui tbody tr:hover {
  background: rgba(59, 130, 246, 0.08);
}

/* Badges */
.crows-import-ui .badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.crows-import-ui .badge-create {
  background: rgba(16, 185, 129, 0.18);
  color: #6ee7b7;
  border: 1px solid rgba(16, 185, 129, 0.35);
}

.crows-import-ui .badge-update {
  background: rgba(59, 130, 246, 0.18);
  color: #93c5fd;
  border: 1px solid rgba(59, 130, 246, 0.35);
}

.crows-import-ui .badge-unchanged {
  background: rgba(100, 116, 139, 0.18);
  color: #cbd5e1;
  border: 1px solid rgba(100, 116, 139, 0.3);
}

.crows-import-ui .badge-preserve {
  background: rgba(245, 158, 11, 0.18);
  color: #fcd34d;
  border: 1px solid rgba(245, 158, 11, 0.35);
}

/* KPI Stats Dashboard */
.crows-import-ui .kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
  margin: 16px 0;
}

.crows-import-ui .kpi-card {
  background: rgba(17, 24, 39, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 12px 16px;
  text-align: center;
  transition: transform 0.15s, border-color 0.15s;
}

.crows-import-ui .kpi-card:hover {
  transform: translateY(-2px);
  border-color: rgba(96, 165, 250, 0.3);
}

.crows-import-ui .kpi-value {
  font-family: 'Cinzel', serif;
  font-size: 24px;
  font-weight: 700;
  color: #f8fafc;
  line-height: 1.2;
}

.crows-import-ui .kpi-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #94a3b8;
  margin-top: 4px;
}

/* Entry Browser & Filter Toolbar */
.crows-import-ui .filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  margin: 14px 0;
  padding: 10px 14px;
  background: rgba(15, 23, 42, 0.75);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
}

.crows-import-ui .filter-bar input[type=search] {
  flex: 1 1 200px;
}

.crows-import-ui .filter-bar select {
  flex: 0 1 220px;
}

.crows-import-ui .entry-list {
  max-height: 340px;
  overflow-y: auto;
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 8px;
  margin-top: 12px;
  background: rgba(10, 15, 26, 0.65);
}

.crows-import-ui .entry {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 10px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  cursor: pointer;
  transition: background 0.15s;
}

.crows-import-ui .entry:hover {
  background: rgba(30, 41, 59, 0.7);
}

.crows-import-ui .entry span {
  font-weight: 500;
  color: #f1f5f9;
}

.crows-import-ui .entry small {
  margin-left: auto;
  color: #93c5fd;
  font-size: 11px;
  background: rgba(59, 130, 246, 0.12);
  border: 1px solid rgba(96, 165, 250, 0.2);
  padding: 2px 8px;
  border-radius: 9999px;
  letter-spacing: 0.03em;
}

.crows-import-ui .entry[hidden] {
  display: none;
}

/* File Assignments */
.crows-import-ui .assignment {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px;
  margin: 8px 0;
  background: rgba(15, 23, 42, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  overflow-wrap: anywhere;
  transition: border-color 0.15s;
}

.crows-import-ui .assignment:hover {
  border-color: rgba(96, 165, 250, 0.3);
}

.crows-import-ui .assignment label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
  color: #f1f5f9;
  font-weight: 500;
}

.crows-import-ui .assignment small {
  color: #94a3b8;
  font-size: 12px;
}

/* Pre & Code */
.crows-import-ui pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-family: 'Consolas', 'Menlo', monospace;
  font-size: 12px;
  max-height: 350px;
  overflow: auto;
  background: rgba(10, 14, 23, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  padding: 14px;
}

/* Responsive */
@media(max-width: 650px) {
  .crows-import-ui {
    padding: 16px;
  }
  .crows-import-ui .pickers {
    grid-template-columns: 1fr;
  }
  .crows-import-ui .assignment label {
    display: block;
  }
  .crows-import-ui .entry small {
    display: none;
  }
  .crows-import-ui .actions {
    bottom: -16px;
    margin: 20px -16px -16px;
    padding: 12px 16px;
  }
}
`;
  document.head.append(style);
}
