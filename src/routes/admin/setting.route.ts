import express from 'express';
import settingController from '../../controllers/admin/setting.controller';

const router = express.Router();

router.patch(
  '/:id/company-details',
  settingController.updateCompanyDetails
);

router.patch(
  '/:id/transfer-company',
  settingController.transferCompany
);

export default router;
