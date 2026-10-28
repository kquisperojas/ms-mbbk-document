-- Ejecutar como superusuario postgres (PostgreSQL local en Windows).
-- Crea el usuario y la base que usa application.yml.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'admin') THEN
    CREATE ROLE admin LOGIN PASSWORD 'admin';
  ELSE
    ALTER ROLE admin WITH LOGIN PASSWORD 'admin';
  END IF;
END
$$;

SELECT 'CREATE DATABASE bd_document OWNER admin'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'bd_document')
\gexec
