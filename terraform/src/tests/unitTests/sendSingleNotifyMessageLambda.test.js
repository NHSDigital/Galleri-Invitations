import { v4 as uuidv4 } from 'uuid';
import { generateMessageReference } from '../../sendSingleNotifyMessageLambda/sendSingleNotifyMessageLambda';

describe('processRecords', () => {

});

describe('getSecret', () => {

});

describe('generateJWT', () => {

});

describe('getAccessToken', () => {

});

describe('putSuccessResponseIntoTable', () => {

});

describe('putFailedResponseIntoTable', () => {

});

describe('putItemIntoTable', () => {

});

describe('generateMessageReference', () => {
  it('should return a unique message reference ID', async () => {
    const messageReferenceId = await generateMessageReference();
    expect(messageReferenceId).toBeTruthy();
    expect(messageReferenceId).toHaveLength(36);
  });

  it('should return a different message reference ID each time it is called', async () => {
    const messageReferenceId1 = await generateMessageReference();
    const messageReferenceId2 = await generateMessageReference();
    expect(messageReferenceId1).not.toBe(messageReferenceId2);
  });
});

describe('sendSingleMessage', () => {

});

describe('deleteMessageInQueue', () => {

});
