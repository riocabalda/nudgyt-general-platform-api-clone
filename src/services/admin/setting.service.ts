async function updateCompanyDetails({
  id,
  details
}: {
  id: string;
  details: string;
}) {
  return 'Company Details Updated';
}

async function transferCompany({
  id,
  newId
}: {
  id: string;
  newId: string;
}) {
  return 'Company Transferred';
}

export default {
  updateCompanyDetails,
  transferCompany
};
