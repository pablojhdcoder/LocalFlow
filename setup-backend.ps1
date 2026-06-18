param(
  [int]$Port = 3000,
  [string]$HostName = "0.0.0.0",
  [switch]$NoReload,
  [switch]$SetupOnly
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$venvDir = Join-Path $repoRoot "backend\.venv"
$venvPython = Join-Path $venvDir "Scripts\python.exe"
$requirements = Join-Path $repoRoot "backend\requirements.txt"

function Get-PythonExe {
  if (Get-Command "python" -ErrorAction SilentlyContinue) {
    return "python"
  }
  if (Get-Command "py" -ErrorAction SilentlyContinue) {
    return "py -3"
  }
  throw "No se encontró 'python' ni 'py'. Instala Python antes de ejecutar el setup."
}

function Test-Command {
  param([Parameter(Mandatory=$true)][string]$Name)
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

Write-Host "Setup backend Python (FastAPI) - venv en: $venvDir"

if (-not (Test-Path $venvPython)) {
  $python = Get-PythonExe
  Write-Host "Creando entorno virtual..."
  & $python -m venv $venvDir
}

if (-not (Test-Path $requirements)) {
  throw "No existe $requirements"
}

Write-Host "Instalando dependencias dentro del venv..."
& $venvPython -m pip install --upgrade pip
& $venvPython -m pip install -r $requirements

Write-Host "Verificando import de yt_dlp..."
& $venvPython -c "import yt_dlp; print('yt_dlp import ok')"

$reloadArg = ""
if (-not $NoReload) {
  $reloadArg = "--reload"
}

if ($SetupOnly) {
  Write-Host "Setup completado. Sin iniciar el servidor (SetupOnly activado)."
  exit 0
}

Write-Host "Arrancando uvicorn en http://localhost:$Port ..."
& $venvPython -m uvicorn backend.main:app --host $HostName --port $Port $reloadArg

