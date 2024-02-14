import { readSecret } from "../../gtmsMeshMailboxLambda/gtmsMeshMailboxLambda";
import { getSecret } from "../../gtmsMeshMailboxLambda/helper";

jest.mock("../../gtmsMeshMailboxLambda/helper");
getSecret.mockResolvedValue("eyBTZWNyZXRTdHJpbmc6ICIxMjMiIH0=");


describe("readSecret", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  })
  afterEach(() => {
    jest.resetAllMocks();
  })
  test('test readSecret', async () => {
    const logSpy = jest.spyOn(global.console, "log");
    const result = await readSecret("test", "je");
    console.log(result);
    expect(result).toBe('{ SecretString: "123" }');
    expect(logSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(`{ SecretString: "123" }`);
  })
})
