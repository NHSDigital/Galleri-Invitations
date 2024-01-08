import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

import { getItemsFromTable } from "../../participatingIcbListLambda/participatingIcbListLambda.js";

describe("getItemsFromTable", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });
  test("return item from table", async () => {
    const mockDynamodbClient = mockClient(new DynamoDBClient({}));

    mockDynamodbClient.resolves({
      Items: "foo",
    });

    const result = await getItemsFromTable("Table", mockDynamodbClient);

    console.log(result);

    const expected_result = {
      Items: "foo",
    };

    expect(result).toEqual(expected_result);
  });
});
