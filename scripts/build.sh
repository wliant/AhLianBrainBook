#!/usr/bin/env bash
# Build every BrainBook image locally. Nothing is ever built on a target host.
#
# Usage: scripts/build.sh [image-tag]        (default: short git SHA)

source "$(dirname "$0")/lib/common.sh"
require_command docker git

IMAGE_TAG="$(resolve_image_tag "${1:-${IMAGE_TAG:-}}")"

for spec in "${IMAGES[@]}"; do
    name="${spec%%:*}"
    rest="${spec#*:}"
    context="${rest%%:*}"
    dockerfile="${rest#*:}"

    log "building $REGISTRY_NAMESPACE/$name:$IMAGE_TAG"
    docker build \
        -t "$REGISTRY_NAMESPACE/$name:$IMAGE_TAG" \
        -f "$REPO_ROOT/$dockerfile" \
        "$REPO_ROOT/$context"
done

log "built ${#IMAGES[@]} images at tag $IMAGE_TAG"
