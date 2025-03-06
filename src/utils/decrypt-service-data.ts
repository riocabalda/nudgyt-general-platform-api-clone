import { decryptFieldData } from '../helpers/db';
import { ServiceType } from '../models/service.model';

function decryptServiceData(service: ServiceType) {
  const basicLevel = service.basic_level as any;
  const serviceCreator = service.creator as any;
  const serviceOrganization = service.organization as any;
  // Decrypt basic level creator data

  if (service.basic_level) {
    if (basicLevel.creator) {
      basicLevel.creator.full_name = decryptFieldData(
        basicLevel.creator.full_name
      );
      basicLevel.creator.email = decryptFieldData(
        basicLevel.creator.email
      );
    }
  }

  // Decrypt multi level creator data
  service.multi_level?.forEach((level: any) => {
    if (level.creator) {
      level.creator.full_name = decryptFieldData(
        level.creator.full_name
      );
      level.creator.email = decryptFieldData(level.creator.email);
    }
  });

  // Decrypt organizations data
  service.creator.organizations?.forEach((org: any) => {
    if (org.organization) {
      org.organization.name = decryptFieldData(org.organization.name);
      org.organization.slug = decryptFieldData(org.organization.slug);
    }
  });

  // Decrypt creator and organization data
  serviceCreator.full_name = decryptFieldData(
    service.creator.full_name
  );
  serviceCreator.email = decryptFieldData(service.creator.email);

  serviceOrganization.name = decryptFieldData(
    service.organization.name
  );
  serviceOrganization.slug = decryptFieldData(
    service.organization.slug
  );

  return service;
}

export default decryptServiceData;
