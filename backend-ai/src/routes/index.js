import express from "express";
import aiRoutes from "./ai.routes.js";

const router = express.Router();

router.use("/ai", aiRoutes);

export default router;





