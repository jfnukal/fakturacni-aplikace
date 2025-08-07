const fetch = require('node-fetch');

exports.handler = async function (event, context) {
  // CORS preflight request handling
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
      // Pokud ARES vrátí chybu (např. 404 pro nenalezené IČO), pošleme ji dál
      return {
        statusCode: aresResponse.status,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: `ARES API Error: ${aresResponse.statusText}` }),
      };
    }

    const data = await aresResponse.json();

    // --- ZAČÁTEK NOVÉ ZPRACOVACÍ LOGIKY ---

    // 1. Sestavení kompletní adresy
    const sidlo = data.sidlo || {};
    const ulice = sidlo.nazevUlice || '';
    const cisloPopisne = sidlo.cisloDomovni || '';
    const cisloOrientacni = sidlo.cisloOrientacni || '';

    let ciselnaCast = cisloPopisne;
    if (cisloPopisne && cisloOrientacni) {
      ciselnaCast += `/${cisloOrientacni}`;
    } else if (cisloOrientacni) {
      ciselnaCast = cisloOrientacni;
    }
    
    const finalniAdresa = [ulice, ciselnaCast].filter(Boolean).join(' ').trim();

    // 2. Získání názvu živnostenského úřadu
    const authority = data.zivnostenskyUrad ? data.zivnostenskyUrad.nazev : null;

    // 3. Vytvoření finálního, čistého objektu, který pošleme do aplikace
    const responseData = {
      ico: data.ico,
      obchodniJmeno: data.obchodniJmeno,
      dic: data.dic,
      sidlo: { // Ponecháme i původní sídlo pro případ potřeby
        ulice: ulice,
        cisloOrientacni: cisloOrientacni,
        psc: sidlo.psc,
        nazevObce: sidlo.nazevObce
      },
      // Naše nová, zpracovaná pole:
      address: finalniAdresa,
      zip: sidlo.psc || '',
      city: sidlo.nazevObce || '',
      zivnostenskyUrad: {
          nazev: authority
      }
    };
    
    // --- KONEC NOVÉ ZPRACOVACÍ LOGIKY ---


    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      // Vracíme nově vytvořený a vyčištěný objekt
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
