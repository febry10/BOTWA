/**
 * QR route — shows the WhatsApp login QR so the bot can be paired without terminal access.
 */
import { Router, Request, Response } from 'express';
import QRCode from 'qrcode';
import { getConnectionInfo } from '../../bot/client.js';

export const qrRoutes = Router();

qrRoutes.get('/', async (_req: Request, res: Response) => {
  const { state, qr } = getConnectionInfo();
  let body: string;
  if (state === 'open') {
    body = '<h2 style="color:#00d4aa">✅ Bot sudah terhubung ke WhatsApp</h2>';
  } else if (qr) {
    const dataUrl = await QRCode.toDataURL(qr, { width: 360, margin: 2 });
    body = `<h2>Scan QR: WhatsApp → Perangkat tertaut → Tautkan perangkat</h2><img src="${dataUrl}" alt="QR" style="background:#fff;padding:8px;border-radius:8px">`;
  } else {
    body = '<h2>⏳ Menunggu QR dari WhatsApp...</h2>';
  }
  res.send(`<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><meta http-equiv="refresh" content="5"><title>QR Login — GroupGuard</title></head>
<body style="font-family:sans-serif;background:#0a0f1c;color:#e0e0e0;text-align:center;padding:40px">${body}<p style="color:#888">Halaman refresh otomatis tiap 5 detik. <a href="/" style="color:#00d4aa">Kembali ke dashboard</a></p></body></html>`);
});
