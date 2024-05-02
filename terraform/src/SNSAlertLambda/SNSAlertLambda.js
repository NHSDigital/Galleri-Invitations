export async function handler(event) {
  console.log("Received event:", JSON.stringify(event, null, 2));

  const message = JSON.parse(event.Records[0].Sns.Message);
  const alarmName = message.AlarmName;
  const newState = message.NewStateValue;
  const reason = message.NewStateReason;
  const description = message.AlarmDescription;

  const url = process.env.url;
  const data = {
    type: "AdaptiveCard",
    version: "1.2",
    body: {
      type: "TextBlock",
      text: `Galleri alarm test! \n${alarmName}\n${newState}\n${reason},${description}`,
    },
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const responseData = await response.json();
    console.log("Success:", responseData);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Request successful!",
        data: responseData,
      }),
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Error making HTTP request",
        error: error.message,
      }),
    };
  }
}
