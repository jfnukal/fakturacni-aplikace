export const generateNextDocumentNumber = (existingNumbers) => {
  const year = new Date().getFullYear();
  if (!existingNumbers || existingNumbers.length === 0) {
    return `${year}-001`; // Výchozí číslo, pokud žádné neexistuje
  }

  let maxNum = 0;
  // Šablona pro případ, že by žádné číslo nemělo číselnou část
  let template = { prefix: `${year}-`, numStr: '001' }; 

  existingNumbers.forEach(numStr => {
    // Regulární výraz, který najde číselnou část na konci řetězce
    const match = numStr.match(/^(.*?)(\d+)$/);
    if (match) {
      const prefix = match[1]; // Vše před číslem (např. "F2025-")
      const numPart = match[2]; // Číselná část (např. "009")
      const currentNum = parseInt(numPart, 10);

      // Pokud je toto číslo vyšší než dosavadní maximum, uložíme si ho
      // a také jeho formát jako šablonu pro další číslo.
      if (currentNum >= maxNum) {
        maxNum = currentNum;
        template = { prefix, numStr: numPart };
      }
    }
  });

  const nextNum = maxNum + 1;
  const padding = template.numStr.length; // Zachováme původní počet míst (např. délku "009" = 3)

  // Spojíme prefix a nové číslo s dodržením úvodních nul
  return `${template.prefix}${String(nextNum).padStart(padding, '0')}`;
};
