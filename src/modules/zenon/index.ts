import { Composer } from "grammy";
import type { BotContext } from "../../context.js";

import walletHandler from "./wallet.handler.js";
import networkHandler from "./network.handler.js";
import tokenHandler from "./token.handler.js";
import pillarHandler from "./pillar.handler.js";
import stakeHandler from "./stake.handler.js";
import plasmaHandler from "./plasma.handler.js";
import sendHandler from "./send.handler.js";
import bridgeHandler from "./bridge.handler.js";
import htlcHandler from "./htlc.handler.js";
import acceleratorHandler from "./accelerator.handler.js";
import subscriptionHandler from "./subscription.handler.js";
import gatingHandler from "./gating.handler.js";

const composer = new Composer<BotContext>();

// Register all Zenon handlers
composer.use(walletHandler);
composer.use(networkHandler);
composer.use(tokenHandler);
composer.use(pillarHandler);
composer.use(stakeHandler);
composer.use(plasmaHandler);
composer.use(sendHandler);
composer.use(bridgeHandler);
composer.use(htlcHandler);
composer.use(acceleratorHandler);
composer.use(subscriptionHandler);
composer.use(gatingHandler);

export default composer;
