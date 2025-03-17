import ServiceType from '../models/service-type.model';

async function insertServiceTypes() {
  await ServiceType.deleteMany({});

  await ServiceType.insertMany([
    {
      id: 1,
      name: 'Basic',
      type: 'BASIC',
      description:
        'Create your first simulation by bringing AI characters with unique backstories to life for an immersive learning experience.'
    },
    {
      id: 2,
      name: 'Multi-level',
      type: 'MULTI-LEVEL',
      description:
        'Take it up a notch - characters remember past interactions and your choices shape what happens next as you progress through the levels.'
    },
    {
      id: 3,
      name: 'Custom',
      type: 'CUSTOM',
      description:
        'Got a big idea? Let’s build it together! Reach out to info@nudgyt.com for a custom simulation made just for you.'
    }
  ]);
}

async function seedServiceType() {
  try {
    console.log('Seeding Service Type...');

    await Promise.all([insertServiceTypes()]);

    console.log('Service Type seeded.');
  } catch (error) {
    throw new Error(`Error seeding Service Type: ${error}`);
  }
}

export default seedServiceType;
