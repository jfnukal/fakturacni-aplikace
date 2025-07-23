exports.handler = async function(event) {
  const { ico } = event.queryStringParameters;
  if (!ico) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Chybí IČO' }) };
  }

  const aresUrl = `https://ares.gov.cz/ekonomicke-subjekty-v-ares/vysledky?ico=${ico}&pocet=1`;

  try {
    const aresResponse = await fetch(aresUrl);

    // Klíčová kontrola: Zjistíme, jestli ARES odpověděl v pořádku (např. kódem 200 OK)
    if (!aresResponse.ok) {
      // Pokud ne, pošleme jeho chybový status dál i s textem
      return {
        statusCode: aresResponse.status,
        body: JSON.stringify({ error: `Server ARES odpověděl s chybou: ${aresResponse.statusText}` })
      };
    }

    const data = await aresResponse.json();

    // Pokud vše proběhlo OK, pošleme data aplikaci
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    };

  } catch (error) {
    // Pokud selže samotné volání, vrátíme chybu 500
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: 'Chyba při volání ARES', details: error.message }) 
    };
  }
};
