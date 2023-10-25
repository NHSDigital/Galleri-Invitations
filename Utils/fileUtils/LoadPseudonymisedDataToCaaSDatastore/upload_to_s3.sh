echo Uploading generated files to the galleri-test-data s3 bucket
aws s3 cp ./output/csv/dummyDataMaleUpdated.csv s3://galleri-test-data
aws s3 cp ./output/csv/dummyDataFemaleUpdated.csv s3://galleri-test-data
echo Finished.
