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

  echo Initiating upload of unique LSOA data to database

  mkdir nonprod-lsoa-data

  aws s3 cp s3://galleri-ons-data/lsoa_data/lsoa_with_avg_easting_northing.csv ./nonprod-lsoa-data

  echo Succefully Downloaded CSV from S3

  echo Uploading items to UniqueLsoa database

  python $PWD/scripts/pipeline/nonprod_lsoa_load/nonprod_lsoa_load.py

  echo Succefully uploaded unique Lsoa data to database

  echo "--------------------------------------------------------------"

  echo Initiating upload of Postcode subset data to database

  mkdir nonprod-postcode-data

  aws s3 cp s3://galleri-ons-data/non_prod_lsoa_data_/non_prod_lsoa_data_2023-08-22T15:27:52.810Z.csv ./nonprod-postcode-data

  echo Succefully Downloaded CSV from S3

  echo Uploading items to Postcode database

  python $PWD/scripts/pipeline/nonprod_postcode_load/nonprod_postcode_load.py

  echo Succefully uploaded Postcode data to database

}

# ==============================================================================

main $*

# exit 0

