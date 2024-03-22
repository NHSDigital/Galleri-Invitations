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
    if (($PARTICIPATING_ICB_COUNT < 23)); then
      echo "Initiating upload of Participating ICBs test data to database"
      mkdir -p test-data
      sed -i "s/ENVIRONMENT/$environment/g" $GITHUB_WORKSPACE/scripts/test_data/participating_icb.json
      aws dynamodb batch-write-item --request-items file://$PWD/scripts/test_data/participating_icb.json
      echo "Successfully uploaded Participating ICBs test data to database"
    else
      echo "ParticipatingICB table already populated"
    fi
  else
    echo "Error: Failed to retrieve count from DynamoDB table or invalid count received"
  fi

  echo "--------------------------------------------------------------"

  if [[ $environment_type == "dev" || $environment_type == "test" ]]; then
    sed -i "s/ENVIRONMENT/$environment/g" $GITHUB_WORKSPACE/scripts/test_data/destructible_environments/lsoa.json
    aws dynamodb batch-write-item  --request-items file://$GITHUB_WORKSPACE/scripts/test_data/destructible_environments/lsoa.json
    # LSOA table needs a minimum of 1MB of data for lambda to function, hence as a workaround populating table with cut down CSV file with uncurated padding records in addition to lSOA json with curated data.
    mkdir nonprod-unique-lsoa-data
    # cp $PWD/scripts/test_data/lsoa/trimmed/unique_lsoa_data.csv ./nonprod-unique-lsoa-data
    unzip $PWD/scripts/test_data/lsoa/trimmed/unique_lsoa_data.zip -d ./nonprod-unique-lsoa-data

    # if [[ $environment_type == "dev" ]]; then
    #   aws s3 cp s3://galleri-ons-data/lsoa_data/destructible_environments/unique_lsoa_data.csv ./nonprod-unique-lsoa-data
    # else
    #   aws s3 cp s3://$environment_type-galleri-ons-data/lsoa_data/destructible_environments/unique_lsoa_data.csv ./nonprod-unique-lsoa-data
    # fi
    python $PWD/scripts/pipeline/nonprod_unique_lsoa_load/nonprod_unique_lsoa_load.py
  fi
  NONPROD_LSOA_DATA_COUNT=$(aws dynamodb scan --table-name $environment-UniqueLsoa --select "COUNT" | jq -r ".Count")
  if [[ $? -eq 0 ]] && [[ $NONPROD_LSOA_DATA_COUNT =~ ^[0-9]+$ ]]; then
    if (($NONPROD_LSOA_DATA_COUNT < 10)); then
      echo Initiating upload of LSOA subset data to database
      mkdir nonprod-unique-lsoa-data
      # aws s3 cp s3://$environment_type-galleri-ons-data/lsoa_data/unique_lsoa_data.csv ./nonprod-unique-lsoa-data
      unzip $PWD/scripts/test_data/lsoa/untrimmed/unique_lsoa_data.zip -d ./nonprod-unique-lsoa-data
      # cp $PWD/scripts/test_data/lsoa/untrimmed/unique_lsoa_data.csv ./nonprod-unique-lsoa-data
      ls -l ./nonprod-unique-lsoa-data
      echo Succefully Downloaded CSV from S3
      echo Uploading items to LSOA database
      python $PWD/scripts/pipeline/nonprod_unique_lsoa_load/nonprod_unique_lsoa_load.py
      echo Succefully uploaded LSOA data to database
    else
      echo "LSOA table already populated"
    fi
  else
    echo "Error: Failed to retrieve count from DynamoDB table or invalid count received"
  fi

  echo "--------------------------------------------------------------"

  if [[ $environment_type == "dev" || $environment_type == "test" ]]; then
    sed -i "s/ENVIRONMENT/$environment/g" $GITHUB_WORKSPACE/scripts/test_data/destructible_environments/phlebotomy.json
    aws dynamodb batch-write-item --request-items file://$GITHUB_WORKSPACE/scripts/test_data/destructible_environments/phlebotomy.json
  fi
  PHLEBOTOMY_CLINIC_DATA_COUNT=$(aws dynamodb scan --table-name $environment-PhlebotomySite --select "COUNT" | jq -r ".Count")
  if [[ $? -eq 0 ]] && [[ $PHLEBOTOMY_CLINIC_DATA_COUNT =~ ^[0-9]+$ ]]; then
    if (($PHLEBOTOMY_CLINIC_DATA_COUNT < 2)); then
      echo Uploading items to Phlebotomy clinic database
      python $PWD/scripts/pipeline/nonprod_phlebotomy_site_load/nonprod_phlebotomy_site_load.py
      echo Succefully uploaded Phlebotomy clinic data to database
    else
      echo PhlebotomySite table already populated
    fi
  else
    echo "Error: Failed to retrieve count from DynamoDB table or invalid count received"
  fi

  echo "--------------------------------------------------------------"

  POSTCODE_COUNT=$(aws dynamodb scan --table-name $environment-Postcode --select "COUNT" | jq -r ".Count")
  if [[ $? -eq 0 ]] && [[ $POSTCODE_COUNT =~ ^[0-9]+$ ]]; then
    if (($POSTCODE_COUNT < 1)); then
      echo Initiating upload of Postcode subset data to database
      mkdir nonprod-postcode-load
      unzip $PWD/scripts/test_data/lsoa_with_avg_easting_northing.zip -d ./nonprod-postcode-load
      # if [[ $environment_type == "dev" ]]; then
      #   aws s3 cp s3://galleri-ons-data/lsoa_data/lsoa_with_avg_easting_northing.csv ./nonprod-postcode-load
      # else
      #   aws s3 cp s3://$environment_type-galleri-ons-data/lsoa_data/lsoa_with_avg_easting_northing.csv ./nonprod-postcode-load
      # fi
      echo Succefully Downloaded CSV from S3
      echo Uploading items to Postcode database
      python $PWD/scripts/pipeline/nonprod_postcode_load/nonprod_postcode_load.py
      echo Succefully uploaded Postcode data to database
    else
      echo Postcode table already populated
    fi
  else
    echo "Error: Failed to retrieve count from DynamoDB table or invalid count received"
  fi

  echo "--------------------------------------------------------------"

  if [[ $environment_type == "dev" || $environment_type == "test" ]]; then
    sed -i "s/ENVIRONMENT/$environment/g" $GITHUB_WORKSPACE/scripts/test_data/destructible_environments/population*.json
    aws dynamodb batch-write-item  --request-items file://$GITHUB_WORKSPACE/scripts/test_data/destructible_environments/population1.json
    aws dynamodb batch-write-item  --request-items file://$GITHUB_WORKSPACE/scripts/test_data/destructible_environments/population2.json
    aws dynamodb batch-write-item  --request-items file://$GITHUB_WORKSPACE/scripts/test_data/destructible_environments/population3.json
    aws dynamodb batch-write-item  --request-items file://$GITHUB_WORKSPACE/scripts/test_data/destructible_environments/population4.json
  fi
  POPULATION_COUNT=$(aws dynamodb scan --table-name $environment-Population --select "COUNT" | jq -r ".Count")
  if [[ $? -eq 0 ]] && [[ $POPULATION_COUNT =~ ^[0-9]+$ ]]; then
    if (($POPULATION_COUNT < 100)); then
      echo Initiating upload of dummy Population data to database
      mkdir nonprod-population-data
      # aws s3 cp s3://$environment_type-galleri-test-data/non_prod_participant_data/ ./nonprod-population-data --recursive
      cp $PWD/scripts/test_data/unique_lsoa_data.csv ./nonprod-population-data --recursive
      echo Succefully Downloaded galleri-test-data CSVs from S3
      echo Uploading items to Population database
      python $PWD/scripts/pipeline/nonprod_population_load/nonprod_population_load.py
      echo Succefully uploaded dummy test data to Population database
    else
      echo Population table already populated
    fi
  else
    echo "Error: Failed to retrieve count from DynamoDB table or invalid count received"
  fi
}

main $*

exit 0

