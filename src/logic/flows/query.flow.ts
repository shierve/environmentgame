import { Flow } from "../../models/flow.model";
import { BotLogic } from "../bot.logic";
import { bot } from "../../bot";
import { TravelLogic } from "../travel.logic";
import { formatCo2 } from "../helpers/format.helpers";
import { co2ToTrees } from "../helpers/emissions.helpers";

export interface QueryState {
  total?: number;
  offsetAmount?: number;
  notOffsetAmount?: number;
  trees?: number;
}

export class QueryFlow implements Flow {

  public userId: string;
  public state: QueryState;

  constructor(userId: string, state?: QueryState ) {
    console.log(`new query flow for user ${userId}`);
    this.userId = userId;
    if (state) {
      this.state = state;
    } else {
      this.state = {};
    }
  }

  // Handles message events processed by wit
  public async process(message) {
    if (this.state.trees) {
      if (message.entities.agree && message.entities.agree[0].value === "yes") {
        await this.finalize();
        return;
      } else {
        await this.finalize();
        return;
      }
    }
    // console.log("interpreted message:", message);
    const period = message.entities.period[0].value;
    const emissions = await TravelLogic.getPeriodEmissions(this.userId, period!);
    const offsets = await TravelLogic.getOffsetEmissions(this.userId, period!);
    this.state.total = emissions;
    this.state.offsetAmount = offsets;
    this.state.notOffsetAmount = this.state.total! - this.state.offsetAmount!;
    this.state.trees = co2ToTrees(this.state.notOffsetAmount);
    await BotLogic.callSendAPI(this.userId, `this ${period} you have emitted ${formatCo2(emissions)}kg of CO2 💨, and you have offset ${formatCo2(offsets)}kg. 🌲`);
    if (this.state.trees >= 10) {
      await BotLogic.sendButton(this.userId, `Planting ${this.state.trees} trees would offset the remaining carbon footprint for the ${period}. Would you like to offset it?`, "https://carbonfund.org/product/general-donation/", "Offset!");
      await this.store();
    } else {
      await this.finalize();
    }
  }

  public async store() {
    const db = bot.mongo.db("environment");
    await db.collection("flows").updateOne({userId: this.userId}, {$set: {
      type: "query",
      userId: this.userId,
      state: this.state,
    }}, {upsert: true});
  }

  public async finalize() {
    const db = bot.mongo.db("environment");
    await db.collection("flows").deleteMany({
      userId: this.userId,
    });
  }

}
