const pool = require('../db');

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'GET') {
    try {
      const [rows] = await pool.execute('SELECT tasa FROM tasas_diarias WHERE fecha = CURDATE() ORDER BY updated_at DESC LIMIT 1');
      if (rows.length > 0) {
        res.json({ tasa: parseFloat(rows[0].tasa) });
      } else {
        res.json({ tasa: 30.00 });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error obteniendo tasa' });
    }
  } else if (req.method === 'POST') {
    try {
      const { tasa } = req.body;
      await pool.execute(
        `INSERT INTO tasas_diarias (fecha, tasa) VALUES (CURDATE(), ?)
         ON DUPLICATE KEY UPDATE tasa = VALUES(tasa), updated_at = CURRENT_TIMESTAMP`,
        [tasa]
      );
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error actualizando tasa' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}