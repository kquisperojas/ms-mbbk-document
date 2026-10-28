$ErrorActionPreference = "Stop"

$psql = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
if (-not (Test-Path $psql)) {
    throw "No se encontro psql en $psql. Ajusta la ruta si tu PostgreSQL no es 18."
}

$sql = Join-Path $PSScriptRoot "init-local-db.sql"

Write-Host "Creando usuario admin y base bd_document (te pedira la clave de postgres)..."
& $psql -U postgres -h 127.0.0.1 -f $sql
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

Write-Host "Listo. Relanza MsMbbkDocumentApplication."
