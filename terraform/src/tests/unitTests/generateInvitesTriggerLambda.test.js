test.todo("Fix this test");

// import {
//   getLsoaCode,
//   updateRecord,
//   updatePersonsToBeInvited,
//   updateClinicFields,
// } from "../../generateInvitesTriggerLambda/generateInvitesTriggerLambda.js";
// import { mockClient } from "aws-sdk-client-mock";
// import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

// describe("getLsoaCode", () => {
//   const mockDynamoDbClient = mockClient(new DynamoDBClient({}));

//   test("return lsoa code", async () => {
//     mockDynamoDbClient.resolves({
//       $metadata: {
//         httpStatusCode: 200,
//       },
//       Body: "E0001",
//     });

//     const result = await getLsoaCode("record", mockDynamoDbClient);

//     expect(result.Body).toEqual("E0001");
//   });
// });

// describe("updateRecord", () => {
//   const mockDynamoDbClient = mockClient(new DynamoDBClient({}));

//   test("Return response 200 when lsoa code is present", async () => {
//     mockDynamoDbClient.resolves({
//       $metadata: {
//         httpStatusCode: 200,
//       },
//       Items: [
//         {
//           LsoaCode: {
//             S: "E0001",
//           },
//         },
//       ],
//     });

//     const result = await updateRecord("record", mockDynamoDbClient);

//     expect(result).toEqual(200);
//   });
// });

// describe("updatePersonsToBeInvited", () => {
//   test("should loop through and add property of LSOA with population info", async () => {
//     const mockDynamoDbClient = mockClient(new DynamoDBClient({}));
//     const recordArrayMock = ["a", "b"];

//     mockDynamoDbClient.resolves({
//       $metadata: {
//         httpStatusCode: 200,
//       },
//       Items: [
//         {
//           LsoaCode: {
//             S: "E0001",
//           },
//         },
//       ],
//     });
//     const result = await updatePersonsToBeInvited(
//       recordArrayMock,
//       mockDynamoDbClient
//     );

//     expect(result[0].status).toEqual("fulfilled");
//     expect(result[0].value).toEqual(200);
//     expect(result[1].status).toEqual("fulfilled");
//     expect(result[1].value).toEqual(200);
//   });
// });

// describe("updateClinicFields", () => {
//   const mockDynamoDbClient = mockClient(new DynamoDBClient({}));

//   const clinicInfo = {
//     clinicId: "1",
//     clinicName: "clinic",
//     rangeSelected: 10,
//     targetPercentage: 50,
//   };

//   test("Return response 200 clinic has been updated", async () => {
//     mockDynamoDbClient.resolves({
//       $metadata: {
//         httpStatusCode: 200,
//       },
//     });

//     const result = await updateClinicFields(clinicInfo, 1, mockDynamoDbClient);

//     expect(result).toEqual(200);
//   });
// });
