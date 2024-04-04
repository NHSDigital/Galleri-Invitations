import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";

import {
  formatEpisodeHistoryRecord,
  uploadEpisodeHistoryRecord,
} from "../../addEpisodeHistoryLambda/addEpisodeHistoryLambda.js";

describe("uploadEpisodeHistoryRecord", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });
  test("updates table item", async () => {
    const mockDynamoDbClient = mockClient(new DynamoDBClient({}));

    const item = {
      Item_1: {
        S: "item_1",
      },
    };
    mockDynamoDbClient.on(UpdateItemCommand).resolves({
      $metadata: {
        httpStatusCode: 200,
      },
    });

    const actual = await uploadEpisodeHistoryRecord(item, mockDynamoDbClient);
    expect(actual).toHaveProperty("$metadata.httpStatusCode", 200);
  });
});

describe("formatEpisodeHistoryRecord", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });
  test("correctly formats Dynamodb JSON object", async () => {
    const expected = {
      Key: {
        Participant_Id: {
          S: `ID_1`,
        },
      },
      ExpressionAttributeNames: {
        "#EE": "Episode_Event",
        "#EEU": "Episode_Event_Updated",
        "#EED": "Episode_Event_Description",
        "#EEN": "Episode_Event_Notes",
        "#EEUB": "Episode_Event_Updated_By",
        "#ES": "Episode_Status",
        "#ESU": "Episode_Status_Updated",
      },
      ExpressionAttributeValues: {
        ":episode_event": {
          S: `Episode_Event_1`,
        },
        ":episode_event_updated": {
          N: String(Date.now()),
        },
        ":episode_event_description": {
          S: `Episode_Event_Description_1`,
        },
        ":episode_event_notes": {
          S: `Episode_Event_Notes_1`,
        },
        ":episode_event_updated_by": {
          S: `Episode_Event_Updated_By_1`,
        },
        ":episode_status": {
          S: `Episode_Status_1`,
        },
        ":episode_status_updated": {
          N: `10`,
        },
      },
      TableName: `dev-EpisodeHistory`,
      UpdateExpression: `set #EE = :episode_event, #EEU = :episode_event_updated, #EED = :episode_event_description, #EEN = :episode_event_notes, #EEUB = :episode_event_updated_by, #ES = :episode_status, #ESU = :episode_status_updated`,
    };

    const mockRecord = {
      Participant_Id: { S: "ID_1" },
      Episode_Event: { S: "Episode_Event_1" },
      Episode_Event_Description: { S: "Episode_Event_Description_1" },
      Episode_Event_Notes: { S: "Episode_Event_Notes_1" },
      Episode_Event_Updated_By: { S: "Episode_Event_Updated_By_1" },
      Episode_Status: { S: "Episode_Status_1" },
      Episode_Status_Updated: { N: "10" },
    };

    const actual = formatEpisodeHistoryRecord(mockRecord);

    console.log(actual);

    expect(actual).toEqual(expected);
  });
});
