import { request } from "https";
import { parse } from "url";

const webhookUrl = process.env.url;

export async function handler(event) {
  const message = event.Records[0].Sns.Message;

  const postData = JSON.stringify({
    type: "AdaptiveCard",
    version: "1.2",
    body: [
      {
        type: "TextBlock",
        text: "Galleri Alert Triggered!",
        weight: "bolder",
        size: "medium",
      },
      {
        type: "TextBlock",
        text: `Alert Details: ${message}`,
        wrap: true,
      },
    ],
  });

  const webhook = parse(webhookUrl);

  const options = {
    hostname: webhook.hostname,
    port: 443,
    path: webhook.path,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(postData),
    },
  };

  return new Promise((resolve, reject) => {
    const req = request(options, (res) => {
      let result = "";
      res.on("data", (d) => {
        result += d;
      });
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({
            statusCode: res.statusCode,
            body: JSON.stringify({
              message: "Message sent to Teams channel",
              data: result,
            }),
          });
        } else {
          reject({
            statusCode: res.statusCode,
            body: JSON.stringify({
              message: "Failed to send message",
              data: result,
            }),
          });
        }
      });
    });

    req.on("error", (e) => {
      reject({
        statusCode: 500,
        body: JSON.stringify({
          message: "Network error",
          error: e.message,
        }),
      });
    });

    req.write(postData);
    req.end();
  });
}
