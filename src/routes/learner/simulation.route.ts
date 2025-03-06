import express from 'express';
import simulationController from '../../controllers/learner/simulation.controller';
import requirePermissions from '../../middlewares/require-permissions';
import simulationValidation from '../../validations/simulation.validation';

const router = express.Router({ mergeParams: true });

router.post(
  '/start',
  requirePermissions(['CREATE_SIMULATIONS']),
  simulationValidation.startSimulation,
  simulationController.startSimulation
);
router.get(
  '/:simulationId/service-details',
  simulationController.getSimulationServiceDetails
);
router.get(
  '/previous-attempts',
  simulationValidation.getPreviousAttemptSimulations,
  simulationController.getPreviousAttemptSimulations
);
router.get('/ping', simulationController.pingSimulation);
router.get(
  '/:simulationId/dates',
  simulationController.getSimulationDates
);
router.get(
  '/:simulationId/details',
  simulationController.getSimulationDetails
);
router.get(
  '/:simulationId/soft-skills',
  simulationController.getSimulationSoftSkills
);
router.get(
  '/:id',
  simulationValidation.getSimulationById,
  simulationController.getSimulationById
);
router.patch(
  '/:id/form-answers',
  simulationValidation.updateFormAnswers,
  simulationController.updateFormAnswers
);
router.patch(
  '/:id/stop',
  requirePermissions(['CREATE_SIMULATIONS']),
  simulationValidation.stopSimulation,
  simulationController.stopSimulation
);
router.patch(
  '/:id/resume',
  simulationValidation.resumeSimulation,
  simulationController.resumeSimulation
);
router.patch(
  '/:id/pause',
  simulationValidation.pauseSimulation,
  simulationController.pauseSimulation
);

export default router;
