import express from 'express';
import logController from '../../controllers/admin/log.controller';
import requirePermissions from '../../middlewares/require-permissions';

const router = express.Router({ mergeParams: true });

router.get(
  '/',
  requirePermissions(['VIEW_LOGS']),
  logController.getLogs
);

export default router;
