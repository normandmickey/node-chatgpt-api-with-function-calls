const { Configuration, OpenAIApi } = require("openai");
const readlineSync = require("readline-sync");
require("dotenv").config();
const axios = require("axios");    // For making HTTP requests.
const moment = require("moment-timezone");


(async () => {
  const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
  });
  const openai = new OpenAIApi(configuration);


// Define a function called lookupTime that takes a location as a parameter and returns the current time in that location. 
// The function makes a GET request to the World Time API, extracts the current time from the response, and formats it.
async function lookupTime(location) {
    try {
        const response = await axios.get(`http://worldtimeapi.org/api/timezone/${location}`); // Make a GET request to the World Time API with the location parameter as the timezone.
        const { datetime } = response.data;    // Extract the datetime property from the data in the response.
        const dateTime = moment.tz(datetime, location).format("h:mmA"); // Use moment-timezone to create the Date object in the specified timezone.
        const timeResponse = `The current time in ${location} is ${dateTime}.`; // Log the formatted time to the console.
        return timeResponse;
    } catch (error) {
        console.error(error);    // Log any errors that occur to the console.
    }
}

// Define a function called sendEmail 
async function sendEmail(to, from, subject, text) {
  const sgMail = require('@sendgrid/mail')
  sgMail.setApiKey(process.env.SENDGRID_API_KEY)
  const sendGMsg = ""
  const msg = {
    to: to, // Change to your recipient
    from: from, // Change to your verified sender
    subject: subject, 
    text: text //body of the email
  }
  sgMail
    .send(msg)
    .then(() => {
      // console.log('Email sent')
      const sendGMsg = "Email Sent";
    })
    .catch((error) => {
      //console.error(error)
      const sendGMsg = "message not sent";
  })
  return sendGMsg;
}

