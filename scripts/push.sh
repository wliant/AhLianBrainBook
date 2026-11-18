#!/usr/bin/env bash
# Tag the local images for the registry and push them.
#
# Usage: scripts/push.sh <dev|prod> [image-tag]

source "$(dirname "$0")/lib/common.sh"
require_command docker

[[ $# -ge 1 ]] || die "usage: $(basename "$0") <dev|prod> [image-tag]"
load_env "$1"
# Note: deliberately not falling back to the env file's IMAGE_TAG. That
# value is the compose-interpolation default on the target; letting it
# outrank the git SHA here would push "latest" when no tag was given.
IMAGE_TAG="$(resolve_image_tag "${2:-}")"
require_env REGISTRY IMAGE_TAG

for spec in "${IMAGES[@]}"; do
    name="${spec%%:*}"
    local_ref="$REGISTRY_NAMESPACE/$name:$IMAGE_TAG"
    remote_ref="$REGISTRY/$REGISTRY_NAMESPACE/$name:$IMAGE_TAG"

    docker image inspect "$local_ref" >/dev/null 2>&1 \
        || die "$local_ref not found locally - run scripts/build.sh $IMAGE_TAG first"

    log "pushing $remote_ref"
    docker tag "$local_ref" "$remote_ref"
    docker push "$remote_ref"
done

log "pushed ${#IMAGES[@]} images to $REGISTRY at tag $IMAGE_TAG"
