//compare lsoacodes of both arrays and append moderator if it matches
export const match = (lsoa, data) => {
  const lsoaRecords = [];
  lsoa.forEach((lsoa) => {
    for (const element of data) {
      if (String(element.LSOA_CODE) === String(lsoa.LSOA_2011)) {
        //  { LSOA_CODE: 'E01024906', Moderator: 0.782 }
        lsoa.MODERATOR = element.MODERATOR.toLocaleString("en-GB", {
          minimumFractionDigits: 3,
          useGrouping: false,
        });
        break;
      } else {
        lsoa.MODERATOR = 'Not Found';
      }
    }
    lsoaRecords.push(lsoa);
  });
  return lsoaRecords;
};
