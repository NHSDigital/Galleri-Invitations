README
This folder contains a main.js that takes in dummy data male/female to generate new male/female CSV files.
The new CSV files must include only those postcodes which are present in the LSOA data CSV.
The generated male/female CSV files will be output to ./csv/output/<filename>.csv

To /generate files:
Run the 'node main' command.

To upload to the s3 bucket:
Get programmatic access to AWS
Run 'sh upload_to_s3.sh'
