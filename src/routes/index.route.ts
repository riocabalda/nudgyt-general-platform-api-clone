import { Application } from 'express';
import createHttpError from 'http-errors';
import authenticate from '../middlewares/authenticate';
import adminAvatarRoute from './admin/avatar.route';
import adminCharacterRoute from './admin/character.route';
import adminEnvironmentRoute from './admin/environmet.route';
import adminLogRoute from './admin/log.route';
import adminOrganizationRoute from './admin/organization.route';
import adminServiceRoute from './admin/service.route';
import adminSettingRoute from './admin/setting.route';
import adminSimulationRoute from './admin/simulation.route';
import adminSubscriptionRoute from './admin/subscription.route';
import adminSurveyRoute from './admin/survey.route';
import adminTemplateRoute from './admin/template.route';
import adminTranscriptRoute from './admin/transcript.route';
import adminUserRoute from './admin/user.route';
import authRouter from './auth.route';
import learnerCharacterRoute from './learner/character.route';
import learnerPlanRoute from './learner/plan.route';
import learnerServiceRoute from './learner/service.route';
import learnerSimulationRoute from './learner/simulation.route';
import learnerSurveyRoute from './learner/survey.route';
import learnerTranscriptRoute from './learner/transcript.route';
import learnerUserRoute from './learner/user.route';
import organizationRoute from './organization.route';
import trainerAvatarRoute from './trainer/avatar.route';
import trainerCharacterRoute from './trainer/character.route';
import trainerEnvironmentRoute from './trainer/environment.route';
import trainerServiceRoute from './trainer/service.route';
import trainerSimulationRoute from './trainer/simulation.route';
import trainerSurveyRoute from './trainer/survey.route';
import trainerTemplateRoute from './trainer/template.route';
import trainerTranscriptRoute from './trainer/transcript.route';
import trainerUserRoute from './trainer/user.route';

const routes = (app: Application) => {
  // Common routes
  app.use(authenticate);

  // Auth routes
  app.use('/api/auth', authRouter);

  // Organization routes
  app.use('/api/:org', organizationRoute);

  // Admin routes
  app.use('/api/:org/admin/users', adminUserRoute);
  app.use('/api/:org/admin/settings', adminSettingRoute);
  app.use('/api/:org/admin/logs', adminLogRoute);
  app.use('/api/:org/admin/organizations', adminOrganizationRoute);
  app.use('/api/:org/admin/subscriptions', adminSubscriptionRoute);
  app.use('/api/:org/admin/services', adminServiceRoute);
  app.use('/api/:org/admin/characters', adminCharacterRoute);
  app.use('/api/:org/admin/avatars', adminAvatarRoute);
  app.use('/api/:org/admin/templates', adminTemplateRoute);
  app.use('/api/:org/admin/environments', adminEnvironmentRoute);
  app.use('/api/:org/admin/simulations', adminSimulationRoute);
  app.use('/api/:org/admin/transcripts', adminTranscriptRoute);
  app.use('/api/:org/admin/surveys', adminSurveyRoute);

  // Trainer routes
  app.use('/api/:org/trainer/users', trainerUserRoute);
  app.use('/api/:org/trainer/characters', trainerCharacterRoute);
  app.use('/api/:org/trainer/templates', trainerTemplateRoute);
  app.use('/api/:org/trainer/services', trainerServiceRoute);
  app.use('/api/:org/trainer/simulations', trainerSimulationRoute);
  app.use('/api/:org/trainer/transcripts', trainerTranscriptRoute);
  app.use('/api/:org/trainer/avatars', trainerAvatarRoute);
  app.use('/api/:org/trainer/environments', trainerEnvironmentRoute);
  app.use('/api/:org/trainer/surveys', trainerSurveyRoute);

  // Learner routes
  app.use('/api/:org/learner/users', learnerUserRoute);
  app.use('/api/:org/learner/plans', learnerPlanRoute);
  app.use('/api/:org/learner/characters', learnerCharacterRoute);
  app.use('/api/:org/learner/services', learnerServiceRoute);
  app.use('/api/:org/learner/transcripts', learnerTranscriptRoute);
  app.use('/api/:org/learner/simulations', learnerSimulationRoute);
  app.use('/api/:org/learner/surveys', learnerSurveyRoute);

  app.use((req, res, next) => {
    next(createHttpError.NotFound());
  });
};

export default routes;
