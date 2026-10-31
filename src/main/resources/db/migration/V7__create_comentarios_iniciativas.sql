CREATE TABLE comentarios_iniciativas (
    id               UUID                     PRIMARY KEY,
    iniciativa_key   VARCHAR(64)              NOT NULL,
    usuario_id       UUID                     NOT NULL REFERENCES usuarios (id),
    rol_id           UUID                     NOT NULL REFERENCES roles (id),
    texto            VARCHAR(2000)            NOT NULL,
    created_at       TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at       TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX ix_comentarios_iniciativas_key_fecha
    ON comentarios_iniciativas (iniciativa_key, created_at);

CREATE INDEX ix_comentarios_iniciativas_usuario
    ON comentarios_iniciativas (usuario_id);

CREATE INDEX ix_comentarios_iniciativas_rol
    ON comentarios_iniciativas (rol_id);
