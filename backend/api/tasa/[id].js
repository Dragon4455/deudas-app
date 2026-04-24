const pool = require('../../db');

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { id } = req.query;

  if (req.method === 'PUT') {
    try {
      const { tasa } = req.body;
      await pool.execute('UPDATE tasas_diarias SET tasa = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [tasa, id]);
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error editando tasa' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}