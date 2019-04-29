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
    // console.log("interpreted message:", message);
    const period = message.entities.period[0].value;
    const emissions = await TravelLogic.getPeriodEmissions(this.userId, period!);
    this.state.total = emissions.total;
    this.state.offsetAmount = emissions.emissions.offset;
    this.state.notOffsetAmount = this.state.total! - this.state.offsetAmount!;
    this.state.trees = co2ToTrees(this.state.notOffsetAmount);
    await BotLogic.callSendAPI(this.userId, `you have emitted ${formatCo2(emissions.total)}kg of CO2, and you have offset ${formatCo2(emissions.offset)}g of CO2 this ${period}.`);
    if (this.state.trees >= 10) {
      await BotLogic.callSendAPI(this.userId, `Planting ${this.state.trees} trees would offset the remaining carbon footprint. Would you like to offset it?`);
      await this.store();
    } else {
      await this.finalize();
    }
  }

  public async store() {
    const db = bot.mongo.db("environment");
    await db.collection("flows").insertOne({
      type: "query",
      userId: this.userId,
      state: {
        total: this.state.total,
        offsetAmount: this.state.offsetAmount,
        notOffsetAmount: this.state.notOffsetAmount,
        trees: this.state.trees,
      },
    });
  }

  public async finalize() {
    const db = bot.mongo.db("environment");
    await db.collection("flows").deleteMany({
      userId: this.userId,
    });
  }

}
