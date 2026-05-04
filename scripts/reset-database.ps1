$ErrorActionPreference = "Stop"

Push-Location (Join-Path $PSScriptRoot "..")
try {
    docker compose -f docker/docker-compose.yml down -v
    docker compose -f docker/docker-compose.yml up --build -d
}
finally {
    Pop-Location
}
