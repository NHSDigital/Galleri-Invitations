import { mockClient } from "aws-sdk-client-mock";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

const s3Mock = mockClient(DynamoDBDocumentClient);

describe("index", () => {
  beforeEach(() => {
    ddbMock.reset();
  });

  it("should get user names from the DynamoDB (single user ID)", async () => {
    ddbMock.on(GetCommand).resolves({
      Item: { id: "user1", name: "John" },
    });
    const names = await getUserNames(["user1"]);
    expect(names).toStrictEqual(["John"]);
  });

  it("should get user names from the DynamoDB (multiple user IDs)", async () => {
    ddbMock
      .on(GetCommand)
      .resolves({
        Item: undefined,
      })
      .on(GetCommand, {
        TableName: "users",
        Key: { id: "user1" },
      })
      .resolves({
        Item: { id: "user1", name: "Alice" },
      })
      .on(GetCommand, {
        TableName: "users",
        Key: { id: "user2" },
      })
      .resolves({
        Item: { id: "user2", name: "Bob" },
      });
    const names = await getUserNames(["user1", "user2", "user3"]);
    expect(names).toStrictEqual(["Alice", "Bob", undefined]);
  });
});
