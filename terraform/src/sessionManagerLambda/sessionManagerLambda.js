import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";

const dynamoDBClient = new DynamoDBClient({ region: "eu-west-2" });
const environment = process.env.ENVIRONMENT;

export async function retrieveSession(sessionId) {
  const params = {
    TableName: `${environment}-next-auth`,
    Key: {
      sessionId: { S: sessionId },
    },
  };

  try {
    const command = new GetItemCommand(params);
    const data = await dynamoDBClient.send(command);

    if (!data.Item) {
      console.error("Session not found");
      return null;
    }

    return unmarshall(data.Item);
  } catch (error) {
    console.error("Error getting session from DynamoDB:", error);
    throw error;
  }
}
