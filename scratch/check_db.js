const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const barbershopId = 'cmo796fas0002la04zfmxl3al'; // Lord of Barba
  
  const appts = await prisma.appointment.findMany({
    where: { barbershopId, status: 'DONE' },
    select: { date: true }
  });

  const counts = {};
  for (const a of appts) {
    const d = new Date(a.date);
    const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    counts[monthStr] = (counts[monthStr] || 0) + 1;
  }

  console.log('Appointments by month for Lord of Barba:', counts);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
