#!/bin/bash

set -x

TAG_MESSAGE="New PR on $(date)"
SKIP_VERSION_BUMP=false
VERSION=$(git describe --tags --abbrev=0)
VERSION_TO_BUMP=$1

if [ -z $VERSION ]; then
    NEW_VERSION="99.0.0"
    SKIP_VERSION_BUMP=true
fi

if [ $SKIP_VERSION_BUMP == false ]; then
    set - $(echo $VERSION |sed 's/\./ /g')
    if [ $VERSION_TO_BUMP == "MINOR" ]; then
        NEW_VERSION="$1.$(($2+1)).0"
    elif [ $VERSION_TO_BUMP == "MAJOR" ]; then
        NEW_VERSION="$(($1+1)).0.0"
    elif [ $VERSION_TO_BUMP == "PATCH" ]; then
        NEW_VERSION="$1.$2.$(($3+1))"
    fi
fi

echo OLD VERSION - $VERSION
echo NEW VERSION - $NEW_VERSION

git config --global user.name "galleri-invitations"
git config --global user.email "galleri-invitations@noreply.github.com"
git tag $NEW_VERSION -m "$TAG_MESSAGE"
git push origin $NEW_VERSION
