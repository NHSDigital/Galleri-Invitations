#!/bin/bash

set -e

# Script to upload data into respective AWS dyanmodb table.
#
# Usage:
#   $ ./seed-data.sh
#
# ==============================================================================

function main() {

  aws dynamodb batch-write-item --request-items \
          file://$PWD/test-data/file.json
}

# ==============================================================================

main $*

exit 0




