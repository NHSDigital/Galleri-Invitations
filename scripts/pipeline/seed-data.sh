#!/bin/bash

set -e

# Script to upload data into respective AWS dyanmodb table.
#
# Usage:
#   $ ./seed-data.sh
#
# ==============================================================================

function main() {
  echo Initiating upload of Participating ICBs test data to database

  mkdir test-data

  aws s3 cp s3://participating-icb/Participating_ICBs.csv ./test-data

  echo Succefully Downloaded CSV from S3

  source $PWD/scripts/pipeline/create-data-files.sh

  echo Succefully formatted Participating ICBs test data

  aws dynamodb batch-write-item --request-items \
          file://$PWD/test-data/participating_icb.json

  echo Succefully uploaded Participating ICBs test data to database

  echo "--------------------------------------------------------------"

  echo Initiating upload of Phlebotomy clinic data to database

  mkdir nonprod-phlebotomy-site-load

  echo Uploading items to Phlebotomy clinic database

  python $PWD/scripts/pipeline/nonprod_phlebotomy_site_load/nonprod_phlebotomy_site_load.py

  echo Succefully uploaded Phlebotomy clinic data to database

  echo "--------------------------------------------------------------"

  # echo Initiating upload of unique LSOA data to database

  # mkdir ./nonprod-unique-lsoa-data

  # aws s3 cp s3://galleri-ons-data/lsoa_data/unique_lsoa_data.csv ./nonprod-unique-lsoa-data

  # echo Succefully Downloaded CSV from S3

  # echo Uploading items to UniqueLsoa database

  # python $PWD/scripts/pipeline/nonprod-unique-lsoa-data/nonprod_unique_lsoa_load.py

  # echo Succefully uploaded unique Lsoa data to database

  # echo "--------------------------------------------------------------"

  # echo Initiating upload of Postcode subset data to database

  # mkdir nonprod-postcode-data

  # aws s3 cp s3://galleri-ons-data/non_prod_lsoa_data_/lsoa_with_avg_easting_northing.csv ./nonprod-postcode-data

  # echo Succefully Downloaded CSV from S3

  # echo Uploading items to Postcode database

  # python $PWD/scripts/pipeline/nonprod_postcode_load/nonprod_postcode_load.py

  # echo Succefully uploaded Postcode data to database

}

# ==============================================================================

main $*

exit 0

