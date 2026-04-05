-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- Municipios
CREATE TABLE IF NOT EXISTS municipios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    provincia VARCHAR(50) NOT NULL,
    moratoria_turistica BOOLEAN DEFAULT false,
    precio_m2_vivienda_ref NUMERIC(8,2),
    geom GEOMETRY(POINT, 4326)
);

CREATE INDEX IF NOT EXISTS idx_municipios_geom ON municipios USING GIST (geom);

-- Locales
CREATE TABLE IF NOT EXISTS locales (
    id SERIAL PRIMARY KEY,
    url_origen TEXT UNIQUE NOT NULL,
    portal VARCHAR(50) NOT NULL,
    titulo VARCHAR(300),
    precio NUMERIC(10,2),
    superficie_m2 NUMERIC(6,2),
    altura_techo NUMERIC(3,2),
    descripcion_raw TEXT,
    direccion TEXT,
    municipio_id INTEGER REFERENCES municipios(id),
    imagen_url TEXT,
    geom GEOMETRY(POINT, 4326),
    fecha_scraping TIMESTAMP DEFAULT NOW(),
    activo BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_locales_municipio ON locales(municipio_id);
CREATE INDEX IF NOT EXISTS idx_locales_portal ON locales(portal);
CREATE INDEX IF NOT EXISTS idx_locales_activo ON locales(activo);
CREATE INDEX IF NOT EXISTS idx_locales_geom ON locales USING GIST (geom);

-- Analisis de viabilidad
CREATE TABLE IF NOT EXISTS analisis_viabilidad (
    id SERIAL PRIMARY KEY,
    local_id INTEGER REFERENCES locales(id) UNIQUE,
    apto_habitabilidad BOOLEAN,
    motivo_rechazo TEXT[],
    coste_total NUMERIC(10,2),
    roi_pct NUMERIC(5,2),
    puntuacion_viabilidad INTEGER CHECK (puntuacion_viabilidad BETWEEN 0 AND 100),
    distancia_playa_m INTEGER,
    keywords_ia JSONB,
    uso_recomendado VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analisis_puntuacion ON analisis_viabilidad(puntuacion_viabilidad DESC);

-- Seed municipios costa Huelva + Sevilla + Cádiz
INSERT INTO municipios (nombre, provincia, moratoria_turistica, precio_m2_vivienda_ref, geom) VALUES
  ('Punta Umbría',   'Huelva', false, 1800.00, ST_SetSRID(ST_MakePoint(-6.9603, 37.1817), 4326)),
  ('Islantilla',     'Huelva', false, 1950.00, ST_SetSRID(ST_MakePoint(-7.1833, 37.1500), 4326)),
  ('El Portil',      'Huelva', false, 1750.00, ST_SetSRID(ST_MakePoint(-7.0167, 37.1833), 4326)),
  ('La Antilla',     'Huelva', false, 1700.00, ST_SetSRID(ST_MakePoint(-7.1500, 37.1667), 4326)),
  ('Mazagón',        'Huelva', false, 1600.00, ST_SetSRID(ST_MakePoint(-6.8167, 37.1333), 4326)),
  ('Isla Cristina',  'Huelva', false, 1650.00, ST_SetSRID(ST_MakePoint(-7.3167, 37.2000), 4326)),
  ('Ayamonte',       'Huelva', false, 1550.00, ST_SetSRID(ST_MakePoint(-7.4000, 37.2167), 4326)),
  ('Huelva',         'Huelva', false, 1400.00, ST_SetSRID(ST_MakePoint(-6.9444, 37.2614), 4326)),
  ('Sevilla',        'Sevilla', true,  2800.00, ST_SetSRID(ST_MakePoint(-5.9845, 37.3891), 4326)),
  ('Cádiz',          'Cádiz',   true,  2200.00, ST_SetSRID(ST_MakePoint(-6.2886, 36.5297), 4326))
ON CONFLICT DO NOTHING;
