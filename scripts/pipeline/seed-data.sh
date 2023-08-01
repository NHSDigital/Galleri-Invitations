#!/bin/bash

set -e

# Script to upload data into respective AWS dyanmodb table.
#
# Usage:
#   $ ./seed-data.sh
#
# ==============================================================================

function main() {
  mkdir test-data

  aws s3 cp s3://participating-icb/Participating_ICBs.csv ./test-data

  source $PWD/scripts/pipeline/create-data-files.sh

  echo Succefully created test data

  aws dynamodb batch-write-item --request-items \
          file://$PWD/test-data/participating_icb.json
}

# ==============================================================================

main $*

exit 0

