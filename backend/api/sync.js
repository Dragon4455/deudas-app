const pool = require('../db');

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const deudas = req.body;
    for (const deuda of deudas) {
      await pool.execute(
        `INSERT INTO deudas (id, cliente, items, total, moneda, tasa_transaccion, fecha, estado, sync_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
         cliente = VALUES(cliente),
         items = VALUES(items),
         total = VALUES(total),
         moneda = VALUES(moneda),
         tasa_transaccion = VALUES(tasa_transaccion),
         estado = VALUES(estado),
         sync_status = 1,
         updated_at = CURRENT_TIMESTAMP`,
        [deuda.id, deuda.cliente, JSON.stringify(deuda.items), deuda.total, deuda.moneda, deuda.tasa_transaccion, deuda.fecha, deuda.estado, 1]
      );
    }
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error sincronizando deudas' });
  }
}