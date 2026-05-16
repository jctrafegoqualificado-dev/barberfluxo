const EVOLUTION_API_URL = "https://api.joaocostaestrategiaeads.com.br";
const EVOLUTION_GLOBAL_API_KEY = "9bc68472cb2b87a182e1c39d72a9b47870ba8b34669822b78bec791cca5b9f6e";
const instanceName = "cm3fz1n1w0004y6bshj3fve1v-barberfluxo";

async function main() {
  const res = await fetch(`${EVOLUTION_API_URL}/webhook/find/${instanceName}`, {
    headers: {
      "apikey": EVOLUTION_GLOBAL_API_KEY
    }
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error);
