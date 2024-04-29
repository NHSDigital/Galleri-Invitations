export const handler = async (event) => {
  // TODO implement
  const timeNow = new Date().toISOString();
  console.log(`THE LAMBDA TRIGGERED AS PER CRON FROM EVENT BRIDGE ${timeNow}`);
};
