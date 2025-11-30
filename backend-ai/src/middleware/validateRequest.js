import { validationResult } from "express-validator";
import { ValidationError } from "../utils/errors.js";

export function validateRequest(req, res, next) {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map((err) => err.msg);
    throw new ValidationError(errorMessages.join(", "));
  }

  next();
}




















