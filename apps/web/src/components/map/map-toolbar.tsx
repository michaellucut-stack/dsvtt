'use client';

import { useCallback, useState } from 'react';
import { useMapStore, type MapTool } from '@/stores/map-store';

interface MapToolbarProps {
  isDirector: boolean;
}

// ─── Icons (inline SVGs for zero-dependency icons) ──────────────────────────

function PointerIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
      <path d="M13 13l6 6" />
    </svg>
  );
}

function HandIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
      <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
      <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
      <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
    </svg>
  );
}

function CloudIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
    </svg>
  );
}

function RulerIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z" />
      <path d="m14.5 12.5 2-2" />
      <path d="m11.5 9.5 2-2" />
      <path d="m8.5 6.5 2-2" />
      <path d="m17.5 15.5 2-2" />
    </svg>
  );
}

function PaintBrushIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18.37 2.63 14 7l-1.59-1.59a2 2 0 0 0-2.82 0L8 7l9 9 1.59-1.59a2 2 0 0 0 0-2.82L17 10l4.37-4.37a2.12 2.12 0 1 0-3-3Z" />
      <path d="M9 8c-2 3-4 3.5-7 4l8 10c2-1 6-5 6-7" />
      <path d="M14.5 17.5 4.5 15" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12h8" />
      <path d="M12 8v8" />
    </svg>
  );
}

function GridIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M3 9h18" />
      <path d="M3 15h18" />
      <path d="M9 3v18" />
      <path d="M15 3v18" />
    </svg>
  );
}

function ZoomInIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
      <path d="M11 8v6" />
      <path d="M8 11h6" />
    </svg>
  );
}

function ZoomOutIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
      <path d="M8 11h6" />
    </svg>
  );
}

function FitIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}

// ─── Tool Button ────────────────────────────────────────────────────────────

interface ToolButtonProps {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}

