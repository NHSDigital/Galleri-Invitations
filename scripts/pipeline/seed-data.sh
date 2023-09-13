#!/bin/bash

set -e

# Script to upload data into respective AWS dyanmodb table.
#
# Usage:
#   $ ./seed-data.sh
#
# ==============================================================================

# function nonprod_lsoa_load(){
#   mkdir nonprod-lsoa-data

#   aws s3 cp s3://galleri-ons-data/non_prod_lsoa_data_//non_prod_lsoa_data_2023-08-22T15:27:52.810Z.csv ./nonprod_lsoa_data

#   source $PWD/scripts/pipeline/create-nonprod_lsoa_data_files.sh

#   echo Succefully created nonprod lsoa data

#   aws dynamodb batch-write-item --request-items \
#           file://$PWD/nonprod-lsoa-data/nonprod_lsoa.json
# }

function main() {
  mkdir test-data

  aws s3 cp s3://participating-icb/Participating_ICBs.csv ./test-data

  source $PWD/scripts/pipeline/create-data-files.sh

  echo Succefully created test data

  aws dynamodb batch-write-item --request-items \
          file://$PWD/test-data/participating_icb.json

  mkdir nonprod-lsoa-data

  aws s3 cp s3://galleri-ons-data/non_prod_lsoa_data_//non_prod_lsoa_data_2023-08-22T15:27:52.810Z.csv ./nonprod_lsoa_data

  source $PWD/scripts/pipeline/create-nonprod_lsoa_data_files.sh

  echo Succefully created nonprod lsoa data

  aws dynamodb batch-write-item --request-items \
          file://$PWD/nonprod-lsoa-data/nonprod_lsoa.json
}

# ==============================================================================

main $*

exit 0

