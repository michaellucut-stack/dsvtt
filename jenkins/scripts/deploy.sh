#!/bin/bash
# =============================================================================
# DSVTT (VTT Forge) — Production Deployment Script
# Sprint 7: Ship It v1.0
#
# Usage:  deploy.sh <command>
# Commands: deploy | rollback | health_check | cleanup
#
# Required environment variables:
#   IMAGE_TAG       - Docker image tag to deploy (e.g., BUILD_NUMBER)
#   COMPOSE_FILE    - Path to docker-compose prod file
#   HEALTH_URL      - Health check endpoint URL
#   HEALTH_TIMEOUT  - Seconds to wait for health check (default: 60)
#
# Optional environment variables:
#   KEEP_BUILDS     - Number of old image builds to keep (default: 5)
#   REGISTRY        - Container registry URL
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration defaults
# ---------------------------------------------------------------------------
IMAGE_TAG="${IMAGE_TAG:?IMAGE_TAG is required}"
COMPOSE_FILE="${COMPOSE_FILE:-docker/docker-compose.prod.yml}"
HEALTH_URL="${HEALTH_URL:-http://localhost:4000/health}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-60}"
KEEP_BUILDS="${KEEP_BUILDS:-5}"
REGISTRY="${REGISTRY:-registry.vttforge.com}"

SERVER_CONTAINER="dsvtt-server-prod"
WEB_CONTAINER="dsvtt-web-prod"

# ---------------------------------------------------------------------------
# Logging helpers
# ---------------------------------------------------------------------------
log_info()  { echo "[INFO]  $(date '+%Y-%m-%d %H:%M:%S') $*"; }
log_warn()  { echo "[WARN]  $(date '+%Y-%m-%d %H:%M:%S') $*"; }
log_error() { echo "[ERROR] $(date '+%Y-%m-%d %H:%M:%S') $*" >&2; }

# ---------------------------------------------------------------------------
# health_check — Poll the /health endpoint until it responds 200 or timeout
# ---------------------------------------------------------------------------
health_check() {
    local url="${1:-$HEALTH_URL}"
    local timeout="${2:-$HEALTH_TIMEOUT}"
    local interval=5
    local elapsed=0

    log_info "Waiting for health check at ${url} (timeout: ${timeout}s)"

    while [ "$elapsed" -lt "$timeout" ]; do
        local status
        status=$(curl -s -o /dev/null -w '%{http_code}' "$url" 2>/dev/null || echo "000")

        if [ "$status" = "200" ]; then
            log_info "Health check passed (HTTP ${status}) after ${elapsed}s"
            return 0
        fi

        log_info "Health check returned HTTP ${status} — retrying in ${interval}s (${elapsed}/${timeout}s)"
        sleep "$interval"
        elapsed=$((elapsed + interval))
    done

    log_error "Health check FAILED after ${timeout}s — service did not become healthy"
    return 1
}

# ---------------------------------------------------------------------------
# deploy — Full production deployment flow
# ---------------------------------------------------------------------------
deploy() {
    log_info "=========================================="
    log_info "Starting production deploy — image tag: ${IMAGE_TAG}"
    log_info "=========================================="

    # Step 1: Pull latest images from registry
    log_info "Pulling images from registry..."
    docker pull "${REGISTRY}/dsvtt-server:${IMAGE_TAG}" 2>/dev/null || {
        log_warn "Could not pull from registry — using locally built image"
    }
    docker pull "${REGISTRY}/dsvtt-web:${IMAGE_TAG}" 2>/dev/null || {
        log_warn "Could not pull from registry — using locally built image"
    }

    # Step 2: Run database migrations
    log_info "Running database migrations..."
    if docker ps --format '{{.Names}}' | grep -q "${SERVER_CONTAINER}"; then
        docker exec "${SERVER_CONTAINER}" npx prisma migrate deploy || {
            log_error "Database migration failed"
            return 1
        }
        log_info "Database migrations applied successfully"
    else
        log_warn "Server container not running — migrations will run on startup"
    fi

    # Step 3: Deploy services with docker compose
    log_info "Deploying services via docker compose..."
    export IMAGE_TAG
    docker compose -f "${COMPOSE_FILE}" up -d --remove-orphans

    # Step 4: Wait for services to start, then health check
    log_info "Waiting 10s for services to initialize..."
    sleep 10

    if health_check "$HEALTH_URL" "$HEALTH_TIMEOUT"; then
        log_info "=========================================="
        log_info "Deploy SUCCESSFUL — image tag: ${IMAGE_TAG}"
        log_info "=========================================="
        return 0
    else
        log_error "=========================================="
        log_error "Deploy FAILED — health check did not pass"
        log_error "=========================================="
        return 1
    fi
}

