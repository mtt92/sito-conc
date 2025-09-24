// api/cars.js - Vercel Serverless Function per gestire il feed XML

export default async function handler(req, res) {
  // Abilita CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // URL del feed XML
    const XML_FEED_URL = 'http://xml.gestionaleauto.com/geasrlsv/export_gestionaleauto.php';
    
    // Fetch del feed XML
    const response = await fetch(XML_FEED_URL, {
      headers: {
        'User-Agent': 'M&A Auto Website/1.0',
        'Accept': 'application/xml, text/xml'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const xmlText = await response.text();
    
    // Parse XML usando DOMParser
    const { DOMParser } = await import('xmldom');
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    
    const cars = xmlDoc.getElementsByTagName('car');
    
    const parsedCars = Array.from(cars).map(car => {
      const getTextContent = (tagName) => {
        const element = car.getElementsByTagName(tagName)[0];
        return element ? element.textContent.trim() : '';
      };
      
      const getNestedTextContent = (parentTag, childTag) => {
        const parent = car.getElementsByTagName(parentTag)[0];
        if (parent) {
          const child = parent.getElementsByTagName(childTag)[0];
          return child ? child.textContent.trim() : '';
        }
        return '';
      };
      
      // Estrai immagini
      const images = [];
      const imageElements = car.getElementsByTagName('image');
      for (let i = 0; i < imageElements.length; i++) {
        const img = imageElements[i];
        const medium = img.getElementsByTagName('medium')[0];
        if (medium && medium.textContent.trim()) {
          images.push(medium.textContent.trim());
        }
      }
      
      // Estrai optional
      const options = [];
      const optionElements = car.getElementsByTagName('standard_option');
      for (let i = 0; i < optionElements.length; i++) {
        options.push(optionElements[i].textContent.trim());
      }
      
      // Calcola anno dalla data di registrazione
      const regDate = getTextContent('registration_date');
      const year = regDate ? parseInt(regDate.split('/')[1]) || new Date().getFullYear() : new Date().getFullYear();
      
      return {
        id: car.getAttribute('id'),
        make: getNestedTextContent('model', 'make'),
        model: getNestedTextContent('model', 'model'),
        version: getNestedTextContent('model', 'version'),
        body: getNestedTextContent('model', 'body'),
        fuel: getNestedTextContent('model', 'fuel'),
        year: year,
        km: parseInt(getTextContent('km')) || 0,
        price: parseInt(getTextContent('customers_price')) || 0,
        power: parseInt(getNestedTextContent('model', 'kwatt')) || 0,
        cv: Math.round((parseInt(getNestedTextContent('model', 'kwatt')) || 0) * 1.36),
        cc: parseInt(getNestedTextContent('model', 'cc')) || 0,
        doors: parseInt(getNestedTextContent('model', 'doors')) || 0,
        seats: parseInt(getNestedTextContent('model', 'seats')) || 0,
        gearbox: getTextContent('gearbox'),
        color: getNestedTextContent('exterior', 'color'),
        subtitle: getTextContent('subtitle'),
        images: images.length > 0 ? images : [],
        options: options,
        description: getTextContent('additional_informations')
      };
    });
    
    // Filtra auto con dati validi
    const validCars = parsedCars.filter(car => 
      car.make && car.model && car.price > 0
    );

    res.status(200).json({
      success: true,
      count: validCars.length,
      data: validCars,
      last_updated: new Date().toISOString()
    });

  } catch (error) {
    console.error('Errore nel caricamento del feed XML:', error);
    
    res.status(500).json({
      success: false,
      error: 'Errore nel caricamento delle auto',
      message: error.message
    });
  }
}