export async function handler(event, context) {
  console.log('EVENT: \n' + JSON.stringify(event, null, 2));
  let responseMessage = 'Hello world';
  return responseMessage;
}
