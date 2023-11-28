import { fixDecimal, match } from "./utils/helper";

describe("Test for appending moderator to unique lsoa csv", () => {
  const testCsvArray = [
    {
      POSTCODE: "AL1  1AG",
      POSTCODE_2: "AL1 1AG",
      LOCAL_AUT_ORG: "606",
      NHS_ENG_REGION: "Y61",
      SUB_ICB: "",
      CANCER_REGISTRY: "Y0401",
      EASTING_1M: "515487",
      NORTHING_1M: "0206498",
      LSOA_2011: "E01023741",
      MSOA_2011: "E02004940",
      CANCER_ALLIANCE: "E56000023",
      ICB: "QM7",
      OA_2021: "E00120543",
      LSOA_2021: "E01023741",
      MSOA_2021: "E02004940",
      IMD_RANK: "30070",
      IMD_DECILE: "10",
    },
    {
      POSTCODE: "AL1  1AJ",
      POSTCODE_2: "AL1 1AJ",
      LOCAL_AUT_ORG: "606",
      NHS_ENG_REGION: "Y61",
      SUB_ICB: "",
      CANCER_REGISTRY: "Y0401",
      EASTING_1M: "515491",
      NORTHING_1M: "0206410",
      LSOA_2011: "E01023741",
      MSOA_2011: "E02004940",
      CANCER_ALLIANCE: "E56000023",
      ICB: "QM7",
      OA_2021: "E00120543",
      LSOA_2021: "E01023741",
      MSOA_2021: "E02004940",
      IMD_RANK: "30070",
      IMD_DECILE: "10",
    },
    {
      POSTCODE: "AL1  1AR",
      POSTCODE_2: "AL1 1AR",
      LOCAL_AUT_ORG: "606",
      NHS_ENG_REGION: "Y61",
      SUB_ICB: "",
      CANCER_REGISTRY: "Y0401",
      EASTING_1M: "516270",
      NORTHING_1M: "0205897",
      LSOA_2011: "E01023684",
      MSOA_2011: "E02004939",
      CANCER_ALLIANCE: "E56000023",
      ICB: "QM7",
      OA_2021: "E00120276",
      LSOA_2021: "E01023684",
      MSOA_2021: "E02004939",
      IMD_RANK: "28935",
      IMD_DECILE: "9",
    },
  ];

  const testRoundedCsv = [
    { LSOA_CODE: 'E01023741', MODERATOR: 0.952 },
    { LSOA_CODE: 'E01023684', MODERATOR: 1.1 },
  ]

  test("test match function", async () => {
    const matchedResult = match(testCsvArray, testRoundedCsv);
    console.log(matchedResult);
    expect(matchedResult).toStrictEqual([
      {
        POSTCODE: "AL1  1AG",
        POSTCODE_2: "AL1 1AG",
        LOCAL_AUT_ORG: "606",
        NHS_ENG_REGION: "Y61",
        SUB_ICB: "",
        CANCER_REGISTRY: "Y0401",
        EASTING_1M: "515487",
        NORTHING_1M: "0206498",
        LSOA_2011: "E01023741",
        MSOA_2011: "E02004940",
        CANCER_ALLIANCE: "E56000023",
        ICB: "QM7",
        OA_2021: "E00120543",
        LSOA_2021: "E01023741",
        MSOA_2021: "E02004940",
        IMD_RANK: "30070",
        IMD_DECILE: "10",
        MODERATOR: "0.952"
      },
      {
        POSTCODE: "AL1  1AJ",
        POSTCODE_2: "AL1 1AJ",
        LOCAL_AUT_ORG: "606",
        NHS_ENG_REGION: "Y61",
        SUB_ICB: "",
        CANCER_REGISTRY: "Y0401",
        EASTING_1M: "515491",
        NORTHING_1M: "0206410",
        LSOA_2011: "E01023741",
        MSOA_2011: "E02004940",
        CANCER_ALLIANCE: "E56000023",
        ICB: "QM7",
        OA_2021: "E00120543",
        LSOA_2021: "E01023741",
        MSOA_2021: "E02004940",
        IMD_RANK: "30070",
        IMD_DECILE: "10",
        MODERATOR: "0.952"
      },
      {
        POSTCODE: "AL1  1AR",
        POSTCODE_2: "AL1 1AR",
        LOCAL_AUT_ORG: "606",
        NHS_ENG_REGION: "Y61",
        SUB_ICB: "",
        CANCER_REGISTRY: "Y0401",
        EASTING_1M: "516270",
        NORTHING_1M: "0205897",
        LSOA_2011: "E01023684",
        MSOA_2011: "E02004939",
        CANCER_ALLIANCE: "E56000023",
        ICB: "QM7",
        OA_2021: "E00120276",
        LSOA_2021: "E01023684",
        MSOA_2021: "E02004939",
        IMD_RANK: "28935",
        IMD_DECILE: "9",
        MODERATOR: "1.100"
      },
    ]);
  });

  test("test match function failure (append not found in moderator)", async () => {
    const csvWithDiffLsoa = [
      { LSOA_CODE: 'E01020182', MODERATOR: 0.894 },
      { LSOA_CODE: 'E01020150', MODERATOR: 1.127 },
    ]

    const matchedResult = match(testCsvArray, csvWithDiffLsoa);
    console.log(matchedResult);
    expect(matchedResult).toStrictEqual([
      {
        POSTCODE: "AL1  1AG",
        POSTCODE_2: "AL1 1AG",
        LOCAL_AUT_ORG: "606",
        NHS_ENG_REGION: "Y61",
        SUB_ICB: "",
        CANCER_REGISTRY: "Y0401",
        EASTING_1M: "515487",
        NORTHING_1M: "0206498",
        LSOA_2011: "E01023741",
        MSOA_2011: "E02004940",
        CANCER_ALLIANCE: "E56000023",
        ICB: "QM7",
        OA_2021: "E00120543",
        LSOA_2021: "E01023741",
        MSOA_2021: "E02004940",
        IMD_RANK: "30070",
        IMD_DECILE: "10",
        MODERATOR: "Not Found"
      },
      {
        POSTCODE: "AL1  1AJ",
        POSTCODE_2: "AL1 1AJ",
        LOCAL_AUT_ORG: "606",
        NHS_ENG_REGION: "Y61",
        SUB_ICB: "",
        CANCER_REGISTRY: "Y0401",
        EASTING_1M: "515491",
        NORTHING_1M: "0206410",
        LSOA_2011: "E01023741",
        MSOA_2011: "E02004940",
        CANCER_ALLIANCE: "E56000023",
        ICB: "QM7",
        OA_2021: "E00120543",
        LSOA_2021: "E01023741",
        MSOA_2021: "E02004940",
        IMD_RANK: "30070",
        IMD_DECILE: "10",
        MODERATOR: "Not Found"
      },
      {
        POSTCODE: "AL1  1AR",
        POSTCODE_2: "AL1 1AR",
        LOCAL_AUT_ORG: "606",
        NHS_ENG_REGION: "Y61",
        SUB_ICB: "",
        CANCER_REGISTRY: "Y0401",
        EASTING_1M: "516270",
        NORTHING_1M: "0205897",
        LSOA_2011: "E01023684",
        MSOA_2011: "E02004939",
        CANCER_ALLIANCE: "E56000023",
        ICB: "QM7",
        OA_2021: "E00120276",
        LSOA_2021: "E01023684",
        MSOA_2021: "E02004939",
        IMD_RANK: "28935",
        IMD_DECILE: "9",
        MODERATOR: "Not Found"
      },
    ]);
  });

});
