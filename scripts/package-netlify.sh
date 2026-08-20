#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "${script_dir}/.." && pwd)"
output_dir="${project_root}/netlify-dist"
next_dir="${project_root}/.next"

[[ -f "${next_dir}/server/app/index.html" ]] || {
  echo "Missing prerendered Next.js home page." >&2
  exit 66
}

rm -rf "${output_dir}"
mkdir -p "${output_dir}/_next"
cp "${next_dir}/server/app/index.html" "${output_dir}/index.html"
cp -R "${next_dir}/static" "${output_dir}/_next/static"

if [[ -d "${project_root}/public" ]]; then
  cp -R "${project_root}/public/." "${output_dir}/"
fi

echo "Packaged Netlify static frontend in netlify-dist."
