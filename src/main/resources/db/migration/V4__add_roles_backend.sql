INSERT INTO roles (id, nombre)
SELECT '11111111-1111-1111-1111-111111111111', 'Software engineer'
WHERE NOT EXISTS (
    SELECT 1 FROM roles WHERE LOWER(nombre) = LOWER('Software engineer')
);

INSERT INTO roles (id, nombre)
SELECT '55555555-5555-5555-5555-555555555555', 'Tech Lead'
WHERE NOT EXISTS (
    SELECT 1 FROM roles WHERE LOWER(nombre) = LOWER('Tech Lead')
);
