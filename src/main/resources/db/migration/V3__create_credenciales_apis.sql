CREATE TABLE IF NOT EXISTS credenciales_apis (
    id          UUID                     PRIMARY KEY,
    proveedor   VARCHAR(50)              NOT NULL,
    clave       VARCHAR(100)             NOT NULL,
    valor       TEXT                     NOT NULL,
    descripcion VARCHAR(255),
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at  TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_credenciales_apis_proveedor_clave
    ON credenciales_apis (LOWER(proveedor), LOWER(clave));
