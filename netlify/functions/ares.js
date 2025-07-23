exports.handler = async function(event) {
  const { ico } = event.queryStringParameters;
  if (!ico) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Chybí IČO' }) };
  }

  const aresUrl = `https://ares.gov.cz/ekonomicke-subjekty-v-ares/vysledky?ico=${ico}&pocet=1`;

  try {
    const response = await fetch(aresUrl);
    const data = await response.json();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Chyba při volání ARES' }) };
  }
};