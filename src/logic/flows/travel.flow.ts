import rp = require("request-promise");
import { Flow } from "../../models/flow.model";
import { EmissionsLogic } from "../emissions.logic";
import { BotLogic } from "../bot.logic";
import { bot } from "../../bot";
import { TravelLogic } from "../travel.logic";

export interface TravelState {
  origin?: string;
  destination?: string;
  distance?: number;
  co2?: number;
  vehicle?: string;
}

export class TravelFlow implements Flow {

  public userId: string;
  public state: TravelState;

  constructor(userId: string, state?: TravelState ) {
    console.log(`new travel flow for user ${userId}`);
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
    if (message.entities.origin) {
      console.log("add origin");
      this.state.origin = message.entities.origin[0].value;
    }
    if (message.entities.destination) {
      console.log("add destination");
      this.state.destination = message.entities.destination[0].value;
    }
    if (message.entities.vehicle) {
      console.log("add vehicle", message.entities.vehicle[0].value);
      this.state.vehicle = message.entities.vehicle[0].value;
    }
    if (this.isCompleted()) {
      await this.complete();
      await this.finalize();
    } else {
      await this.continue();
      await this.store();
    }
  }

  public async store() {
    const db = bot.mongo.db("environment");
    await db.collection("flows").insertOne({
      type: "travel",
      userId: this.userId,
      state: {
        origin: this.state.origin,
        destination: this.state.destination,
        distance: this.state.distance,
        co2: this.state.distance,
        vehicle: this.state.vehicle,
      },
    });
  }

  public async finalize() {
    const db = bot.mongo.db("environment");
    await db.collection("flows").deleteMany({
      userId: this.userId,
    });
  }

  private isCompleted() {
    console.log("state:", this.state);
    return this.state.origin && this.state.destination && this.state.vehicle;
  }

  private async complete() {
    const distance = await EmissionsLogic.getDistance(this.state.origin, this.state.destination);
    const co2 = EmissionsLogic.getCo2FromDistanceAndVehicle(distance, this.state.vehicle!);
    await BotLogic.callSendAPI(this.userId, `you traveled from ${this.state.origin} to ${this.state.destination}, by ${this.state.vehicle}, with a distance of ${distance} km, which emitted ${co2}g of co2 into the atmosphere`);
    await TravelLogic.storeTravel({
      timestamp: Date.now(),
      origin: this.state.origin!,
      destination: this.state.destination!,
      distance,
      co2,
      vehicle: this.state.vehicle!,
    });
  }

  private async continue() {
    if (!this.state.vehicle) {
      await BotLogic.callSendAPI(this.userId, `what vehicle did you travel with?`);
    }
  }

}