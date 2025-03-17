import express from 'express';
import simulationController from '../../controllers/admin/simulation.controller';
import simulationValidation from '../../validations/simulation.validation';
import requirePermissions from '../../middlewares/require-permissions';
const router = express.Router({ mergeParams: true });

router.post(
  '/start',
  simulationValidation.startSimulation,
  simulationController.startSimulation
);
router.get(
  '/previous-attempts',
  requirePermissions(['Simulation.View']),
  simulationValidation.getPreviousAttemptSimulations,
  simulationController.getPreviousAttemptSimulations
);
router.get(
  '/:simulationId/service-details',
  requirePermissions(['Simulation.View']),
  simulationController.getSimulationServiceDetails
);
router.get(
  '/:simulationId/dates',
  requirePermissions(['Simulation.View']),
  simulationController.getSimulationDates
);
router.get(
  '/:simulationId/details',
  requirePermissions(['Simulation.View']),
  simulationController.getSimulationDetails
);
router.get(
  '/:simulationId/soft-skills',
  requirePermissions(['Simulation.View']),
  simulationController.getSimulationSoftSkills
);
router.get(
  '/:id',
  requirePermissions(['Simulation.View']),
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
router.get('/:id/ping', simulationController.pingSimulation);

export default router;
