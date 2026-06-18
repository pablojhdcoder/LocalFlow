#!/usr/bin/env bash
set -euo pipefail

PORT="${1:-3000}"
HOST_NAME="${HOST_NAME:-0.0.0.0}"
SETUP_ONLY="${SETUP_ONLY:-0}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="${REPO_ROOT}/backend/.venv"
VENV_PYTHON="${VENV_DIR}/bin/python"
REQUIREMENTS="${REPO_ROOT}/backend/requirements.txt"

echo "Setup backend Python (FastAPI) - venv en: ${VENV_DIR}"

if [[ ! -x "${VENV_PYTHON}" ]]; then
  if ! command -v python3 >/dev/null 2>&1; then
    echo "Error: no se encontró python3. Instala Python antes de ejecutar este script." >&2
    exit 1
  fi
  echo "Creando entorno virtual..."
  python3 -m venv "${VENV_DIR}"
fi

if [[ ! -f "${REQUIREMENTS}" ]]; then
  echo "Error: no existe ${REQUIREMENTS}" >&2
  exit 1
fi

echo "Instalando dependencias dentro del venv..."
& "${VENV_PYTHON}" -m pip install --upgrade pip
& "${VENV_PYTHON}" -m pip install -r "${REQUIREMENTS}"

echo "Verificando import de yt_dlp..."
"${VENV_PYTHON}" -c "import yt_dlp; print('yt_dlp import ok')"

echo "Arrancando uvicorn en http://localhost:${PORT} ..."
if [[ "${SETUP_ONLY}" == "1" ]]; then
  echo "Setup completado. Sin iniciar el servidor (SETUP_ONLY=1)."
  exit 0
fi

"${VENV_PYTHON}" -m uvicorn backend.main:app --host "${HOST_NAME}" --port "${PORT}"

