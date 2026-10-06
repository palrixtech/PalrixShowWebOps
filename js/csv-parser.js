/**
 * RFC-4180 CSV Parser and Serializer for PalrixShowWebOps
 * Compatible with PalrixShow / PalrixShowOps CsvService format
 */

export const CSV_HEADERS = [
  "id", "productCode", "name", "categoryName", "description",
  "price", "originalPrice", "baseLikes", "baseShares",
  "isNewArrival", "isLimitedStock", "isMostSold", "isMostLiked",
  "badge", "badgeClass", "sellerId", "sizes",
  "colorName", "colorCode", "imagePath"
];

export function parseCSV(text) {
  const rows = [];
  let inQuotes = false;
  let currentValue = "";
  let currentRow = [];

  const cleanedText = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < cleanedText.length; i++) {
    const char = cleanedText[i];
    const nextChar = cleanedText[i + 1];

    if (char === '"') {
      if (!inQuotes) {
        if (currentValue.trim() === "") {
          inQuotes = true;
        } else {
          currentValue += '"';
        }
      } else {
        if (nextChar === '"') {
          currentValue += '"';
          i++;
        } else {
          inQuotes = false;
        }
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentValue.trim());
      currentValue = "";
    } else if (char === '\n' && !inQuotes) {
      currentRow.push(currentValue.trim());
      if (currentRow.length > 1) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentValue = "";
    } else if (char === '\n' && inQuotes) {
      currentValue += ' ';
    } else {
      currentValue += char;
    }
  }

  if (currentRow.length > 0 || currentValue.trim()) {
    currentRow.push(currentValue.trim());
    if (currentRow.length > 1) {
      rows.push(currentRow);
    }
  }

  if (rows.length < 2) return [];

  const headers = rows[0].map(h => h.trim().replace(/^\ufeff/, ''));
  const mappedRows = [];

  for (let i = 1; i < rows.length; i++) {
    const values = rows[i];
    if (values.length < Math.floor(headers.length / 2)) continue;
    const row = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] !== undefined ? values[idx].trim() : "";
    });
    mappedRows.push(row);
  }

  return mappedRows;
}

export function parseBool(val) {
  if (!val) return false;
  return ["true", "1", "yes"].includes(val.trim().toLowerCase());
}

export function formatBool(val) {
  return val ? "TRUE" : "FALSE";
}

export function groupRowsIntoProducts(rows) {
  const productsMap = new Map();

  rows.forEach(row => {
    if (!row.id || row.id.trim() === "") return;
    const id = row.id.trim();

    if (!productsMap.has(id)) {
      const sizesList = (row.sizes || "")
        .split(",")
        .map(s => s.trim())
        .filter(Boolean);

      productsMap.set(id, {
        id: id,
        productCode: row.productCode || "",
        name: row.name || "",
        categoryName: row.categoryName || "",
        description: row.description || "",
        price: Number(row.price) || 0,
        originalPrice: row.originalPrice ? Number(row.originalPrice) : null,
        baseLikes: Number(row.baseLikes) || 0,
        baseShares: Number(row.baseShares) || 0,
        isNewArrival: parseBool(row.isNewArrival),
        isLimitedStock: parseBool(row.isLimitedStock),
        isMostSold: parseBool(row.isMostSold),
        isMostLiked: parseBool(row.isMostLiked),
        badge: row.badge || "",
        badgeClass: row.badgeClass || "",
        sellerId: row.sellerId || "palrix-fashion",
        sizes: sizesList,
        variants: []
      });
    }

    const prod = productsMap.get(id);
    const colorName = row.colorName || "";
    const colorCode = row.colorCode || "";
    const imagePath = row.imagePath || "";

    if (imagePath || colorName) {
      prod.variants.push({
        colorName: colorName,
        colorCode: colorCode,
        imagePath: imagePath
      });
    }
  });

  return Array.from(productsMap.values());
}

function escapeCsvField(val) {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function serializeProductsToCSV(products) {
  const lines = [];
  lines.push(CSV_HEADERS.join(","));

  products.forEach(p => {
    const sizesStr = (p.sizes || []).join(",");
    const baseRow = {
      id: p.id || "",
      productCode: p.productCode || "",
      name: p.name || "",
      categoryName: p.categoryName || "",
      description: p.description || "",
      price: p.price ?? 0,
      originalPrice: p.originalPrice ?? "",
      baseLikes: p.baseLikes ?? 0,
      baseShares: p.baseShares ?? 0,
      isNewArrival: formatBool(p.isNewArrival),
      isLimitedStock: formatBool(p.isLimitedStock),
      isMostSold: formatBool(p.isMostSold),
      isMostLiked: formatBool(p.isMostLiked),
      badge: p.badge || "",
      badgeClass: p.badgeClass || "",
      sellerId: p.sellerId || "palrix-fashion",
      sizes: sizesStr
    };

    if (!p.variants || p.variants.length === 0) {
      const rowObj = { ...baseRow, colorName: "", colorCode: "", imagePath: "" };
      lines.push(CSV_HEADERS.map(h => escapeCsvField(rowObj[h])).join(","));
    } else {
      p.variants.forEach(v => {
        const rowObj = {
          ...baseRow,
          colorName: v.colorName || "",
          colorCode: v.colorCode || "",
          imagePath: v.imagePath || ""
        };
        lines.push(CSV_HEADERS.map(h => escapeCsvField(rowObj[h])).join(","));
      });
    }
  });

  return lines.join("\n") + "\n";
}
