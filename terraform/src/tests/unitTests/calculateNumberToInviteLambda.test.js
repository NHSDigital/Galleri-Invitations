import {
  getItemsFromTable,
  invokeParticipantListLambda,
  getParticipantsInQuintile,
} from "../../calculateNumberToInviteLambda/calculateNumberToInviteLambda";
import { mockClient } from "aws-sdk-client-mock";
import { LambdaClient } from "@aws-sdk/client-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

describe("getItemsFromTable", () => {
  const mockDynamoDbClient = mockClient(new DynamoDBClient({}));

  test("should mock call to dynamoDb successfully", async () => {
    mockDynamoDbClient.resolves({
      $metadata: {
        httpStatusCode: 200,
      },
      Body: "hello",
    });

    const result = await getItemsFromTable("table", mockDynamoDbClient, "key");

    expect(result.Body).toEqual("hello");
  });
});

describe("invokeParticipantListLambda", () => {
  const mockLambdaClient = mockClient(new LambdaClient({}));

  test("should mock lambda invocation successfully", async () => {
    const payload = JSON.stringify({ message: "hello from payload" });

    mockLambdaClient.resolves({
      $metadata: {
        httpStatusCode: 200,
      },
      Payload: Buffer.from(payload),
    });

    const result = await invokeParticipantListLambda(
      "lambdaName",
      payload,
      mockLambdaClient
    );

    expect(result).toEqual({
      message: "hello from payload",
    });
  });
});

describe("getParticipantsInQuintile", () => {
  test("should loop through and add property of LSOA with population info", async () => {
    const forecastUptakeObj = {
      forecastUptake: 100,
    };

    const randomStringKey = [...Array(10)].map(() => {
      const randomStr = "abcdefghij"
        .split("")
        .sort(() => 0.5 - Math.random())
        .join("");
      return [randomStr.slice(0, Math.random() * 10 + 2)];
    });
    const quintilePopulationArray = randomStringKey.map((el) => {
      let obj = {};
      obj["personId"] = el[0];
      obj["moderator"] = 1;
      return obj;
    });
    const quintileTarget = 1;
    const nationalForecastUptake = 100;
    const Q = "test";
    const result = getParticipantsInQuintile(
      quintilePopulationArray,
      quintileTarget,
      nationalForecastUptake,
      Q
    );

    expect(result.size).toEqual(10);
  });
});
