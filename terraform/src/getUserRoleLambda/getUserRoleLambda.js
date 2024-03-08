import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";

const dynamoDBClient = new DynamoDBClient({ region: "eu-west-2" });
const environment = process.env.ENVIRONMENT;

exports.handler = async (event) => {
  const uuid = event.queryStringParameters.uuid;

  const params = {
    TableName: `${environment}-UserAccounts`,
    Key: {
      UUID: { S: uuid },
    },
  };

  console.log("UUID from query string parameters is: ", uuid);

  try {
    const command = new GetItemCommand(params);
    const data = await dynamoDBClient.send(command);

    if (!data.Item) {
      console.error("User not found");
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "User not found" }),
      };
    }

    const item = unmarshall(data.Item);

    return {
      statusCode: 200,
      body: JSON.stringify(item),
    };
  } catch (error) {
    console.error("Error getting item from DynamoDB:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal Server Error" }),
    };
  }
};
