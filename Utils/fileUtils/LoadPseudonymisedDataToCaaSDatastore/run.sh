echo "[Remember to enable command line access to AWS first]"
echo "Generate new files aswell? [y/n]:"
echo "If 'y' the task will run and generate new files, if 'n' it will upload to s3 only"
read flag
if [[ "$flag" == "y" ]]; then
  echo "Files will be uploaded to s3 on task completion."
  echo Starting update task...
  node main
  echo Finished.
  echo Uploading generated files to the galleri-test-data s3 bucket
  aws s3 cp ./output/csv/dummyDataMaleUpdated.csv s3://galleri-test-data
  aws s3 cp ./output/csv/dummyDataFemaleUpdated.csv s3://galleri-test-data
  echo Finished upload.
elif [[ "$flag" == "n" ]]; then
  echo Uploading generated files to the galleri-test-data s3 bucket
  aws s3 cp ./output/csv/dummyDataMaleUpdated.csv s3://galleri-test-data
  aws s3 cp ./output/csv/dummyDataFemaleUpdated.csv s3://galleri-test-data
  echo Finished.
fi

