import { Router } from "express";
import healthRouter from "./health.js";
import adminRouter from "./admin.js";
import booksRouter from "./books.js";
import categoriesRouter from "./categories.js";
import aboutRouter from "./about.js";
import milestonesRouter from "./milestones.js";
import testimonialsRouter from "./testimonials.js";
import messagesRouter from "./messages.js";
import contactRouter from "./contact.js";
import settingsRouter from "./settings.js";
import uploadRouter from "./upload.js";
import ordersRouter from "./orders.js";
import couponsRouter from "./coupons.js";
import deliveryRouter from "./delivery.js";

const router = Router();

router.use(healthRouter);
router.use(adminRouter);
router.use(booksRouter);
router.use(categoriesRouter);
router.use(aboutRouter);
router.use(milestonesRouter);
router.use(testimonialsRouter);
router.use(messagesRouter);
router.use(contactRouter);
router.use(settingsRouter);
router.use(uploadRouter);
router.use(ordersRouter);
router.use(couponsRouter);
router.use(deliveryRouter);

export default router;