function ToolButton({ active, disabled, onClick, title, children }: ToolButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={[
        'flex h-9 w-9 items-center justify-center rounded-card transition-all duration-150',
        disabled
          ? 'bg-charcoal-800/40 text-charcoal-500 cursor-not-allowed'
          : active
            ? 'bg-gold-600 text-charcoal-950 shadow-glow'
            : 'bg-charcoal-800/80 text-parchment-300 hover:bg-charcoal-700 hover:text-parchment-100',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

// ─── Add Token Form ─────────────────────────────────────────────────────────

interface AddTokenFormProps {
  onClose: () => void;
}

function AddTokenForm({ onClose }: AddTokenFormProps) {
  const [name, setName] = useState('');
  const addToken = useMapStore((s) => s.addToken);
  const currentMap = useMapStore((s) => s.currentMap);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!name.trim() || !currentMap) return;

      addToken({
        mapId: currentMap.id,
        name: name.trim(),
        imageUrl: null,
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        layer: 'token',
        visible: true,
      });

      setName('');
      onClose();
    },
    [name, addToken, currentMap, onClose],
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="absolute left-0 top-full mt-2 z-50 w-56 rounded-panel border border-charcoal-700/60 bg-charcoal-900/95 p-3 shadow-panel backdrop-blur-sm"
    >
      <label className="block text-xs font-medium text-parchment-300 mb-1.5">Token Name</label>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Goblin Scout"
        autoFocus
        className="mb-2 block w-full rounded-card border border-charcoal-600 bg-charcoal-800/80 px-2.5 py-1.5 text-sm text-parchment-100 placeholder:text-charcoal-400 focus:border-gold-600 focus:outline-none focus:ring-1 focus:ring-gold-500/40"
      />
      <div className="flex gap-1.5">
        <button
          type="submit"
          disabled={!name.trim()}
          className="flex-1 rounded-card bg-gold-600 px-2.5 py-1 text-xs font-semibold text-charcoal-950 transition-colors hover:bg-gold-500 disabled:opacity-50"
        >
          Place
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-card bg-charcoal-700 px-2.5 py-1 text-xs font-semibold text-parchment-300 transition-colors hover:bg-charcoal-600"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ─── Fog Paint Form ─────────────────────────────────────────────────────────

interface FogPaintFormProps {
  onClose: () => void;
}

function FogPaintForm({ onClose }: FogPaintFormProps) {
  const [groupName, setGroupName] = useState('');
  const paintedFogCells = useMapStore((s) => s.paintedFogCells);
  const commitFogGroup = useMapStore((s) => s.commitFogGroup);
  const clearPaintedFogCells = useMapStore((s) => s.clearPaintedFogCells);
  const setTool = useMapStore((s) => s.setTool);

  const handleCommit = useCallback(() => {
    commitFogGroup(groupName || undefined);
    setGroupName('');
  }, [groupName, commitFogGroup]);

  const handleCancel = useCallback(() => {
    clearPaintedFogCells();
    setTool('select');
    onClose();
  }, [clearPaintedFogCells, setTool, onClose]);

  return (
    <div className="absolute left-0 top-full mt-2 z-50 w-56 rounded-panel border border-charcoal-700/60 bg-charcoal-900/95 p-3 shadow-panel backdrop-blur-sm">
      <p className="mb-2 text-xs font-semibold text-parchment-200">Paint Fog</p>
      <p className="mb-2 text-[10px] text-parchment-400">
        {paintedFogCells.length} cell{paintedFogCells.length !== 1 ? 's' : ''} selected
      </p>
      <input
        type="text"
        value={groupName}
        onChange={(e) => setGroupName(e.target.value)}
        placeholder="Group name (optional)"
        className="mb-2 block w-full rounded-card border border-charcoal-600 bg-charcoal-800/80 px-2.5 py-1.5 text-sm text-parchment-100 placeholder:text-charcoal-400 focus:border-gold-600 focus:outline-none focus:ring-1 focus:ring-gold-500/40"
      />
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={handleCommit}
          disabled={paintedFogCells.length === 0}
          className="flex-1 rounded-card bg-gold-600 px-2.5 py-1 text-xs font-semibold text-charcoal-950 transition-colors hover:bg-gold-500 disabled:opacity-50"
        >
          Commit Group
        </button>
        <button
          type="button"
          onClick={handleCancel}
          className="flex-1 rounded-card bg-charcoal-700 px-2.5 py-1 text-xs font-semibold text-parchment-300 transition-colors hover:bg-charcoal-600"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Grid Settings Form ─────────────────────────────────────────────────────

interface GridSettingsFormProps {
  initialWidth: number;
  initialHeight: number;
  gridVisible: boolean;
  onApply: (width: number, height: number) => void;
  onHideGrid: () => void;
  onClose: () => void;
}

function GridSettingsForm({
  initialWidth,
  initialHeight,
  gridVisible,
  onApply,
  onHideGrid,
  onClose,
}: GridSettingsFormProps) {
  const [cols, setCols] = useState(String(initialWidth));
  const [rows, setRows] = useState(String(initialHeight));

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const w = parseInt(cols, 10);
      const h = parseInt(rows, 10);
      if (w > 0 && h > 0 && w <= 200 && h <= 200) {
        onApply(w, h);
      }
    },
    [cols, rows, onApply],
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="absolute left-0 top-full mt-2 z-50 w-56 rounded-panel border border-charcoal-700/60 bg-charcoal-900/95 p-3 shadow-panel backdrop-blur-sm"
    >
      <p className="mb-2 text-xs font-semibold text-parchment-200">Grid Dimensions</p>
      <div className="mb-2 flex gap-2">
        <div className="flex-1">
          <label className="block text-[10px] font-medium text-parchment-400 mb-0.5">Columns</label>
          <input
            type="number"
            min={1}
            max={200}
            value={cols}
            onChange={(e) => setCols(e.target.value)}
            autoFocus
            className="block w-full rounded-card border border-charcoal-600 bg-charcoal-800/80 px-2 py-1 text-sm text-parchment-100 focus:border-gold-600 focus:outline-none focus:ring-1 focus:ring-gold-500/40"
          />
        </div>
        <div className="flex-1">
          <label className="block text-[10px] font-medium text-parchment-400 mb-0.5">Rows</label>
          <input
            type="number"
            min={1}
            max={200}
            value={rows}
            onChange={(e) => setRows(e.target.value)}
            className="block w-full rounded-card border border-charcoal-600 bg-charcoal-800/80 px-2 py-1 text-sm text-parchment-100 focus:border-gold-600 focus:outline-none focus:ring-1 focus:ring-gold-500/40"
          />
        </div>
      </div>
      <div className="flex gap-1.5">
        <button
          type="submit"
          className="flex-1 rounded-card bg-gold-600 px-2.5 py-1 text-xs font-semibold text-charcoal-950 transition-colors hover:bg-gold-500"
        >
          {gridVisible ? 'Update' : 'Show Grid'}
        </button>
        {gridVisible && (
          <button
            type="button"
            onClick={onHideGrid}
            className="flex-1 rounded-card bg-red-800/80 px-2.5 py-1 text-xs font-semibold text-parchment-300 transition-colors hover:bg-red-700/80"
          >
            Hide
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="rounded-card bg-charcoal-700 px-2.5 py-1 text-xs font-semibold text-parchment-300 transition-colors hover:bg-charcoal-600"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ─── Map Toolbar ────────────────────────────────────────────────────────────

export function MapToolbar({ isDirector }: MapToolbarProps) {
  const tool = useMapStore((s) => s.tool);
  const viewport = useMapStore((s) => s.viewport);
  const gridVisible = useMapStore((s) => s.gridVisible);
  const currentMap = useMapStore((s) => s.currentMap);
  const setTool = useMapStore((s) => s.setTool);
  const setViewport = useMapStore((s) => s.setViewport);
  const toggleGrid = useMapStore((s) => s.toggleGrid);
  const updateGridDimensions = useMapStore((s) => s.updateGridDimensions);

  const fetchMapState = useMapStore((s) => s.fetchMapState);

  const [showAddToken, setShowAddToken] = useState(false);
  const [showGridSettings, setShowGridSettings] = useState(false);
  const [showFogPaint, setShowFogPaint] = useState(false);

  const handleSetTool = useCallback((t: MapTool) => () => setTool(t), [setTool]);

  const handleZoomIn = useCallback(() => {
    const newScale = Math.min(5, viewport.scale * 1.25);
    setViewport({ scale: newScale });
  }, [viewport.scale, setViewport]);

  const handleZoomOut = useCallback(() => {
    const newScale = Math.max(0.1, viewport.scale / 1.25);
    setViewport({ scale: newScale });
  }, [viewport.scale, setViewport]);

  const handleFitToScreen = useCallback(() => {
    setViewport({ x: 0, y: 0, scale: 1 });
  }, [setViewport]);

  const handleRefreshMap = useCallback(() => {
    if (currentMap) {
      fetchMapState(currentMap.id);
    }
  }, [currentMap, fetchMapState]);

  const zoomPercent = Math.round(viewport.scale * 100);

  return (
    <div className="absolute left-3 top-3 z-20 flex flex-col gap-1.5">
      {/* Tool selection group */}
      <div className="relative z-10 flex items-center gap-1 rounded-panel border border-charcoal-700/60 bg-charcoal-900/90 p-1 shadow-panel backdrop-blur-sm">
        <ToolButton active={tool === 'select'} onClick={handleSetTool('select')} title="Select (V)">
          <PointerIcon />
        </ToolButton>

        <ToolButton active={tool === 'move'} onClick={handleSetTool('move')} title="Pan (Space)">
          <HandIcon />
        </ToolButton>

        {isDirector && (
          <ToolButton active={tool === 'fog'} onClick={handleSetTool('fog')} title="Fog of War (F)">
            <CloudIcon />
          </ToolButton>
        )}

        {isDirector && (
          <div className="relative">
            <ToolButton
              active={tool === 'fog-paint'}
              onClick={() => {
                if (tool === 'fog-paint') {
                  setShowFogPaint((prev) => !prev);
                } else {
                  setTool('fog-paint');
                  setShowFogPaint(true);
                }
              }}
              title="Paint Fog (P)"
            >
              <PaintBrushIcon />
            </ToolButton>
            {showFogPaint && tool === 'fog-paint' && (
              <FogPaintForm onClose={() => setShowFogPaint(false)} />
            )}
          </div>
        )}

        {isDirector ? (
          <div className="relative">
            <ToolButton
              active={gridVisible}
              onClick={() => setShowGridSettings((prev) => !prev)}
              title="Grid Settings (G)"
            >
              <GridIcon />
            </ToolButton>
            {showGridSettings && (
              <GridSettingsForm
                initialWidth={currentMap?.gridWidth ?? 20}
                initialHeight={currentMap?.gridHeight ?? 15}
                gridVisible={gridVisible}
                onApply={(w, h) => {
                  updateGridDimensions(w, h);
                  if (!gridVisible) toggleGrid();
                  setShowGridSettings(false);
                }}
                onHideGrid={() => {
                  if (gridVisible) toggleGrid();
                  setShowGridSettings(false);
                }}
                onClose={() => setShowGridSettings(false)}
              />
            )}
          </div>
        ) : (
          <ToolButton active={gridVisible} onClick={toggleGrid} title="Toggle Grid (G)">
            <GridIcon />
          </ToolButton>
        )}

        {isDirector && (
          <div className="relative">
            <ToolButton onClick={() => setShowAddToken((prev) => !prev)} title="Add Token (T)">
              <PlusIcon />
            </ToolButton>
            {showAddToken && <AddTokenForm onClose={() => setShowAddToken(false)} />}
          </div>
        )}
      </div>

      {/* Zoom controls */}
      <div className="flex items-center gap-1 rounded-panel border border-charcoal-700/60 bg-charcoal-900/90 p-1 shadow-panel backdrop-blur-sm">
        <ToolButton onClick={handleZoomOut} title="Zoom Out (-)">
          <ZoomOutIcon />
        </ToolButton>

        <span className="min-w-[3rem] text-center text-xs font-medium text-parchment-300">
          {zoomPercent}%
        </span>

        <ToolButton onClick={handleZoomIn} title="Zoom In (+)">
          <ZoomInIcon />
        </ToolButton>

        <div className="mx-0.5 h-6 w-px bg-charcoal-600" />

        <ToolButton onClick={handleFitToScreen} title="Fit to Screen">
          <FitIcon />
        </ToolButton>

        <div className="mx-0.5 h-6 w-px bg-charcoal-600" />

        <ToolButton onClick={handleRefreshMap} disabled={!currentMap} title="Refresh Map">
          <RefreshIcon />
        </ToolButton>
      </div>
    </div>
  );
}
