#!/bin/bash

set -e

# Script to upload data into respective AWS dyanmodb table.
#
# Usage:
#   $ ./seed-data.sh
#
# ==============================================================================

function main() {
  echo directory before download
  ls

  aws s3 cp s3://participating-icb/Participating_ICBs.csv ./test-data

  echo directory after download
  ls

  echo $PWD
  aws dynamodb batch-write-item --request-items \
          file://$PWD/test-data/file.json
}

# ==============================================================================

main $*

exit 0