# ---------------------------------------------------------------------------
# rollback — Roll back to the previous image tag
# ---------------------------------------------------------------------------
rollback() {
    log_info "=========================================="
    log_info "Starting ROLLBACK to image tag: ${IMAGE_TAG}"
    log_info "=========================================="

    if [ "${IMAGE_TAG}" = "none" ] || [ -z "${IMAGE_TAG}" ]; then
        log_error "No previous image tag available for rollback"
        return 1
    fi

    # Step 1: Roll back database migration (best-effort)
    log_info "Attempting to roll back last database migration..."
    if docker ps --format '{{.Names}}' | grep -q "${SERVER_CONTAINER}"; then
        # Prisma doesn't have a built-in rollback command in production,
        # so we resolve the previous migration and mark it as rolled back.
        # In a real setup, use a migration tool that supports down migrations.
        docker exec "${SERVER_CONTAINER}" npx prisma migrate resolve --rolled-back "$(
            docker exec "${SERVER_CONTAINER}" npx prisma migrate status 2>/dev/null \
                | grep -oP 'Migration name: \K.*' | tail -1
        )" 2>/dev/null || {
            log_warn "Database rollback not possible or not needed — continuing"
        }
    fi

    # Step 2: Re-deploy previous version
    log_info "Re-deploying previous version (tag: ${IMAGE_TAG})..."
    export IMAGE_TAG
    docker compose -f "${COMPOSE_FILE}" up -d --remove-orphans

    # Step 3: Wait and health check
    log_info "Waiting 10s for rollback services to initialize..."
    sleep 10

    if health_check "$HEALTH_URL" "$HEALTH_TIMEOUT"; then
        log_info "=========================================="
        log_info "Rollback SUCCESSFUL — running tag: ${IMAGE_TAG}"
        log_info "=========================================="
        return 0
    else
        log_error "=========================================="
        log_error "Rollback ALSO FAILED — manual intervention required!"
        log_error "=========================================="
        return 1
    fi
}

# ---------------------------------------------------------------------------
# cleanup_old_images — Remove old Docker images, keeping the last N builds
# ---------------------------------------------------------------------------
cleanup_old_images() {
    local keep="${1:-$KEEP_BUILDS}"

    log_info "Cleaning up old Docker images (keeping last ${keep} builds)..."

    for image_name in "dsvtt-server" "dsvtt-web"; do
        # Get all tags sorted by creation date, skip the most recent $keep
        local old_tags
        old_tags=$(
            docker images "${REGISTRY}/${image_name}" --format '{{.Tag}} {{.CreatedAt}}' \
                | grep -v 'latest' \
                | sort -k2 -r \
                | tail -n +$((keep + 1)) \
                | awk '{print $1}'
        )

        if [ -z "$old_tags" ]; then
            log_info "No old images to clean for ${image_name}"
            continue
        fi

        for tag in $old_tags; do
            log_info "Removing ${REGISTRY}/${image_name}:${tag}"
            docker rmi "${REGISTRY}/${image_name}:${tag}" 2>/dev/null || true
            docker rmi "${image_name}:${tag}" 2>/dev/null || true
        done
    done

    # Prune dangling images
    docker image prune -f 2>/dev/null || true

    log_info "Docker image cleanup complete"
}

# ---------------------------------------------------------------------------
# Main dispatcher
# ---------------------------------------------------------------------------
main() {
    local command="${1:-help}"

    case "$command" in
        deploy)
            deploy
            ;;
        rollback)
            rollback
            ;;
        health_check|health)
            health_check "${2:-$HEALTH_URL}" "${3:-$HEALTH_TIMEOUT}"
            ;;
        cleanup)
            cleanup_old_images "${2:-$KEEP_BUILDS}"
            ;;
        help|--help|-h)
            echo "Usage: $0 <command>"
            echo ""
            echo "Commands:"
            echo "  deploy        Deploy the current IMAGE_TAG to production"
            echo "  rollback      Roll back to the previous IMAGE_TAG"
            echo "  health_check  Run health check against HEALTH_URL"
            echo "  cleanup       Remove old Docker images (keep last KEEP_BUILDS)"
            echo ""
            echo "Environment variables:"
            echo "  IMAGE_TAG       Docker image tag (required)"
            echo "  COMPOSE_FILE    docker-compose file path"
            echo "  HEALTH_URL      Health check URL"
            echo "  HEALTH_TIMEOUT  Health check timeout in seconds"
            echo "  KEEP_BUILDS     Number of builds to keep during cleanup"
            echo "  REGISTRY        Container registry URL"
            ;;
        *)
            log_error "Unknown command: ${command}"
            main help
            exit 1
            ;;
    esac
}

main "$@"
