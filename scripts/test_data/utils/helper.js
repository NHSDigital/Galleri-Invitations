//calculates avg midpoint for lsoa using postcode data
export const groupBy = (arr, prop) => {
  const map = new Map(Array.from(arr, (obj) => [obj[prop], []]));
  arr.forEach((obj) => {
    map.get(obj[prop]).push(obj);
  });

  map.forEach((x) => {
    let avgEasting = 0;
    let avgNorthing = 0;
    for (let i = 0; i < x.length; i++) {
      if (x[i].EASTING_1M && x[i].NORTHING_1M) {
        avgEasting += Math.floor(parseInt(x[i].EASTING_1M, 10) / x.length);
        avgNorthing += Math.floor(parseInt(x[i].NORTHING_1M, 10) / x.length);
      } else {
        throw "groupBy function failed: ";
      }
    }
    for (let i = 0; i < x.length; i++) {
      x[i].AVG_EASTING = String(avgEasting);
      x[i].AVG_NORTHING = avgNorthing.toLocaleString("en-GB", {
        minimumIntegerDigits: 7,
        useGrouping: false,
      });
    }
  });
  const finalArray = Array.from(map.values());
  return finalArray.flat();
};
