import { request } from "https";
import { parse } from "url";

const webhookUrl = process.env.url;

export async function handler(event) {
  const message = event.Records[0].Sns.Message;

  const postData = JSON.stringify({
    type: "message",
    attachments: [
      {
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
        resolve({
          statusCode: 200,
          body: JSON.stringify({
            message: "Message sent to 2nd line support",
            data: result,
          }),
        });
      });
    });

    req.on("error", (e) => {
      reject({
        statusCode: 500,
        body: JSON.stringify({
          message: "Failed to send message",
          error: e.message,
        }),
      });
    });

    req.write(postData);
    req.end();
  });
}
