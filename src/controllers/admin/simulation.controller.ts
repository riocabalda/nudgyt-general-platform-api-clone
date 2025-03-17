import asyncWrapper from '../../helpers/async-wrapper';
import createResponse from '../../utils/create-response';
import simulationService from '../../services/admin/simulation.service';

const startSimulation = asyncWrapper(async (req, res, next) => {
  const { payloadIds } = req.body;

  const newSimulation = await simulationService.startSimulation(
    payloadIds,
    req.user.id
  );

  const response = createResponse({ data: newSimulation });

  res.json(response);
});

const resumeSimulation = asyncWrapper(async (req, res, next) => {
  const { id } = req.params;

  const updatedSimulation =
    await simulationService.resumeSimulationTime(id);

  const response = createResponse({ data: updatedSimulation });
  res.json(response);
});

const pauseSimulation = asyncWrapper(async (req, res, next) => {
  const { id } = req.params;

  const updatedSimulation = await simulationService.pauseSimulationTime(
    id
  );

  const response = createResponse({ data: updatedSimulation });
  res.json(response);
});

const stopSimulation = asyncWrapper(async (req, res, next) => {
  const { id } = req.params;
  const { formAnswers } = req.body;

  const updatedSimulation = await simulationService.stopSimulation(
    id,
    formAnswers
  );

  const response = createResponse(updatedSimulation);
  res.json(response);
});

const updateFormAnswers = asyncWrapper(async (req, res) => {
  const simulationId = req.params.id;
  const { formAnswers } = req.body;

  const updatedFormAnswers = await simulationService.updateFormAnswers(
    simulationId,
    formAnswers
  );

  const response = createResponse(updatedFormAnswers);

  res.json(response);
});

const getSimulationById = asyncWrapper(async (req, res, next) => {
  const simulationId = req.params.id;
  const userId = req.user.id;

  const simulation = await simulationService.getSimulationById({
    simulationId,
    userId
  });

  const response = createResponse({ data: simulation });

  res.json(response);
});

const getSimulationServiceDetails = asyncWrapper(
  async (req, res, next) => {
    const { simulationId, org } = req.params;

    const serviceDetails =
      await simulationService.getSimulationServiceDetails({
        simulationId,
        orgSlug: org
      });

    const response = createResponse({
      data: serviceDetails
    });
    res.json(response);
  }
);

const getSimulationDates = asyncWrapper(async (req, res, next) => {
  const { simulationId, org } = req.params;

  const simulationDates = await simulationService.getSimulationDates({
    simulationId,
    orgSlug: org
  });

  const response = createResponse({
    data: simulationDates
  });
  res.json(response);
});

const getSimulationDetails = asyncWrapper(async (req, res, next) => {
  const { simulationId, org } = req.params;

  const simulationDetails =
    await simulationService.getSimulationDetails({
      simulationId,
      orgSlug: org
    });

  const response = createResponse({
    data: simulationDetails
  });
  res.json(response);
});

const getSimulationSoftSkills = asyncWrapper(async (req, res, next) => {
  const { simulationId, org } = req.params;

  const softSkills = await simulationService.getSimulationSoftSkills({
    simulationId,
    orgSlug: org
  });

  const response = createResponse({
    data: softSkills
  });
  res.json(response);
});

const getPreviousAttemptSimulations = asyncWrapper(
  async (req, res, next) => {
    const {
      page,
      service_id: serviceId,
      includeOngoing
    } = req.query as {
      page: string;
      service_id: string;
      includeOngoing: any;
    };

    const previousAttempts =
      await simulationService.getPreviousAttemptSimulations(
        req.user.id,
        page,
        serviceId,
        includeOngoing
      );
    res.json(previousAttempts);
  }
);

const pingSimulation = asyncWrapper(async (req, res, next) => {
  res.send('Pong');
});

export default {
  startSimulation,
  resumeSimulation,
  pauseSimulation,
  stopSimulation,
  updateFormAnswers,
  getSimulationById,
  getSimulationServiceDetails,
  getSimulationDates,
  getSimulationDetails,
  getSimulationSoftSkills,
  getPreviousAttemptSimulations,
  pingSimulation
};
