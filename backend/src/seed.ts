import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Crear configuración por defecto
  await prisma.settings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      mediastreamApiUrl: 'https://platform.mediastre.am',
    },
  });

  // Crear templates de ejemplo
  const youtubeTemplate = await prisma.template.upsert({
    where: { id: 'template-youtube' },
    update: {},
    create: {
      id: 'template-youtube',
      name: 'YouTube Export',
      description: 'Template para importar desde export de YouTube',
      strategy: 'transcode',
      mappings: JSON.stringify([
        { mapper: 'id', field: 'video_id' },
        { mapper: 'title', field: 'title' },
        { mapper: 'original', field: 'url' },
        { mapper: 'description', field: 'description' },
        { mapper: 'tag', field: 'tags', options: { separator: ',' } },
        { mapper: 'thumb', field: 'thumbnail' },
      ]),
      expectedHeaders: JSON.stringify([
        'video_id',
        'title',
        'url',
        'description',
        'tags',
        'thumbnail',
      ]),
    },
  });

  const vimeoTemplate = await prisma.template.upsert({
    where: { id: 'template-vimeo' },
    update: {},
    create: {
      id: 'template-vimeo',
      name: 'Vimeo Export',
      description: 'Template para importar desde export de Vimeo',
      strategy: 'transcode',
      mappings: JSON.stringify([
        { mapper: 'id', field: 'id' },
        { mapper: 'title', field: 'name' },
        { mapper: 'original', field: 'link' },
        { mapper: 'description', field: 'description' },
      ]),
      expectedHeaders: JSON.stringify(['id', 'name', 'link', 'description']),
    },
  });

  const seriesTemplate = await prisma.template.upsert({
    where: { id: 'template-series' },
    update: {},
    create: {
      id: 'template-series',
      name: 'Series con Temporadas',
      description: 'Template para series con estructura de temporadas y episodios',
      strategy: 'transcode',
      mappings: JSON.stringify([
        { mapper: 'id', field: 'video_id' },
        { mapper: 'title', field: 'title' },
        { mapper: 'original', field: 'url' },
        { mapper: 'description', field: 'description' },
        { mapper: 'show', field: 'show_name' },
        { mapper: 'showSeason', field: 'season_number' },
        { mapper: 'showSeasonEpisode', field: 'episode_number' },
        { mapper: 'category', field: 'category' },
      ]),
      expectedHeaders: JSON.stringify([
        'video_id',
        'title',
        'url',
        'description',
        'show_name',
        'season_number',
        'episode_number',
        'category',
      ]),
    },
  });

  console.log('Created templates:', {
    youtube: youtubeTemplate.name,
    vimeo: vimeoTemplate.name,
    series: seriesTemplate.name,
  });

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
