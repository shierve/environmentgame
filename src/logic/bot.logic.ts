import rp = require("request-promise");
import { NLPLogic } from "./nlp.logic";
import { FlowFactory } from "./flows/flow.factory";
import { strings } from "../constants";

export class BotLogic {

  // Handles messages events
  public static async processMessage(event) {
    const sender = event.sender.id;
    try {
      console.log(`received event: `, event);
      const wit = await NLPLogic.interpret(event.message.text);
      console.log("wit interpreted object:", wit);
      const intent = (wit.entities.intent) ? wit.entities.intent[0].value : "answer";
      const flow = await FlowFactory.getFlow(sender, intent);
      if (!flow) {
        await BotLogic.callSendAPI(sender, strings.error);
      }
      await flow.process(wit);
    } catch (err) {
      await BotLogic.callSendAPI(sender, strings.error);
      throw err;
    }

  }

  // Handles messaging_postbacks events
  public static async handlePostback(senderId, postback) {
    //
  }

  // Sends response messages via the Send API
  public static async callSendAPI(recipientId: string, message: string) {
    const headers = {
      "Content-Type": "application/json",
    };
    await rp({
      method: "POST",
      uri: "https://graph.facebook.com/v2.6/me/messages",
      body: {
        recipient: {
          id: recipientId,
        },
        message: {
          text: message,
        },
      },
      qs: {
        access_token: process.env.ACCESS_TOKEN,
      },
      headers,
      json: true,
    });
  }

  public static async sendButton(recipientId: string, topText: string, url: string, title: string) {
    const headers = {
      "Content-Type": "application/json",
    };
    await rp({
      method: "POST",
      uri: "https://graph.facebook.com/v2.6/me/messages",
      body: {
        recipient: {
          id: recipientId,
        },
        message: {
          attachment: {
            type: "template",
            payload: {
              template_type: "button",
              text: topText,
              buttons: [
                {
                  type: "web_url",
                  url,
                  title,
                  webview_height_ratio: "full",
                },
              ],
            },
          },
        },
      },
      qs: {
        access_token: process.env.ACCESS_TOKEN,
      },
      headers,
      json: true,
    });
  }

}
