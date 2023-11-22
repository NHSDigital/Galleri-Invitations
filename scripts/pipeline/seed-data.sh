#!/bin/bash

set -e

# Script to upload data into respective AWS dyanmodb table.
#
# Usage:
#   $ ./seed-data.sh
#
# ==============================================================================

function main() {
  PARTICIPATING_ICB_COUNT=$(aws dynamodb scan --table-name $environment-ParticipatingIcb --select "COUNT" | jq -r ".Count")
  if [[ $? -eq 0 ]] && [[ $PARTICIPATING_ICB_COUNT =~ ^[0-9]+$ ]]; then
    if (($PARTICIPATING_ICB_COUNT < 1)); then
      echo "Initiating upload of Participating ICBs test data to database"
      mkdir -p test-data
      aws s3 cp s3://participating-icb/Participating_ICBs.csv ./test-data
      echo "Successfully Downloaded CSV from S3"
      source $PWD/scripts/pipeline/create-data-files.sh
      echo "Successfully formatted Participating ICBs test data"
      aws dynamodb batch-write-item --request-items file://$PWD/test-data/participating_icb.json
      echo "Successfully uploaded Participating ICBs test data to database"
    else
      echo "ParticipatingICB table already populated"
    fi
  else
    echo "Error: Failed to retrieve count from DynamoDB table or invalid count received"
  fi

  echo "--------------------------------------------------------------"

  NONPROD_LSOA_DATA_COUNT=$(aws dynamodb scan --table-name $environment-UniqueLsoa --select "COUNT" | jq -r ".Count")
  if [[ $? -eq 0 ]] && [[ $NONPROD_LSOA_DATA_COUNT =~ ^[0-9]+$ ]]; then
    if (($NONPROD_LSOA_DATA_COUNT < 1)); then
      echo Initiating upload of LSOA subset data to database
      mkdir nonprod-lsoa-data
      aws s3 cp s3://galleri-ons-data/non_prod_lsoa_data_/non_prod_lsoa_data_2023-08-22T15:27:52.810Z.csv ./nonprod-lsoa-data
      echo Succefully Downloaded CSV from S3
      echo Uploading items to LSOA database
      python $PWD/scripts/pipeline/nonprod_lsoa_load/nonprod_lsoa_load.py
      echo Succefully uploaded LSOA data to database
    else
      echo "LSOA table already populated"
    fi
  else
    echo "Error: Failed to retrieve count from DynamoDB table or invalid count received"
  fi

  echo "--------------------------------------------------------------"

  PHLEBOTOMY_CLINIC_DATA_COUNT=$(aws dynamodb scan --table-name $environment-PhlebotomySite --select "COUNT" | jq -r ".Count")
  if [[ $? -eq 0 ]] && [[ $PHLEBOTOMY_CLINIC_DATA_COUNT =~ ^[0-9]+$ ]]; then
    if (($PHLEBOTOMY_CLINIC_DATA_COUNT < 1)); then
      echo Initiating upload of Phlebotomy clinic data to database
      mkdir nonprod-phlebotomy-site-load
      echo Uploading items to Phlebotomy clinic database
      python $PWD/scripts/pipeline/nonprod_phlebotomy_site_load/nonprod_phlebotomy_site_load.py
      echo Succefully uploaded Phlebotomy clinic data to database
    else
      echo PhlebotomySite table already populated
    fi
  else
    echo "Error: Failed to retrieve count from DynamoDB table or invalid count received"
  fi
}

main $*

exit 0

