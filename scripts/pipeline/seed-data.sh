#!/bin/bash

set -e

# Script to upload data into respective AWS dyanmodb table.
#
# Usage:
#   $ ./seed-data.sh
#
# ==============================================================================

function main() {

  aws s3 cp s3://participating-icb/Participating_ICBs.csv ./test-data

  cat ./test-data/Participating_ICBs.csv

  # need to run the csv file and package data into a .json format like
  # the file.json below

  echo $PWD
  aws dynamodb batch-write-item --request-items \
          file://$PWD/test-data/file.json
}

# ==============================================================================

main $*

exit 0




