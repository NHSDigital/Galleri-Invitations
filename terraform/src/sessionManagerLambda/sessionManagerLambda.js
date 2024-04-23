import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";

const dynamoDBClient = new DynamoDBClient({ region: "eu-west-2" });
const environment = process.env.ENVIRONMENT;

export async function handler(event) {
  if (event.httpMethod === "POST") {
    const user = JSON.parse(event.body);

    try {
      const existingSession = await retrieveSession(user.sessionId);
      if (existingSession) {
        return {
          statusCode: 200,
          body: JSON.stringify(existingSession),
        };
      }

      const sessionId = await createSession(user);

      return {
        statusCode: 200,
        body: JSON.stringify({ sessionId: sessionId }),
      };
    } catch (error) {
      console.error("Error handling request:", error);
      return {
        statusCode: 500,
        body: JSON.stringify({ message: "Internal Server Error" }),
      };
    }
  } else {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: "Method Not Allowed" }),
    };
  }
}

async function createSession(user) {
  const sessionId = generateSessionId();
  const expirationTime = Date.now() + 15 * 60 * 1000; // 15 minutes from now

  const params = {
    TableName: `${environment}-session`,
    Item: marshall({
      sessionId: sessionId,
      user: user,
      expirationTime: expirationTime,
    }),
  };

  try {
    await dynamoDBClient.send(new PutItemCommand(params));
    return sessionId;
  } catch (error) {
    console.error("Error creating session:", error);
    throw error;
  }
}

// Function to retrieve session data from DynamoDB using session ID
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

    // Check if session has expired
    if (session.expirationTime < Date.now()) {
      return null; // Session expired
    }

    return session;
  } catch (error) {
    console.error("Error retrieving session:", error);
    throw error;
  }
}
