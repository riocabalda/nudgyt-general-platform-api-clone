import Avatar from '../models/avatar.model';

async function insertAvatars() {
  await Avatar.deleteMany({});

  await Avatar.insertMany([
    {
      id: 1,
      image_path:
        'https://umbra-digital.sgp1.digitaloceanspaces.com/nudgyt-general-platform/avatars/1740035918701_3244a365-8b06-4e04-a600-0a16fb58f200.png',
      gender: 'Male',
      mesh_id: '001'
    },
    {
      id: 2,
      image_path:
        'https://umbra-digital.sgp1.digitaloceanspaces.com/nudgyt-general-platform/avatars/1740035963415_f81bb027-9c3c-4827-82b3-bfa0373a596c.png',
      gender: 'Female',
      mesh_id: '002'
    },
    {
      id: 3,
      image_path:
        'https://umbra-digital.sgp1.digitaloceanspaces.com/nudgyt-general-platform/avatars/1740035976785_d8c4036a-b415-4151-8dc9-a3051950f0a2.png',
      gender: 'Female',
      mesh_id: '003'
    },
    {
      id: 4,
      image_path:
        'https://umbra-digital.sgp1.digitaloceanspaces.com/nudgyt-general-platform/avatars/1740035989122_fb55d0b8-a03f-4c11-80ed-3df49aa5cf51.png',
      gender: 'Male',
      mesh_id: '004'
    }
  ]);
}

async function seedAvatar() {
  try {
    console.log('Seeding Avatars...');

    await Promise.all([insertAvatars()]);

    console.log('Avatars seeded.');
  } catch (error) {
    throw new Error(`Error seeding Avatars: ${error}`);
  }
}

export default seedAvatar;
