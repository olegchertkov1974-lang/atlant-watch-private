#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "${NETLIFY:-}" == "true" ]]; then
  "${script_dir}/../node_modules/.bin/next" build
  exec bash "${script_dir}/package-netlify.sh"
fi

exec "${script_dir}/build-verified.sh"
