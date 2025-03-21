import Environment from '../models/environment.model';

async function insertEnvironments() {
  await Environment.deleteMany({});

  await Environment.insertMany([
    {
      id: 1,
      environment_id: '000',
      image:
        'https://umbra-digital.sgp1.digitaloceanspaces.com/nudgyt-general-platform/environments/1740036269703_03692486-647c-440d-bf42-e0fed2ba9d42.png',
      location: 'Garden',
      description: 'Outside Garden with wall',
      available_characters: ['001', '002', '003', '004'],
      maximum_characters: 1
    },
    {
      id: 2,
      environment_id: '001',
      image:
        'https://umbra-digital.sgp1.digitaloceanspaces.com/nudgyt-general-platform/environments/1740036322212_ec6a163b-6e72-4f1d-8e50-89232734ec1f.png',
      location: 'Hospital',
      description: 'Hospital Room',
      available_characters: ['001', '002', '003', '004'],
      maximum_characters: 1
    },
    {
      id: 3,
      environment_id: '002',
      image:
        'https://umbra-digital.sgp1.digitaloceanspaces.com/nudgyt-general-platform/environments/1740036298272_22be569c-a6e9-4fd5-af95-ed06fe36bb7c.png',
      location: 'Grocery',
      description: 'Grocery Corridor with item in shelf',
      available_characters: ['001', '002', '003', '004'],
      maximum_characters: 1
    },
    {
      id: 4,
      environment_id: '003',
      image:
        'https://umbra-digital.sgp1.digitaloceanspaces.com/nudgyt-general-platform/environments/1740036117187_31e18ebb-0a91-4682-8559-9031ca74f8d1.png',
      location: 'Office Board Room',
      description: 'Simple Office Board Room',
      available_characters: ['001', '002', '003', '004'],
      maximum_characters: 1
    },
    {
      id: 5,
      environment_id: '004',
      image:
        'https://umbra-digital.sgp1.digitaloceanspaces.com/nudgyt-general-platform/environments/1740036134510_b9ab51f6-ab4b-4322-8a32-b28f9e0d2fcf.png',
      location: 'Hotel Hallway',
      description: 'Hotel Main Corridor',
      available_characters: ['001', '002', '003', '004'],
      maximum_characters: 1
    },
    {
      id: 6,
      environment_id: '005',
      image:
        'https://umbra-digital.sgp1.digitaloceanspaces.com/nudgyt-general-platform/environments/1740036235099_55ebb14a-6829-444b-92c3-5fd7ef79bc85.jpeg',
      location: 'Office Board Room 2',
      description: 'Another Office Board Room, generated by AI',
      available_characters: ['001', '002', '003', '004'],
      maximum_characters: 1
    },
    {
      id: 7,
      environment_id: '006',
      image:
        'https://umbra-digital.sgp1.digitaloceanspaces.com/nudgyt-general-platform/environments/1740036252506_84c65678-660c-4b54-8581-ee6c03e37606.png',
      location: 'Grocery 2',
      description: 'Small Grocery with selves',
      available_characters: ['001', '002', '003', '004'],
      maximum_characters: 1
    },
    {
      id: 8,
      environment_id: '007',
      image:
        'https://umbra-digital.sgp1.digitaloceanspaces.com/nudgyt-general-platform/environments/1740036215941_0336eb0d-886a-4107-a615-81d23a7d1867.png',
      location: 'Office Room',
      description: 'Simple Office Room with wall',
      available_characters: ['001', '002', '003', '004'],
      maximum_characters: 1
    }
  ]);
}

async function seedEnvironment() {
  try {
    console.log('Seeding Environment...');

    await Promise.all([insertEnvironments()]);

    console.log('Environment seeded.');
  } catch (error) {
    throw new Error(`Error seeding Environment: ${error}`);
  }
}

export default seedEnvironment;
