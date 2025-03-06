import { random as randomNumber, sample as randomSample } from 'lodash';
import { encryptFieldData } from '../helpers/db';
import Enterprise from '../models/enterprise.model';
import { OrganizationStatus } from '../models/organization.model';

async function insertManyEnterprises(ct = 32) {
  const promises = Array.from({ length: ct }, async (_, idx) => {
    const num = idx + 1;
    const name = `Company ${num}`;
    const email = `owner@company${num}.com`;
    const url = `https://company${num}.com`;
    const monthlyAmount = randomNumber(1000, 10000);
    const userSeats = randomNumber(10, 100);
    const status = randomSample(Object.values(OrganizationStatus));

    const doc = new Enterprise({
      organization_name: encryptFieldData(name),
      email: encryptFieldData(email),
      platform_url: encryptFieldData(url),
      monthly_amount: monthlyAmount,
      user_seats: userSeats,
      status
    });

    await doc.save();
  });

  await Promise.all(promises);
}

async function seedSampleEnterprises() {
  try {
    console.log('Seeding Sample Enterprises...');

    await Promise.all([insertManyEnterprises()]);

    console.log('Sample Enterprises seeded.');
  } catch (error) {
    throw new Error(`Error seeding Sample Enterprises: ${error}`);
  }
}

export default seedSampleEnterprises;
