import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";

const dynamoDBClient = new DynamoDBClient({ region: "eu-west-2" });
const environment = process.env.ENVIRONMENT;

async function retrieveSession(sessionId) {
  const params = {
    TableName: `${environment}-session`,
    Key: {
      sessionId: { S: sessionId },
    },
  };

  try {
    const data = await dynamoDBClient.send(new GetItemCommand(params));
    if (!data.Item) {
      return null; // Session not found
    }

    const session = unmarshall(data.Item);

    if (session.expirationTime < Date.now()) {
      return null; // Session has expired
    }

    return session;
  } catch (error) {
    console.error("Error retrieving session:", error);
    throw error;
  }
}

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: "Method Not Allowed" }),
    };
  }

  const { sessionId } = JSON.parse(event.body);

  try {
    const session = await retrieveSession(sessionId);

    if (!session) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "Session not found or expired" }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(session),
    };
  } catch (error) {
    console.error("Error handling request:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal Server Error" }),
    };
  }
}
