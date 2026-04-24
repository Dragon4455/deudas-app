-- SQL para crear las tablas en Supabase

-- Tabla de deudas
CREATE TABLE deudas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente TEXT NOT NULL,
  items JSONB,
  total NUMERIC,
  moneda TEXT,
  tasa_transaccion NUMERIC,
  fecha TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  estado TEXT DEFAULT 'PENDIENTE',
  sync_status BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de tasas diarias
CREATE TABLE tasas_diarias (
  id SERIAL PRIMARY KEY,
  fecha DATE UNIQUE NOT NULL,
  tasa NUMERIC NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para mejor rendimiento
CREATE INDEX idx_deudas_fecha ON deudas(fecha DESC);
CREATE INDEX idx_deudas_estado ON deudas(estado);
CREATE INDEX idx_tasas_diarias_fecha ON tasas_diarias(fecha DESC);

-- Políticas RLS (Row Level Security) si quieres restringir acceso
-- Para deudas
ALTER TABLE deudas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir todo para usuarios autenticados" ON deudas FOR ALL USING (auth.role() = 'authenticated');

-- Para tasas
ALTER TABLE tasas_diarias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir todo para usuarios autenticados" ON tasas_diarias FOR ALL USING (auth.role() = 'authenticated');