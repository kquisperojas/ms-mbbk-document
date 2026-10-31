CREATE TABLE team_members_sqaud (
    id         UUID                     PRIMARY KEY,
    orden      INTEGER                  NOT NULL,
    nombre     VARCHAR(150)             NOT NULL,
    rol        VARCHAR(150)             NOT NULL,
    correo     VARCHAR(150),
    numero     VARCHAR(40),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE UNIQUE INDEX ux_team_members_sqaud_orden ON team_members_sqaud (orden);
CREATE UNIQUE INDEX ux_team_members_sqaud_correo ON team_members_sqaud (LOWER(correo))
    WHERE correo IS NOT NULL;

INSERT INTO team_members_sqaud (id, orden, nombre, rol, correo, numero, created_at, updated_at) VALUES
    ('10000000-0000-0000-0000-000000000001', 1,  'ANA ALEGRE', 'PO', 'ana.alegre@pichincha.pe', NULL, NOW(), NOW()),
    ('10000000-0000-0000-0000-000000000002', 2,  'Camilo Joel Medina Solorzano', 'Líder técnico', 'camilo.medina@pichincha.pe', NULL, NOW(), NOW()),
    ('10000000-0000-0000-0000-000000000003', 3,  'Niel Ugarte', 'Scrum Master', 'nugarte-ext@pichincha.pe', NULL, NOW(), NOW()),
    ('10000000-0000-0000-0000-000000000004', 4,  'Pedro Quispe Rojas', 'Desarrollador backend', 'pquispe-ext@pichincha.pe', NULL, NOW(), NOW()),
    ('10000000-0000-0000-0000-000000000005', 5,  'Eduardo Luis Velasquez Guerra', 'Desarrollador frontend', 'evelasquezg-ext@pichincha.pe', NULL, NOW(), NOW()),
    ('10000000-0000-0000-0000-000000000006', 6,  'Marlon Anthony Laguna Jurado', 'Desarrollador backend', 'mlaguna-ext@pichincha.pe', NULL, NOW(), NOW()),
    ('10000000-0000-0000-0000-000000000007', 7,  'Yheremi Fermin Ramos Quispe', 'Desarrollador backend', 'yramos-ext@pichincha.pe', NULL, NOW(), NOW()),
    ('10000000-0000-0000-0000-000000000008', 8,  'Percy Huillcapuma Acha', 'Desarrollador backend', 'phuillcapuma-ext@pichincha.pe', NULL, NOW(), NOW()),
    ('10000000-0000-0000-0000-000000000009', 9,  'Daniel Alberto Quinde La Rosa', 'Desarrollador backend', 'dquinde-ext@pichincha.pe', NULL, NOW(), NOW()),
    ('10000000-0000-0000-0000-00000000000a', 10, 'Elderson Laborit', 'Desarrollador móvil (iOS)', NULL, NULL, NOW(), NOW()),
    ('10000000-0000-0000-0000-00000000000b', 11, 'Maycol Meza', 'Desarrollador móvil (Android)', 'mmeza-ext@pichincha.pe', NULL, NOW(), NOW()),
    ('10000000-0000-0000-0000-00000000000c', 12, 'Marilyn Vargas', 'UX/UI', 'marilyn.vargas@pichincha.pe', NULL, NOW(), NOW()),
    ('10000000-0000-0000-0000-00000000000d', 13, 'Claudia Chumbiauca', 'QA', 'cchumbiauca-ext@pichincha.pe', NULL, NOW(), NOW()),
    ('10000000-0000-0000-0000-00000000000e', 14, 'Juan Daniel Rodriguez Paredes', 'QA', 'jrodriguezp-ext@pichincha.pe', NULL, NOW(), NOW()),
    ('10000000-0000-0000-0000-00000000000f', 15, 'Hermann Calif Nastares Cochachi', 'QA', 'hnastares-ext@pichincha.pe', NULL, NOW(), NOW());
