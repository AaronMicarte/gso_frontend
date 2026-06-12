import { QrScanPage } from '@/components/features/qr/QrScanPage';

export default function QrGenerateRoute() {
    // QrGeneratePage is not present; render the scan page as a safe fallback.
    return <QrScanPage />;
}
