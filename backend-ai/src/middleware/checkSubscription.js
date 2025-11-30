import { ForbiddenError } from "../utils/errors.js";
import logger from "../utils/logger.js";
// TODO: Import from precofacilmarket's DB connection
// import User from '../../models/User.js';

export async function checkSubscription(req, res, next) {
  try {
    const { user } = req;

    // TODO: Query precofacilmarket's database to check subscription
    // For now, we'll assume all authenticated users are subscribers
    // In production, check actual subscription status

    /*
    const userRecord = await User.findById(user.id);
    
    if (!userRecord || !userRecord.subscription || !userRecord.subscription.active) {
      throw new ForbiddenError('Assinatura inativa. Assine o precofacilmarket para usar o Claudioia.');
    }
    */

    // For MVP, mark as subscribed
    req.user.isSubscriber = true;
    req.user.subscriptionLevel = "premium";

    logger.info(
      `Subscription checked for user: ${user.id} - Active: ${req.user.isSubscriber}`
    );
    next();
  } catch (error) {
    next(error);
  }
}




















