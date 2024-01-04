import {
  processIncomingRecords,
  lookupParticipantId,
  loopThroughRecords,
  batchWriteToDynamo,
} from "../../createEpisodeRecords/createEpisodeRecords";
import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

describe("processIncomingRecords", () => {
  const mockDynamoDbClient = mockClient(new DynamoDBClient({}));

  // test("return successful array", async () => {
  //   mockDynamoDbClient.resolves({
  //     $metadata: {
  //       httpStatusCode: 200,
  //     },
  //     Items: [],
  //   });
  //   const episodeToProcessArray = [
  //     {
  //       dynamodb: {
  //         OldImage: {
  //           identified_to_be_invited: {
  //             BOOL: false,
  //           },
  //         },
  //         NewImage: {
  //           identified_to_be_invited: {
  //             BOOL: true,
  //           },
  //           participantId: {
  //             S: "Participant ID",
  //           },
  //           Batch_Id: {
  //             S: "Batch ID",
  //           },
  //         },
  //       },
  //     },
  //   ];
  //   const result = await processIncomingRecords(
  //     episodeToProcessArray,
  //     mockDynamoDbClient
  //   );
  //   expect(result[0].status).toEqual("fulfilled");
  // });

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
    expect(logSpy).toHaveBeenCalledWith("RECORD ALREADY EXISTS");
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

describe("loopThroughRecords", () => {
  const mockDynamoDbClient = mockClient(new DynamoDBClient({}));

  test("split array and call write each piece to db", async () => {
    const logSpy = jest.spyOn(global.console, "log");
    mockDynamoDbClient.resolves({
      $metadata: {
        httpStatusCode: 200,
      },
    });

    const chunkSize = 2;
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
              S: "Participant ID 1",
            },
            Batch_Id: {
              S: "Batch ID 1",
            },
          },
        },
      },
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
              S: "Participant ID 2",
            },
            Batch_Id: {
              S: "Batch ID 2",
            },
          },
        },
      },
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
              S: "Participant ID 3",
            },
            Batch_Id: {
              S: "Batch ID 3",
            },
          },
        },
      },
    ];
    const result = await loopThroughRecords(
      episodeToProcessArray,
      chunkSize,
      mockDynamoDbClient
    );

    expect(logSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith("Writing to dynamo");
  });

  test("split array and call write each piece to db, with remainder", async () => {
    const logSpy = jest.spyOn(global.console, "log");
    mockDynamoDbClient.resolves({
      $metadata: {
        httpStatusCode: 200,
      },
    });

    const chunkSize = 2;
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
              S: "Participant ID 1",
            },
            Batch_Id: {
              S: "Batch ID 1",
            },
          },
        },
      },
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
              S: "Participant ID 2",
            },
            Batch_Id: {
              S: "Batch ID 2",
            },
          },
        },
      },
    ];
    const result = await loopThroughRecords(
      episodeToProcessArray,
      chunkSize,
      mockDynamoDbClient
    );

    expect(logSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith("Writing to dynamo");
    expect(logSpy).toHaveBeenCalledWith("Writing remainder");
  });

  test("edge case with no records", async () => {
    const chunkSize = 2;
    const episodeToProcessArray = [];
    const result = await loopThroughRecords(
      episodeToProcessArray,
      chunkSize,
      mockDynamoDbClient
    );

    expect(result).toEqual([]);
  });
});

describe("batchWriteToDynamo", () => {
  const mockDynamoDbClient = mockClient(new DynamoDBClient({}));

  test("Return response 200 when successfully written to db", async () => {
    const batch = [{ value: 200 }, { value: 200 }];

    const table = "table";

    mockDynamoDbClient.resolves({
      $metadata: {
        httpStatusCode: 200,
      },
    });

    const result = await batchWriteToDynamo(mockDynamoDbClient, table, batch);

    expect(result).toEqual(200);
  });
  test("Return response 400 when no records to write", async () => {
    const batch = [];

    const table = "table";

    mockDynamoDbClient.resolves({
      $metadata: {
        httpStatusCode: 400,
      },
    });

    const result = await batchWriteToDynamo(mockDynamoDbClient, table, batch);

    expect(result).toEqual(400);
  });
});
