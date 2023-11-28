//moderator to be 3dp e.g. 0.831
export const fixDecimal = (lsoa) => {
  const lsoaRecords = [];
  lsoa.forEach((lsoa) => {
    //{ LSOA_CODE: 'E01024900', ICB: 'QE1', Moderator: '0.712937978' }
    for (const element in lsoa) {
      delete lsoa['ICB'];
      if (element === 'MODERATOR') {
        let roundedElement = Math.round(lsoa[element] * 1000) / 1000;
        lsoa[element] = roundedElement;
      }
    }
    lsoaRecords.push(lsoa);
  });
  return lsoaRecords;
};

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
