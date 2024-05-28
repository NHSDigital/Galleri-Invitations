import {
  processIncomingRecords,
  lookupParticipantId,
  createEpisodeRecord,
} from "../../createEpisodeRecords/createEpisodeRecords";
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

describe("processIncomingRecords", () => {
  const mockDynamoDbClient = mockClient(new DynamoDBClient({}));

  test("record has not changed", async () => {
    mockDynamoDbClient.resolves({
      $metadata: {
        httpStatusCode: 200,
      },
      Items: [],
    });

    const episodeToProcessArray = [
      {
        dynamodb: {
          OldImage: {
            identified_to_be_invited: {
              BOOL: false,
            },
          },
          NewImage: {
            identified_to_be_invited: {
              BOOL: false,
            },
          },
        },
      },
    ];

    const result = await processIncomingRecords(
      episodeToProcessArray,
      mockDynamoDbClient
    );
    console.log(result);

    expect(result[0].status).toEqual("rejected");
  });

  test("participantId already exists", async () => {
    const logSpy = jest.spyOn(global.console, "log");
    mockDynamoDbClient.resolves({
      $metadata: {
        httpStatusCode: 200,
      },
      Items: ["record exists"],
    });

    const episodeToProcessArray = [
      {
        dynamodb: {
          OldImage: {
            identified_to_be_invited: {
              BOOL: false,
            },
          },
          NewImage: {
            identified_to_be_invited: {
              BOOL: true,
            },
            participantId: {
              S: "Participant ID",
            },
            Batch_Id: {
              S: "Batch ID",
            },
          },
        },
      },
    ];

    const result = await processIncomingRecords(
      episodeToProcessArray,
      mockDynamoDbClient
    );
    console.log(result);

    expect(result[0].status).toEqual("rejected");
    expect(logSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith("Duplicate exists");
  });
});

describe("lookupParticipantId", () => {
  const mockDynamoDbClient = mockClient(new DynamoDBClient({}));
  test("no participant with participantId exists", async () => {
    mockDynamoDbClient.resolves({
      $metadata: {
        httpStatusCode: 200,
      },
      Items: [],
    });

    const participantId = "Participant ID";
    const table = "table";

    const episodeToProcessArray = [
      {
        dynamodb: {
          OldImage: {
            identified_to_be_invited: {
              BOOL: false,
            },
          },
          NewImage: {
            identified_to_be_invited: {
              BOOL: true,
            },
            participantId: {
              S: "Participant ID",
            },
            Batch_Id: {
              S: "Batch ID",
            },
          },
        },
      },
    ];

    const result = await lookupParticipantId(
      participantId,
      table,
      mockDynamoDbClient
    );

    expect(result).toEqual(true);
  });

  test("participant with participantId does exist", async () => {
    const logSpy = jest.spyOn(global.console, "log");
    mockDynamoDbClient.resolves({
      $metadata: {
        httpStatusCode: 200,
      },
      Items: ["participant"],
    });

    const participantId = "Participant ID";
    const table = "table";

    const episodeToProcessArray = [
      {
        dynamodb: {
          OldImage: {
            identified_to_be_invited: {
              BOOL: false,
            },
          },
          NewImage: {
            identified_to_be_invited: {
              BOOL: true,
            },
            participantId: {
              S: "Participant ID",
            },
            Batch_Id: {
              S: "Batch ID",
            },
          },
        },
      },
    ];

    const result = await lookupParticipantId(
      participantId,
      table,
      mockDynamoDbClient
    );

    expect(logSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith("Duplicate exists");
    expect(result).toEqual(false);
  });
});

describe("createEpisodeRecord", () => {
  test("return array", async () => {
    const records = {
      participantId: {
        S: "Participant ID",
      },
      Batch_Id: {
        S: "Batch ID",
      },
      created_by: {
        S: "GPS",
      },
      Episode_Event_Updated: {
        S: "2024-05-14T18:13:50.303Z",
      },
      Episode_Creation: {
        S: "2024-05-14T18:13:50.303Z",
      },
      LsoaCode: {
        S: "9000234487",
      },
      gp_connect: {
        S: "SO14 0SL",
      },
      Episode_Status_Updated: {
        S: "2024-05-14T18:13:50.303Z",
      },
    };

    const ids = createEpisodeRecord(records);
    expect(ids.length).toEqual(records.length);
    expect(ids.Participant_Id).toEqual(records.participantId);
    expect(ids.Batch_Id).toEqual(records.Batch_Id);
    expect(ids.Episode_Event.S).toEqual("Invited");
    expect(ids.Episode_Event_Updated_By.S).toEqual("GPS");
  });
});
