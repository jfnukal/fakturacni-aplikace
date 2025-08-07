const fetch = require('node-fetch');

exports.handler = async function (event, context) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      },
    };
  }

  const { ico } = event.queryStringParameters || {};

  if (!ico || !/^\d{8}$/.test(ico)) {
    return {
      statusCode: 400,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Chybí nebo neplatné IČO' }),
    };
  }

  const aresUrl = `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${ico}`;

  try {
    const aresResponse = await fetch(aresUrl, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; FakturaceApp/1.0)',
      },
    });

    if (!aresResponse.ok) {
      return {
        statusCode: aresResponse.status,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: `ARES API Error: ${aresResponse.statusText}` }),
      };
    }

    const data = await aresResponse.json();

    // --- ZAČÁTEK ZPRACOVACÍ LOGIKY ---

    const sidlo = data.sidlo || {};
    const ulice = sidlo.nazevUlice || '';
    const cisloDomovni = sidlo.cisloDomovni || ''; // Číslo popisné
    const cisloOrientacni = sidlo.cisloOrientacni || '';
    const cisloOrientacniPismeno = sidlo.cisloOrientacniPismeno || '';

    let ciselnaCast = '';
    // FINÁLNÍ SPRÁVNÉ POŘADÍ: orientační / popisné
    if (cisloDomovni && cisloOrientacni) {
        ciselnaCast = `${cisloOrientacni}${cisloOrientacniPismeno}/${cisloDomovni}`;
    } else if (cisloDomovni) {
        ciselnaCast = cisloDomovni;
    } else if (cisloOrientacni) {
        ciselnaCast = `${cisloOrientacni}${cisloOrientacniPismeno}`;
    }
    
    const finalniAdresa = [ulice, ciselnaCast].filter(Boolean).join(' ').trim();
    const authority = data.zivnostenskyUrad ? data.zivnostenskyUrad.nazev : null;

    const responseData = {
      ico: data.ico,
      obchodniJmeno: data.obchodniJmeno,
      dic: data.dic,
      address: finalniAdresa,
      zip: sidlo.psc || '',
      city: sidlo.nazevObce || '',
      zivnostenskyUrad: {
          nazev: authority
      }
    };
    
    // --- KONEC ZPRACOVACÍ LOGIKY ---

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(responseData),
    };

  } catch (error) {
    console.error('ARES Function Error:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Interní chyba funkce', details: error.message }),
    };
  }
};
