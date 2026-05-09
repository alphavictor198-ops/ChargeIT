-- Initialize GatiCharge database extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For fuzzy text search

-- PostGIS for geospatial queries (uncomment if PostGIS is installed)
-- CREATE EXTENSION IF NOT EXISTS postgis;

-- Create app user if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'gaticharge') THEN
    CREATE USER gaticharge WITH PASSWORD 'gaticharge_secure_pass_2025';
  END IF;
END
$$;

GRANT ALL PRIVILEGES ON DATABASE gaticharge TO gaticharge;
