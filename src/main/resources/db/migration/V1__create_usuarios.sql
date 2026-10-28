CREATE TABLE roles (
    id     UUID         PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE squads (
    id     UUID         PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL UNIQUE
);

INSERT INTO roles (id, nombre) VALUES
    ('11111111-1111-1111-1111-111111111111', 'Software engineer'),
    ('22222222-2222-2222-2222-222222222222', 'QA'),
    ('33333333-3333-3333-3333-333333333333', 'Product owner'),
    ('44444444-4444-4444-4444-444444444444', 'Arquitecto'),
    ('55555555-5555-5555-5555-555555555555', 'Tech lead'),
    ('66666666-6666-6666-6666-666666666666', 'Analista funcional');

INSERT INTO squads (id, nombre) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Célula Canales Digitales');

CREATE TABLE usuarios (
    id              UUID                     PRIMARY KEY,
    github_username VARCHAR(100)             NOT NULL,
    email           VARCHAR(150)             NOT NULL,
    password_hash   VARCHAR(100)             NOT NULL,
    nombre          VARCHAR(150)             NOT NULL,
    rol             VARCHAR(100)             NOT NULL REFERENCES roles (nombre),
    squad           VARCHAR(150)             NOT NULL REFERENCES squads (nombre),
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE UNIQUE INDEX ux_usuarios_github_username ON usuarios (LOWER(github_username));
CREATE UNIQUE INDEX ux_usuarios_email ON usuarios (LOWER(email));
