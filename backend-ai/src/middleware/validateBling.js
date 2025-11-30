import { body, query, validationResult } from "express-validator";
import { ValidationError } from "../utils/errors.js";

const handleErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError(
      errors
        .array()
        .map((err) => err.msg)
        .join(", ")
    );
  }
  next();
};

export const validateBlingCategoryList = [
  query("parentId")
    .optional()
    .isInt({ min: 0 })
    .withMessage("parentId deve ser um número inteiro"),
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("page deve ser >= 1"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 200 })
    .withMessage("limit deve estar entre 1 e 200"),
  handleErrors,
];

export const validateBlingMappingUpsert = [
  body("storeId").notEmpty().withMessage("storeId é obrigatório"),
  body("blingCategoryId")
    .isInt({ min: 1 })
    .withMessage("blingCategoryId deve ser inteiro"),
  body("shopeeCategoryId")
    .notEmpty()
    .withMessage("shopeeCategoryId é obrigatório"),
  body("descricao")
    .optional()
    .isLength({ max: 255 })
    .withMessage("descricao deve ter no máximo 255 caracteres"),
  handleErrors,
];

export const validateBlingMappingDelete = [
  body("storeId").notEmpty().withMessage("storeId é obrigatório"),
  body("blingCategoryId")
    .isInt({ min: 1 })
    .withMessage("blingCategoryId deve ser inteiro"),
  body("shopeeCategoryId")
    .optional()
    .isString()
    .withMessage("shopeeCategoryId deve ser string"),
  handleErrors,
];

export const validateBlingSync = [
  body("storeId")
    .optional()
    .isString()
    .withMessage("storeId deve ser uma string"),
  handleErrors,
];


