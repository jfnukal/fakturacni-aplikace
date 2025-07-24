const fetch = require('node-fetch');

exports.handler = async function (event, context) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      }
    };
  }

  const { ico } = event.queryStringParameters || {};
  
  if (!ico || !/^\d{8}$/.test(ico)) {
    return { 
      statusCode: 400, 
      headers: { 
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: 'Chybí nebo neplatné IČO' }) 
    };
  }

  // NOVÉ ARES API URL
  const aresUrl = `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${ico}`;

  try {
    const aresResponse = await fetch(aresUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; Invoice-Generator/1.0)'
      }
    });

    if (!aresResponse.ok) {
      console.error(`ARES API Error: ${aresResponse.status}`);
      return {
        statusCode: aresResponse.status,
        headers: { 
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          error: `ARES API nedostupné: ${aresResponse.status}`,
        }),
      };
    }

    const data = await aresResponse.json();
    
    return {
      statusCode: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(data),
    };
  } catch (error) {
    console.error('ARES Function Error:', error);
    return {
      statusCode: 500,
      headers: { 
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: 'Chyba při volání ARES',
        details: error.message,
      }),
    };
  }
};
