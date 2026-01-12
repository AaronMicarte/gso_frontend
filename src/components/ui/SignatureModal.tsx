'use client';

import React, { useRef, useState, useEffect } from 'react';
import Image from 'next/image';
import { Dialog } from '@/components/ui/Dialog';

interface SignatureModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (dataUrl: string, source: 'canvas' | 'upload') => void;
    loading?: boolean;
    confirmText?: string;
    confirmPrompt?: string;
    preContent?: React.ReactNode;
}

export function SignatureModal({ open, onOpenChange, onSave, loading = false, confirmText = 'Save', confirmPrompt, preContent }: SignatureModalProps) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [mode, setMode] = useState<'canvas' | 'upload'>('canvas');
    const [isDrawing, setIsDrawing] = useState(false);
    const [uploadedPreview, setUploadedPreview] = useState<string | null>(null);

    // Ensure canvas is sized correctly for high-DPI displays with fixed dimensions
    const ensureCanvasScaled = (canvas: HTMLCanvasElement | null) => {
        if (!canvas) return;
        const dpr = window.devicePixelRatio || 1;
        const displayWidth = 1000;
        const displayHeight = 300;
        const desiredWidth = Math.floor(displayWidth * dpr);
        const desiredHeight = Math.floor(displayHeight * dpr);
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        if (canvas.width !== desiredWidth || canvas.height !== desiredHeight) {
            // Set internal pixel size and reset transform
            canvas.width = desiredWidth;
            canvas.height = desiredHeight;
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.scale(dpr, dpr);
            // make sure background is white
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, displayWidth, displayHeight);
        }
    };

    useEffect(() => {
        const resizeCanvas = () => ensureCanvasScaled(canvasRef.current);
        // initial sizing and background
        resizeCanvas();
        // keep canvas sized when window changes
        window.addEventListener('resize', resizeCanvas);
        return () => window.removeEventListener('resize', resizeCanvas);
    }, [open, mode]);

    const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current!;
        if (!canvas) return;
        try { canvas.setPointerCapture(e.pointerId); } catch { }
        setIsDrawing(true);
        const ctx = canvas.getContext('2d')!;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = 'black';
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!isDrawing || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d')!;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const endDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current!;
        try { canvas.releasePointerCapture(e.pointerId); } catch { }
        setIsDrawing(false);
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, 1000, 300);
    };

    const handleUpload = (file?: File) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = reader.result as string;
            setUploadedPreview(dataUrl);
        };
        reader.readAsDataURL(file);
    };

    const handleSave = () => {
        if (confirmPrompt && !window.confirm(confirmPrompt)) {
            return;
        }

        if (mode === 'canvas') {
            const canvas = canvasRef.current!;
            const dataUrl = canvas.toDataURL('image/png');
            onSave(dataUrl, 'canvas');
            onOpenChange(false);
        } else if (mode === 'upload') {
            if (!uploadedPreview) return;
            onSave(uploadedPreview, 'upload');
            onOpenChange(false);
        }
    };

    return (
        <Dialog
            title="Capture Signature"
            description="Draw or upload your signature. Draw is recommended for authenticity."
            open={open}
            onOpenChange={onOpenChange}
            onConfirm={handleSave}
            confirmText={confirmText}
            cancelText="Cancel"
            loading={loading}
            contentClassName="w-[95vw] sm:max-w-[1100px] max-h-[90vh] overflow-y-auto p-6 sm:p-8"
        >
            <div className="space-y-3">
                {preContent}
                <div className="flex gap-2">
                    <button className={`px-3 py-1 rounded ${mode === 'canvas' ? 'bg-[var(--primary)] text-white' : 'bg-slate-100'}`} onClick={() => setMode('canvas')}>Draw</button>
                    <button className={`px-3 py-1 rounded ${mode === 'upload' ? 'bg-[var(--primary)] text-white' : 'bg-slate-100'}`} onClick={() => setMode('upload')}>Upload</button>
                </div>

                {mode === 'canvas' && (
                    <div className="flex flex-col items-center w-full">
                        <canvas
                            ref={canvasRef}
                            width={1000}
                            height={300}
                            onPointerDown={startDraw}
                            onPointerMove={draw}
                            onPointerUp={endDraw}
                            className="border border-slate-200 rounded-lg touch-none w-[1000px] max-w-full h-[300px]"
                            style={{ width: '1000px', height: '300px', maxWidth: '100%' }}
                        />
                        <div className="mt-2 flex gap-2">
                            <button type="button" className="px-3 py-1 bg-slate-100 rounded" onClick={clearCanvas}>Clear</button>
                        </div>
                    </div>
                )}

                {mode === 'upload' && (
                    <div className="space-y-2">
                        <input accept="image/png,image/jpeg" type="file" onChange={(e) => handleUpload(e.target.files?.[0])} />
                        {uploadedPreview && <Image src={uploadedPreview} alt="preview" width={600} height={300} className="w-full max-w-2xl border rounded object-contain" />}
                    </div>
                )}


            </div>
        </Dialog>
    );
}
