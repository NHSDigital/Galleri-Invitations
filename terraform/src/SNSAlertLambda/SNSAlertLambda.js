export async function handler(event) {
  console.log("Received event:", JSON.stringify(event, null, 2));

  try {
    const message = JSON.parse(event.Records[0].Sns.Message);

    // Validate required fields
    if (
      !message.AlarmName ||
      !message.NewStateValue ||
      !message.NewStateReason ||
      !message.AlarmDescription
    ) {
      throw new Error("Error: Invalid input, Missing required fields", message);
    }

    const alarmName = message.AlarmName;
    const newState = message.NewStateValue;
    const reason = message.NewStateReason;
    const description = message.AlarmDescription;

    const url = process.env.url;
    if (!url) {
      throw new Error(
        "Error: Invalid input, URL is not set in environment variables",
        message.url
      );
    }

    const data = {
      type: "AdaptiveCard",
      version: "1.2",
      body: {
        type: "TextBlock",
        text: `Galleri alarm test! \n${alarmName}\n${newState}\n${reason},${description}`,
      },
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Error: HTTP error! status: ${response.status}`);
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
    console.error("Error:", error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Error making HTTP request",
        error: `Error: ${error.message}`,
      }),
    };
  }
}
