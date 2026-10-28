INSERT INTO roles (id, nombre)
SELECT '77777777-7777-7777-7777-777777777777', 'Administrador'
WHERE NOT EXISTS (
    SELECT 1 FROM roles WHERE LOWER(nombre) = LOWER('Administrador')
);

ALTER TABLE usuarios
    ADD COLUMN IF NOT EXISTS perfil_publico VARCHAR(150);

UPDATE usuarios
SET perfil_publico = github_username
WHERE perfil_publico IS NULL OR perfil_publico = '';

ALTER TABLE usuarios
    ALTER COLUMN perfil_publico SET NOT NULL;

UPDATE usuarios
SET rol = 'Administrador'
WHERE LOWER(github_username) = 'admin';
