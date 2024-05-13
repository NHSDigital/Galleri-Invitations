#!/bin/bash

set -x

NEW_VERSION="0.1.0"
REPO_TAGS=$(git tag)
SKIP_VERSION_BUMP=false
TAG_MESSAGE="New PR on $(date)"
VERSION=$(git describe --tags --abbrev=0)
VERSION_TO_BUMP=$1

if [[ -z $REPO_TAGS ]]; then
    echo "No tags detected in repo. Adding initial tag '0.1.0'"
    SKIP_VERSION_BUMP=true
fi

if [[ ("$SKIP_VERSION_BUMP" == false) && (-z $VERSION) ]]; then
    echo "Error: Unable to find previous Github Tag. Ensure at least the current closest tags is annotated."
    exit 1
fi

if [[ "$SKIP_VERSION_BUMP" == false ]]; then
    set - $(echo $VERSION |sed 's/\./ /g')
    if [[ $VERSION_TO_BUMP == "MINOR" ]]; then
        NEW_VERSION="$1.$(($2+1)).0"
    elif [[ $VERSION_TO_BUMP == "MAJOR" ]]; then
        NEW_VERSION="$(($1+1)).0.0"
    elif [[ $VERSION_TO_BUMP == "PATCH" ]]; then
        NEW_VERSION="$1.$2.$(($3+1))"
    fi
fi

echo OLD VERSION - $VERSION
echo NEW VERSION - $NEW_VERSION
# Set GH Actions Environment File
echo "release_tag=$NEW_VERSION" >> $GITHUB_ENV

git config --global user.name "galleri-invitations"
git config --global user.email "galleri-invitations@noreply.github.com"
git tag $NEW_VERSION -m "$TAG_MESSAGE"
git push origin $NEW_VERSION
