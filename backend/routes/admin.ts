import express from 'express';
const router = express.Router();

router.use("/", require("./admin-settings"));
router.use("/roles", require("./admin-roles"));
router.use("/users", require("./admin-users"));
router.use("/vets", require("./admin-vets"));
router.use("/", require("./admin-pets"));
router.use("/comments", require("./admin-comments"));
router.use("/sms", require("./admin-sms"));

export = router;
