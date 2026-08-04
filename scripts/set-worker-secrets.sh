#!/usr/bin/env bash
#
# Set every Cloudflare Worker secret from one values file.
#
# Replaces the 31 `wrangler secret put` prompts in Part E of
# docs/deployment/CLOUDFLARE.md, each of which pauses for a paste and gives no
# indication afterwards of which ones you have already done.
#
# Usage:
#     cp scripts/worker-secrets.example.env ~/dgo-secrets.env
#     # fill it in
#     ./scripts/set-worker-secrets.sh ~/dgo-secrets.env
#
# Safe to re-run: setting a secret again simply replaces it.
#
# THE VALUES FILE IS A CREDENTIAL. It holds the flow trigger URLs and both signing
# secrets. Keep it outside the repository, and delete it once the deployment is
# verified. This script refuses to read a file inside the repository, and refuses one
# that other users can read.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROXY_DIR="$REPO_ROOT/proxy"

RED=$'\033[31m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; DIM=$'\033[2m'; OFF=$'\033[0m'

die() { printf '%s%s%s\n' "$RED" "$1" "$OFF" >&2; exit 1; }

[ $# -eq 1 ] || die "Usage: $0 <values-file>

Create one from the template:
    cp scripts/worker-secrets.example.env ~/dgo-secrets.env"

VALUES_FILE="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
[ -f "$VALUES_FILE" ] || die "No such file: $VALUES_FILE"

# A secrets file inside the repository is one `git add -A` away from being published.
case "$VALUES_FILE" in
  "$REPO_ROOT"/*) die "Refusing to read a secrets file inside the repository.
Move it somewhere else — your home directory is fine — and pass that path instead.
This file holds every flow trigger URL and both signing secrets." ;;
esac

# Permissions. On a shared machine a world-readable secrets file is the whole exposure.
if [ "$(uname)" = "Darwin" ]; then PERMS=$(stat -f '%Lp' "$VALUES_FILE")
else PERMS=$(stat -c '%a' "$VALUES_FILE"); fi
case "$PERMS" in
  600|400) ;;
  *) printf '%sTightening permissions on %s (was %s)%s\n' "$YELLOW" "$VALUES_FILE" "$PERMS" "$OFF"
     chmod 600 "$VALUES_FILE" ;;
esac

command -v npx >/dev/null 2>&1 || die "npx not found. Install Node.js 18 or later."
[ -f "$PROXY_DIR/wrangler.toml" ] || die "Cannot find $PROXY_DIR/wrangler.toml"

# ── the full set ─────────────────────────────────────────────────────────────────────
# REQUIRED — the proxy refuses to serve without these.
REQUIRED=(
  DGO_TENANT_ID
  DGO_AUDIENCE
  DGO_ISSUER
  DGO_JWKS_URI
  DGO_ROLES_CLAIM
  DGO_ROLE_MAP
)

# CORE — the six endpoints a correspondence pilot actually needs. Every governed write in
# the platform goes through DYNAMIC_ACTIONS; the rest of the endpoints are features.
CORE=(
  DGO_ENDPOINT_DYNAMIC_ACTIONS
  DGO_ENDPOINT_FETCH_ALL
  DGO_ENDPOINT_SINGLE_ASSIGNMENT
  DGO_ENDPOINT_BULK_ASSIGNMENT
  DGO_ENDPOINT_INTAKE_SUBMISSION
  DGO_ENDPOINT_INTAKE_UPLOAD
)

# OPTIONAL — set them when you need the feature. Each is one command, no redeploy.
OPTIONAL=(
  DGO_UPLOAD_SECRET
  DGO_VERIFY_SECRET
  DGO_ENDPOINT_INTAKE_STATUS
  DGO_ENDPOINT_INTAKE_SUPPORT
  DGO_ENDPOINT_INTAKE_VERIFY_EMAIL
  DGO_ENDPOINT_SCAN_UPLOAD
  DGO_ENDPOINT_EMAIL
  DGO_ENDPOINT_EMAIL_RELATED_TASK
  DGO_ENDPOINT_FETCH_ACTIVITIES
  DGO_ENDPOINT_SUBSIDIARY_ACTIONS
  DGO_ENDPOINT_REFERENCE_DATA
  DGO_ENDPOINT_GET_DOCS
  DGO_ENDPOINT_FETCH_EMAIL_ATTACHMENTS
  DGO_ENDPOINT_BULK_ASSIGNMENT_DIRECT
  DGO_ENDPOINT_AI_EMAIL_ANALYSIS
  DGO_ENDPOINT_AI_DOC_ANALYSIS
  DGO_ENDPOINT_AI_CHAT
  DGO_ENDPOINT_OTP_GENERATE
  DGO_ENDPOINT_OTP_VERIFY
)

# ── read the file ────────────────────────────────────────────────────────────────────
# Parsed rather than sourced. `source` on a values file executes it, so a stray backtick
# in a pasted URL would run as a command.
declare -A VALUES
line_no=0
while IFS= read -r line || [ -n "$line" ]; do
  line_no=$((line_no + 1))
  case "$line" in ''|'#'*) continue ;; esac
  key=${line%%=*}
  val=${line#*=}
  [ "$key" = "$line" ] && die "Line $line_no is not NAME=value: $line"
  key=$(printf '%s' "$key" | tr -d '[:space:]')
  # Strip one layer of surrounding quotes if present.
  case "$val" in
    \"*\") val=${val#\"}; val=${val%\"} ;;
    \'*\') val=${val#\'}; val=${val%\'} ;;
  esac
  [ -n "$val" ] && VALUES["$key"]="$val"
done < "$VALUES_FILE"

# ── check what is present ────────────────────────────────────────────────────────────
missing_required=()
for k in "${REQUIRED[@]}"; do [ -n "${VALUES[$k]:-}" ] || missing_required+=("$k"); done
if [ ${#missing_required[@]} -gt 0 ]; then
  printf '%sMissing required value(s):%s\n' "$RED" "$OFF" >&2
  printf '    %s\n' "${missing_required[@]}" >&2
  die "The proxy refuses to serve without these. Fill them in and re-run."
fi

missing_core=()
for k in "${CORE[@]}"; do [ -n "${VALUES[$k]:-}" ] || missing_core+=("$k"); done

# ── sanity-check the values themselves ───────────────────────────────────────────────
# A wrong-shaped value here becomes a deployment that fails with no useful error.
for k in "${!VALUES[@]}"; do
  v=${VALUES[$k]}
  case "$k" in
    DGO_ENDPOINT_*)
      case "$v" in https://*) ;; *) die "$k must be an https:// URL, got: ${v:0:40}" ;; esac
      case "$v" in *sig=*) ;; *) printf '%s  warning: %s has no sig= — is it a real trigger URL?%s\n' "$YELLOW" "$k" "$OFF" ;; esac ;;
    DGO_ISSUER|DGO_JWKS_URI)
      case "$v" in https://*) ;; *) die "$k must start with https://, got: $v" ;; esac ;;
    DGO_JWKS_URI_CHECK) ;;
    DGO_UPLOAD_SECRET|DGO_VERIFY_SECRET)
      [ ${#v} -ge 32 ] || die "$k must be at least 32 characters (it is ${#v})" ;;
    DGO_ROLE_MAP)
      case "$v" in '{'*'}') ;; *) die "DGO_ROLE_MAP must be a JSON object on one line" ;; esac ;;
    DGO_TENANT_ID)
      case "$v" in https://*) die "DGO_TENANT_ID must NOT include https:// — that is DGO_ISSUER" ;; esac ;;
  esac
done

if [ -n "${VALUES[DGO_UPLOAD_SECRET]:-}" ] && [ "${VALUES[DGO_UPLOAD_SECRET]}" = "${VALUES[DGO_VERIFY_SECRET]:-}" ]; then
  die "DGO_UPLOAD_SECRET and DGO_VERIFY_SECRET must be different values."
fi

# ── set them ─────────────────────────────────────────────────────────────────────────
set_secret() {
  local name=$1 value=${VALUES[$1]:-}
  [ -n "$value" ] || return 1
  printf '%s' "$value" | (cd "$PROXY_DIR" && npx wrangler secret put "$name" >/dev/null 2>&1) \
    && printf '  %s✓%s %s\n' "$GREEN" "$OFF" "$name" \
    || { printf '  %s✗%s %s — wrangler rejected it\n' "$RED" "$OFF" "$name"; return 1; }
}

printf '\nSetting secrets on the Worker in %s\n\n' "$PROXY_DIR"

count=0; failed=0
printf 'Required\n'
for k in "${REQUIRED[@]}"; do set_secret "$k" && count=$((count+1)) || failed=$((failed+1)); done

printf '\nCore endpoints\n'
for k in "${CORE[@]}"; do
  if [ -n "${VALUES[$k]:-}" ]; then set_secret "$k" && count=$((count+1)) || failed=$((failed+1))
  else printf '  %s-%s %s %s(not in values file)%s\n' "$DIM" "$OFF" "$k" "$DIM" "$OFF"; fi
done

printf '\nOptional\n'
any_optional=0
for k in "${OPTIONAL[@]}"; do
  if [ -n "${VALUES[$k]:-}" ]; then set_secret "$k" && count=$((count+1)) || failed=$((failed+1)); any_optional=1; fi
done
[ $any_optional -eq 0 ] && printf '  %snone set — add them later, one command each, no redeploy%s\n' "$DIM" "$OFF"

# ── report ───────────────────────────────────────────────────────────────────────────
printf '\n%d secret(s) set' "$count"
[ $failed -gt 0 ] && printf ', %s%d failed%s' "$RED" "$failed" "$OFF"
printf '\n'

if [ ${#missing_core[@]} -gt 0 ]; then
  printf '\n%sNot set, and the pilot needs them:%s\n' "$YELLOW" "$OFF"
  printf '    %s\n' "${missing_core[@]}"
  printf 'The platform will run, but the affected paths will fail.\n'
fi

printf '\nNext:\n'
printf '    cd proxy && npx wrangler deploy\n'
printf '    curl -s <your-worker-url>/healthz\n\n'
printf 'In the health response, "referenceSequenceDurable" MUST be true.\n'
printf 'If it is false the register will issue duplicate references — do not run a pilot.\n\n'

[ $failed -eq 0 ] || exit 1
