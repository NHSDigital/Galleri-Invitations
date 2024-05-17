import { mockClient } from "aws-sdk-client-mock";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

import {
  formatTestResultRecord,
  sendToTopic,
} from "../../publishTestResultsLambda/publishTestResultsLambda.js";

describe("sendToTopic", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });
  test("Sends message to Topic", async () => {
    const mockSNSClient = mockClient(new SNSClient({}));

    const item = {
      Item_1: {
        S: "item_1",
      },
    };
    mockSNSClient.on(PublishCommand).resolves({
      $metadata: {
        httpStatusCode: 200,
      },
    });

    const actual = await sendToTopic(item, mockSNSClient);
    expect(actual).toHaveProperty("$metadata.httpStatusCode", 200);
  });
});

describe("formatTestResultRecord", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });
  test("Correctly formats Dynamodb JSON object", async () => {
    const expected = {
      Message: {
        participant_id: {
          S: `ID_1`
        },
        grail_id: {
          S: `NHS-06WR7LP`
        },
        grail_FHIR_result_id: {
          S: `6f6-47eb-8`
        }
      },
      MessageStructure: 'json',
      TopicArn: "arn:aws:sns:eu-west-2:136293001324:topic-name/undefined-testResultTopic"
    };

    const mockRecord = {
      Participant_Id: { S: "ID_1" },
      Grail_Id: { S: "NHS-06WR7LP" },
      Grail_FHIR_Result_Id: { S: "6f6-47eb-8" }
    };

    const actual = formatTestResultRecord(mockRecord);

    console.log(actual);

    expect(actual).toEqual(expected);
  });
});
