'use client';

import React, { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from './Button';
import { Printer } from 'lucide-react';

interface QRCodeWithPrintProps {
    value: string;
    size?: number;
    title?: string; // Optional title for the printed page
}

export const QRCodeWithPrint = ({ value, size = 128, title = 'QR Code' }: QRCodeWithPrintProps) => {
    const qrRef = useRef<HTMLDivElement>(null);

    const handlePrint = () => {
        const qrElement = qrRef.current?.querySelector('svg');
        if (qrElement) {
            // Create a new window for printing
            const printWindow = window.open('', '_blank');
            if (printWindow) {
                const svgString = new XMLSerializer().serializeToString(qrElement);
                
                printWindow.document.write(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>${title}</title>
                        <style>
                            body {
                                display: flex;
                                flex-direction: column;
                                align-items: center;
                                justify-content: center;
                                height: 100vh;
                                margin: 0;
                                font-family: system-ui, -apple-system, sans-serif;
                            }
                            .qr-container {
                                text-align: center;
                            }
                            .qr-value {
                                margin-top: 20px;
                                font-size: 14px;
                                color: #666;
                            }
                            @media print {
                                body { -webkit-print-color-adjust: exact; }
                            }
                        </style>
                    </head>
                    <body>
                        <div class="qr-container">
                            ${svgString}
                            <div class="qr-value">${value}</div>
                        </div>
                        <script>
                            window.onload = () => {
                                window.print();
                                window.onafterprint = () => window.close();
                            };
                        </script>
                    </body>
                    </html>
                `);
                printWindow.document.close();
            }
        }
    };

    return (
        <div className="flex flex-col items-center gap-4">
            <div ref={qrRef} className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                <QRCodeSVG value={value} size={size} />
            </div>
            <Button
                onClick={handlePrint}
                variant="outline"
                type="button"
                className="flex items-center gap-2"
            >
                <Printer className="w-4 h-4" />
                Print QR Code
            </Button>
        </div>
    );
};
