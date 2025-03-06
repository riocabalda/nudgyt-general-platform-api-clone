import express from 'express';
import environmentController from '../../controllers/trainer/environment.controller';

const router = express.Router({ mergeParams: true });

router.get('/', environmentController.getEnvironments);
router.get('/:id', environmentController.getEnvironmentById);

export default router;
