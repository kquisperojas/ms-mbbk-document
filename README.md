# ms-mbbk-document

Microservicio Java 21 / Spring Boot 3.5 para el CRUD de usuarios del portal MBBK. Persistencia en PostgreSQL.

Campos del formulario **Crear usuario**:

| UI | JSON / columna |
|---|---|
| Usuario GitHub | `githubUsername` (`usuarios.github_username`) |
| Correo | `email` |
| Contraseña | `password` (se guarda como BCrypt en `password_hash`; nunca se devuelve) |
| Nombre | `nombre` |
| Rol | `rol` (catálogo) |
| Squad | `squad` (catálogo) |

El API también acepta alias del front: `username`, `displayName`, `role`.

## Arranque

Credenciales locales (las usa `application.yml`): usuario `admin`, clave `admin`, base `bd_document` en `localhost:5432`.

### PostgreSQL local (Windows)

Si ya tienes el servicio `postgresql-x64-18` en el 5432, crea usuario y base una vez:

```powershell
cd C:\WORKSPACE\DOCUMENTACION\ms-mbbk-document
.\scripts\init-local-db.ps1
```

O a mano:

```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -h 127.0.0.1 -c "CREATE USER admin WITH PASSWORD 'admin';"
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -h 127.0.0.1 -c "CREATE DATABASE bd_document OWNER admin;"
```

Luego, en IntelliJ: Run `MsMbbkDocumentApplication`. Desde consola (requiere `JAVA_HOME`):

```powershell
cd C:\WORKSPACE\DOCUMENTACION\ms-mbbk-document
.\mvnw.cmd spring-boot:run
```

### Docker (alternativa)

```powershell
cd C:\WORKSPACE\DOCUMENTACION\ms-mbbk-document
docker compose up -d
.\mvnw.cmd spring-boot:run
```

El contenedor no arranca si el 5432 ya lo usa el PostgreSQL de Windows.

- API: http://localhost:8080
- Swagger: http://localhost:8080/swagger-ui.html
- Health: http://localhost:8080/actuator/health

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/v1/usuarios` | Registrar |
| GET | `/api/v1/usuarios` | Listar (paginado) |
| GET | `/api/v1/usuarios/{id}` | Consultar |
| PUT | `/api/v1/usuarios/{id}` | Actualizar (`password` opcional) |
| DELETE | `/api/v1/usuarios/{id}` | Eliminar |
| GET | `/api/v1/catalogos/roles` | Roles del combo |
| GET | `/api/v1/catalogos/squads` | Squads del combo |

Rol semilla: Software engineer.  
Squad semilla: Célula Canales Digitales.

## Ejemplo

```bash
curl -X POST http://localhost:8080/api/v1/usuarios ^
  -H "Content-Type: application/json" ^
  -d "{\"githubUsername\":\"kquispe\",\"email\":\"kevin@pichincha.pe\",\"password\":\"secreto123\",\"nombre\":\"Kevin\",\"rol\":\"Software engineer\",\"squad\":\"Célula Canales Digitales\"}"
```

## Tests

```bash
mvnw.cmd test
```
