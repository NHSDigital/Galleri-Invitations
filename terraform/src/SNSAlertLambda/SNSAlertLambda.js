export async function handler(event) {
  const url =
    "https://prod-08.uksouth.logic.azure.com:443/workflows/7edf4c6b99724691815d74a338b1146c/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=C6mpyBbevvm_sOZUHswhxplabaL34DqBjugX7oCY1UY";
  const data = {
    type: "AdaptiveCard",
    version: "1.2",
    body: {
      type: "TextBlock",
      text: "Galleri alarm test!",
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
