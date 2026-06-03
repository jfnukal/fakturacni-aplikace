import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Trash2, PenLine } from 'lucide-react';

// Interní rozlišení plátna (CSS pixely, DPR se aplikuje uvnitř)
const CANVAS_W = 380;
const CANVAS_H = 140;

/**
 * SignaturePad – kreslicí plocha pro podpis "modrou propiskú"
 *
 * Props:
 *   existingUrl  – URL aktuálně uloženého podpisu (zobrazí se v náhledu)
 *   onChange(dataUrl | null) – volá se po každém zdvihu pera
 *                              dataUrl = 'data:image/png;base64,...' nebo null (plátno je prázdné)
 *   onRemove()   – volá se, když uživatel klikne "Smazat podpis" u uloženého podpisu
 */
const SignaturePad = ({ existingUrl, onChange, onRemove }) => {
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef(null);
  const [hasContent, setHasContent] = useState(false);
  const [showExisting, setShowExisting] = useState(!!existingUrl);

  // Inicializace plátna (DPR scaling + nastavení stylu pera)
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = CANVAS_W * dpr;
    canvas.height = CANVAS_H * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = '#1d4ed8'; // blue-700 = "modrá propiska"
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  useEffect(() => {
    setupCanvas();
  }, [setupCanvas]);

  // Synchronizuj zobrazení s existingUrl (např. při prvním načtení dat z Firestore)
  useEffect(() => {
    setShowExisting(!!existingUrl);
  }, [existingUrl]);

  // Převod souřadnic události na pozici v canvas CSS-pixelovém prostoru
  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    // Pokud je canvas zmenšen CSS (responsive), přepočítáme
    const scaleX = CANVAS_W / rect.width;
    const scaleY = CANVAS_H / rect.height;
    const src = e.touches ? e.touches[0] : e;
    return {
      x: (src.clientX - rect.left) * scaleX,
      y: (src.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (e) => {
    e.preventDefault();
    isDrawingRef.current = true;
    const pos = getPos(e);
    lastPosRef.current = pos;
    setHasContent(true);

    // Nakreslí tečku při kliknutí bez pohybu
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 1.2, 0, Math.PI * 2);
    ctx.fillStyle = '#1d4ed8';
    ctx.fill();
  };

  const handlePointerMove = (e) => {
    e.preventDefault();
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pos = getPos(e);
    const last = lastPosRef.current;

    // Bezierova křivka pro hladký tah
    const mid = { x: (last.x + pos.x) / 2, y: (last.y + pos.y) / 2 };
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.quadraticCurveTo(last.x, last.y, mid.x, mid.y);
    ctx.stroke();
    lastPosRef.current = pos;
  };

  const handlePointerUp = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    // Exportuje plátno po každém zdvihu – rodič ho uloží do stavu
    onChange(canvasRef.current.toDataURL('image/png'));
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    setHasContent(false);
    onChange(null);
  };

  // --- Zobrazení uloženého podpisu ---
  if (showExisting && existingUrl) {
    return (
      <div className="space-y-3">
        <div className="border rounded-lg bg-white p-3 inline-block shadow-sm">
          <img
            src={existingUrl}
            alt="Uložený podpis"
            crossOrigin="anonymous"
            style={{ maxHeight: 90, maxWidth: 320, display: 'block' }}
          />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setShowExisting(false);
              setHasContent(false);
              // Reset plátna pro nové kreslení
              setTimeout(setupCanvas, 0);
            }}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 rounded"
          >
            <PenLine size={14} /> Překreslit podpis
          </button>
          <button
            type="button"
            onClick={() => {
              setShowExisting(false);
              onRemove();
            }}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-100 hover:bg-red-200 text-red-700 rounded"
          >
            <Trash2 size={14} /> Smazat podpis
          </button>
        </div>
      </div>
    );
  }

  // --- Kreslicí plocha ---
  return (
    <div className="space-y-2">
      <div
        className="relative border-2 border-dashed border-blue-300 rounded-lg bg-white overflow-hidden"
        style={{ width: '100%', maxWidth: CANVAS_W, height: CANVAS_H }}
      >
        <canvas
          ref={canvasRef}
          style={{ display: 'block', width: '100%', height: '100%' }}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerUp}
          onTouchStart={handlePointerDown}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
          className="cursor-crosshair touch-none select-none"
        />
        {!hasContent && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-blue-300 text-sm italic select-none">
              Kreslete zde podpis modrou propiskú...
            </span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={clearCanvas}
          className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
        >
          <Trash2 size={14} /> Smazat
        </button>
        {hasContent && (
          <span className="text-xs text-green-600">
            ✓ Podpis bude uložen spolu s nastavením
          </span>
        )}
      </div>
    </div>
  );
};

export default SignaturePad;
