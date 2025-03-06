import asyncWrapper from '../../helpers/async-wrapper';
import settingService from '../../services/admin/setting.service';
import createResponse from '../../utils/create-response';

const updateCompanyDetails = asyncWrapper(async (req, res, next) => {
  const { id } = req.params;
  const details = req.body;

  const companyDetails = await settingService.updateCompanyDetails({
    id,
    details
  });

  const response = createResponse({ data: companyDetails });
  res.json(response);
});

const transferCompany = asyncWrapper(async (req, res, next) => {
  const { id } = req.params;
  const newId = req.body;

  const newCompanyOwner = await settingService.transferCompany({
    id,
    newId
  });

  const response = createResponse({ data: newCompanyOwner });
  res.json(response);
});

export default {
  updateCompanyDetails,
  transferCompany
};
