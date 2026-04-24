const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const pool = require('./db');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

// Ruta para sincronizar deudas
app.post('/api/sync', async (req, res) => {
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
});

// Ruta para obtener todas las deudas
app.get('/api/deudas', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM deudas ORDER BY fecha DESC');
    rows.forEach(row => {
      row.items = JSON.parse(row.items);
    });
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error obteniendo deudas' });
  }
});

// Ruta para obtener tasa actual
app.get('/api/tasa', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT tasa FROM tasas_diarias WHERE fecha = CURDATE() ORDER BY updated_at DESC LIMIT 1');
    if (rows.length > 0) {
      res.json({ tasa: rows[0].tasa });
    } else {
      res.json({ tasa: 30.00 }); // Default
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error obteniendo tasa' });
  }
});

// Ruta para actualizar tasa del día
app.post('/api/tasa', async (req, res) => {
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
});

// Ruta para obtener historial de tasas
app.get('/api/tasas', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM tasas_diarias ORDER BY fecha DESC');
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error obteniendo tasas' });
  }
});

// Ruta para editar tasa específica
app.put('/api/tasa/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { tasa } = req.body;
    await pool.execute('UPDATE tasas_diarias SET tasa = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [tasa, id]);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error editando tasa' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});