// Define a function called lookupWeather that takes a location as a parameter and returns the weather forecatst in that location. 
// The function makes a GET request to the WeatherAPI API, extracts the current temperature from the response, and formats it.
async function lookupWeather(location) {

  const options = {
    method: 'GET',
    url: 'https://weatherapi-com.p.rapidapi.com/forecast.json',
    params: {
      q: location,
      days: '3'
    },
    headers: {
      'X-RapidAPI-Key': process.env.X_RAPIDAPI_KEY,
    '  X-RapidAPI-Host': 'weatherapi-com.p.rapidapi.com'
    }
  };

  try {
	  const response = await axios.request(options);
	  //console.log(response.data);
    let weather = response.data;
    //const currentTemp = weather.current.temp_f;
    //console.log(currentTemp);
    const weatherForecast = `Location: ${weather.location.name} \
    Current Temperature: ${weather.current.temp_f} \
    Condition: ${weather.current.condition.text}. \
    Low Today: ${weather.forecast.forecastday[0].day.mintemp_f} \
    High Today: ${weather.forecast.forecastday[0].day.maxtemp_f}`;
    return weatherForecast;
  } catch (error) {
	  console.error(error);
    return "No forecast found";
  }
}

  const history = [];

  while (true) {
    const user_input = readlineSync.question("Your input: ");
    const senderEmail = process.env.SENDER_EMAIL;

    const messages = [];
    for (const [input_text, completion_text] of history) {
      messages.push({ role: "user", content: input_text });
      messages.push({ role: "assistant", content: completion_text });
    }

    messages.push({ role: "user", content: user_input });

    try {
      const completion = await openai.createChatCompletion({
        model: "gpt-3.5-turbo-0613",
        messages: messages,
        functions: [
            {
                name: "sendEmail",
                description: "send an email to specified address",
                parameters: {
                    type: "object", // specify that the parameter is an object
                    properties: {
                        to: {
                            type: "string", // specify the parameter type as a string
                            description: "The recipients email address."
                        },
                        from: {
                          type: "string", // specify the parameter type as a string
                          description: `The senders email address, default to ${senderEmail}`
                        },
                        subject: {
                          type: "string", // specify the parameter type as a string
                          description: "The subject of the email."
                        },
                        text: {
                          type: "string", // specify the parameter type as a string
                          description: "The text or body of the email message."
                        }
                    },
                    required: ["to","from","subject","text"] // specify that the location parameter is required
                }
            },
            {
              name: "lookupTime",
              description: "get the current time in a given location",
              parameters: {
                  type: "object", // specify that the parameter is an object
                  properties: {
                      location: {
                          type: "string", // specify the parameter type as a string
                          description: "The location, e.g. Beijing, China. But it should be written in a timezone name like Asia/Shanghai"
                      }
                  },
                  required: ["location"] // specify that the location parameter is required
              }
          },
            {
              name: "lookupWeather",
              description: "get the weather forecast in a given location",
              parameters: {
                  type: "object", // specify that the parameter is an object
                  properties: {
                      location: {
                          type: "string", // specify the parameter type as a string
                          description: "The location, e.g. Beijing, China. But it should be written in a city, state, country"
                      }
                  },
                  required: ["location"] // specify that the location parameter is required
              }
          }
        ],
        function_call: "auto"
      });
      
      // Extract the generated completion from the OpenAI API response.
      const completionResponse = completion.data.choices[0].message;
      //console.log(completionResponse);

      // if the response from ChatGPT does not have content, then it returned the JSON for one of the function calls. 
      // We then need to figure out which function it created then run it to get the appropriate API response. 
      if(!completionResponse.content) { 
        const functionCallName = completionResponse.function_call.name;
        //console.log("functionCallName: ", functionCallName);

        if(functionCallName === "lookupTime") {
            const completionArguments = JSON.parse(completionResponse.function_call.arguments);
            //console.log("completionArguments: ", completionArguments);

            const completion_text = await lookupTime(completionArguments.location);
            history.push([user_input, completion_text]);
            console.log(completion_text);
        } else if(functionCallName === "sendEmail") {
          const completionArguments = JSON.parse(completionResponse.function_call.arguments);
          // console.log("completionArguments: ", completionArguments);

          const completion_text = await sendEmail(completionArguments.to, completionArguments.from, completionArguments.subject, completionArguments.text);
          history.push([user_input, completion_text]);          
          console.log("Email sent: " + completionArguments.to + "\n" + "Subject: " + completionArguments.subject + "\n" + "Body: " + completionArguments.text);
        
        } else if(functionCallName === "lookupWeather") {
            const completionArguments = JSON.parse(completionResponse.function_call.arguments);
            //console.log("completionArguments: ", completionArguments);

            const completion_text = await lookupWeather(completionArguments.location);
            history.push([user_input, completion_text]);
            messages.push({ role: "user", content: "Summarize the following input." + completion_text });
            try {
              const completion = await openai.createChatCompletion({
                model: "gpt-3.5-turbo-0613",
                messages: messages
              });
              
              // Extract the generated completion from the OpenAI API response.
              const completionResponse = completion.data.choices[0].message.content;
              //console.log(messages);
              console.log(completionResponse);            
            } catch (error) {
              if (error.response) {
                console.log(error.response.status);
                console.log(error.response.data);
              } else {
                console.log(error.message);
              }n
            }
        }
    } else {
        const completion_text = completion.data.choices[0].message.content;
        history.push([user_input, completion_text]);
        console.log(completion_text);
      }

      const user_input_again = readlineSync.question(
        "\nWould you like to continue the conversation? (Y/N)"
      );
      if (user_input_again.toUpperCase() === "N") {
        return;
      } else if (user_input_again.toUpperCase() !== "Y") {
        console.log("Invalid input. Please enter 'Y' or 'N'.");
        return;
      }
    } catch (error) {
      if (error.response) {
        console.log(error.response.status);
        console.log(error.response.data);
      } else {
        console.log(error.message);
        console.log(messages);
      }
    }
  }
})();
