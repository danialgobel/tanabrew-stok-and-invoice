/**
 * Google Apps Script Web App Endpoint for Tanabrew Spreadsheet API
 * Salin dan tempel (copy-paste) seluruh isi file ini untuk menimpa kode Anda di Google Apps Script Editor.
 *
 * VERSI BERSIH — tidak ada duplikasi fungsi.
 */

/* ================================================================
 * doGet — Membaca data dari Spreadsheet (action: income / expense / health)
 * ================================================================ */
function doGet(e) {
  const action = e.parameter.action || "health";

  switch (action) {
    case "health":
      return jsonResponse({ success: true, message: "Tanabrew Spreadsheet API Running 🚀" });

    case "debug":
      try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        if (!ss) return jsonResponse({ success: false, message: "Active spreadsheet is null" });
        const sheets = ss.getSheets().map(function(s) { return s.getName(); });
        const sheet = ss.getSheetByName("Pendapatan");
        const info = sheet ? {
          name: sheet.getName(),
          lastRow: sheet.getLastRow(),
          lastColumn: sheet.getLastColumn(),
          valuesRow6: sheet.getLastRow() >= 6 ? sheet.getRange(6, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0] : [],
        } : null;
        return jsonResponse({
          success: true,
          spreadsheetName: ss.getName(),
          spreadsheetId: ss.getId(),
          sheets: sheets,
          pendapatanInfo: info
        });
      } catch (err) {
        return jsonResponse({ success: false, error: err.toString() });
      }

    case "income":
      try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Pendapatan");
        if (!sheet) return jsonResponse({ success: false, message: "Sheet Pendapatan tidak ditemukan", records: [] });

        const headerRow = 6;
        const dataStartRow = 7;
        const lastRow = sheet.getLastRow();
        const lastColumn = sheet.getLastColumn();

        if (lastRow < dataStartRow || lastColumn <= 0) {
          return jsonResponse({ success: true, records: [] });
        }

        const headers = sheet.getRange(headerRow, 1, 1, lastColumn).getValues()[0];
        const data = sheet.getRange(dataStartRow, 1, lastRow - (dataStartRow - 1), lastColumn).getValues();

        const records = [];
        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          if (!row[0] || row[0].toString().trim() === "") continue;

          const record = {
            jamInvoice: "-",
            paymentStatus: "LUNAS",
            createdBy: "System",
            role: "admin",
          };

          let rawId = row[1] ? row[1].toString().trim() : "";
          if (rawId === "") rawId = "TR-TEMP-" + (i + 1);
          record["invoiceNumber"] = rawId;

          for (let j = 0; j < headers.length; j++) {
            const header = headers[j];
            if (header !== undefined && header !== null && header !== "") {
              const key = getMapKeyIncome(header);
              if (key === "invoiceNumber") continue;
              if (key === "tanggalInvoice" && row[j] instanceof Date) {
                const d = row[j];
                record[key] = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
                record["timestamp"] = d.toISOString();
              } else {
                record[key] = row[j];
              }
            }
          }
          if (!record["timestamp"]) record["timestamp"] = new Date().toISOString();
          
          // Post-process to extract real invoice number if available in catatan
          var noteStr = record["catatan"] ? record["catatan"].toString().trim() : "";
          var invMatch = noteStr.match(/INV\/TNB\/\d{4}\/\d{2}\/\d{4}/i) || noteStr.match(/TEST-INV-\d+/i) || noteStr.match(/TR-TEMP-\d+/i);
          if (invMatch) {
            record["invoiceNumber"] = invMatch[0];
          }
          
          records.push(record);
        }

        return jsonResponse({ success: true, records: records });
      } catch (err) {
        return jsonResponse({ success: false, message: "Error: " + err.toString(), records: [] });
      }

    case "expense":
      try {
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Pengeluaran");
        if (!sheet) return jsonResponse({ success: false, message: "Sheet Pengeluaran tidak ditemukan", records: [] });

        const headerRow = 6;
        const dataStartRow = 7;
        const lastRow = sheet.getLastRow();
        const lastColumn = sheet.getLastColumn();

        if (lastRow < dataStartRow || lastColumn <= 0) {
          return jsonResponse({ success: true, records: [] });
        }

        const headers = sheet.getRange(headerRow, 1, 1, lastColumn).getValues()[0];
        const data = sheet.getRange(dataStartRow, 1, lastRow - (dataStartRow - 1), lastColumn).getValues();

        const records = [];
        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          if (!row[0] || row[0].toString().trim() === "") continue;

          const record = {};
          let rawId = row[1] ? row[1].toString().trim() : "";
          if (rawId === "") rawId = "EXP-TEMP-" + (i + 1);
          record["expenseId"] = rawId;

          for (let j = 0; j < headers.length; j++) {
            const header = headers[j];
            if (header !== undefined && header !== null && header !== "") {
              const key = getMapKeyExpense(header);
              if (key === "expenseId") continue;
              if ((key === "tanggalExpense" || key === "tangal") && row[j] instanceof Date) {
                const d = row[j];
                record["tanggalExpense"] = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
                record["timestamp"] = d.toISOString();
              } else {
                record[key] = row[j];
              }
            }
          }
          if (!record["timestamp"]) record["timestamp"] = new Date().toISOString();
          records.push(record);
        }

        return jsonResponse({ success: true, records: records });
      } catch (err) {
        return jsonResponse({ success: false, message: "Error: " + err.toString(), records: [] });
      }

    default:
      return jsonResponse({ success: false, message: "Unknown action: " + action });
  }
}

/* ================================================================
 * doPost — Menulis/mengupdate data ke Spreadsheet
 * Mendukung: add_income, edit_income, invoice_sync, add_expense, edit_expense
 * Body dikirim sebagai text/plain berisi JSON (menghindari CORS preflight)
 * ================================================================ */
function doPost(e) {
  try {
    var raw = (e.postData && e.postData.contents) ? e.postData.contents : "{}";
    var data = JSON.parse(raw);
    var action = data.action || "";

    switch (action) {
      case "add_income":
      case "invoice_sync":
        return jsonResponse(handleAddIncome(data));
      case "edit_income":
        return jsonResponse(handleEditIncome(data));
      case "add_expense":
        return jsonResponse(handleAddExpense(data));
      case "edit_expense":
        return jsonResponse(handleEditExpense(data));
      default:
        return jsonResponse({ success: false, message: "Action tidak dikenali: " + action });
    }
  } catch (err) {
    return jsonResponse({ success: false, message: "doPost error: " + err.toString() });
  }
}

/* ================================================================
 * INCOME HANDLERS
 * ================================================================ */

function handleAddIncome(data) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Pendapatan");
  if (!sheet) return { success: false, message: "Sheet Pendapatan tidak ditemukan" };

  var lastColumn = sheet.getLastColumn();
  var headers = sheet.getRange(6, 1, 1, lastColumn).getValues()[0];
  var idx = buildHeaderIndex(headers);
  var row = new Array(lastColumn).fill("");

  var invoiceNumber = data.invoiceNumber || "";
  var total = Number(data.total) || 0;
  var produkJasa = data.produkJasa || "";
  if (!produkJasa && Array.isArray(data.items)) {
    produkJasa = data.items.map(function(it) {
      return it.nama_barang + " (" + it.jumlah + "x)";
    }).join(", ");
  }

  // Derive customer code (first word lowercase)
  var customerName = data.customerName || "";
  var customerCode = "";
  if (customerName) {
    customerCode = customerName.trim().split(/\s+/)[0].toLowerCase();
  }
  if (!customerCode) {
    customerCode = invoiceNumber ? invoiceNumber.toLowerCase() : "";
  }
  var customerUpper = customerName ? customerName.toUpperCase() : "";

  // Append invoice ID to notes to preserve it
  var notes = data.catatan || "";
  if (invoiceNumber && invoiceNumber !== "-" && notes.indexOf(invoiceNumber) === -1) {
    if (notes) {
      notes = invoiceNumber + " - " + notes;
    } else {
      notes = invoiceNumber;
    }
  }
  if (data.createdBy && notes.indexOf(data.createdBy) === -1) {
    notes = notes + " (Dibuat oleh " + data.createdBy + ")";
  }

  var targetRow = findNextEmptyRow(sheet, 7, 1);

  // Set formulas for M, Y, Y2 if columns exist
  var mCol = idx["M"];
  var yCol = idx["Y"];
  var y2Col = idx["Y2"];
  if (mCol) row[mCol - 1] = "=TEXT(A" + targetRow + ", \"mmm\")";
  if (yCol) row[yCol - 1] = "=YEAR(A" + targetRow + ")";
  if (y2Col) row[y2Col - 1] = "=IF(MONTH(A" + targetRow + ")=12, YEAR(A" + targetRow + ")+1, YEAR(A" + targetRow + "))";

  setVal(row, idx, "TANGGAL",    data.tanggalInvoice || "");
  setVal(row, idx, "TANGAL",     data.tanggalInvoice || "");
  setVal(row, idx, "ID",         customerCode);
  setVal(row, idx, "PRODUK/JASA",produkJasa);
  setVal(row, idx, "KATEGORI",   data.paymentMethod || "");
  setVal(row, idx, "NOMINAL",    total);
  setVal(row, idx, "POTONGAN",   0);
  setVal(row, idx, "FEE",        0);
  setVal(row, idx, "NET INCOME", total);
  setVal(row, idx, "CATATAN",    notes);
  setVal(row, idx, "CUSTOMER",   customerUpper);

  var range = sheet.getRange(targetRow, 1, 1, lastColumn);
  range.clearDataValidations();
  range.setValues([row]);

  // Apply yellow background highlight to CUSTOMER cell
  var customerCol = idx["CUSTOMER"];
  if (customerCol) {
    sheet.getRange(targetRow, customerCol).setBackground("#FFF2CC");
  }

  return { success: true, message: "Pendapatan berhasil ditambahkan", invoiceNumber: invoiceNumber, row: targetRow };
}

function handleEditIncome(data) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Pendapatan");
  if (!sheet) return { success: false, message: "Sheet Pendapatan tidak ditemukan" };

  var invoiceNumber = data.invoiceNumber || "";
  if (!invoiceNumber) return { success: false, message: "invoiceNumber kosong" };

  var lastRow = sheet.getLastRow();
  var lastColumn = sheet.getLastColumn();
  var headers = sheet.getRange(6, 1, 1, lastColumn).getValues()[0];
  var idx = buildHeaderIndex(headers);
  var idCol = idx["ID"];
  var catatanCol = idx["CATATAN"];
  if (!idCol) return { success: false, message: "Kolom ID tidak ditemukan di sheet Pendapatan" };

  // Search by ID column (for old records) or by invoice number in CATATAN column (for new format)
  var targetRow = -1;
  if (lastRow >= 7) {
    var ids = sheet.getRange(7, idCol, lastRow - 6, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (ids[i][0] && ids[i][0].toString().trim() === invoiceNumber) {
        targetRow = 7 + i;
        break;
      }
    }
  }

  if (targetRow === -1 && catatanCol && lastRow >= 7) {
    var notesData = sheet.getRange(7, catatanCol, lastRow - 6, 1).getValues();
    for (var i = 0; i < notesData.length; i++) {
      var noteText = notesData[i][0] ? notesData[i][0].toString() : "";
      if (noteText.indexOf(invoiceNumber) !== -1) {
        targetRow = 7 + i;
        break;
      }
    }
  }

  if (targetRow === -1) return { success: false, message: "Invoice " + invoiceNumber + " tidak ditemukan" };

  var row = sheet.getRange(targetRow, 1, 1, lastColumn).getValues()[0];
  var total = Number(data.total) || 0;

  // Derive customer code (first word lowercase)
  var customerName = data.customerName || "";
  var customerCode = "";
  if (customerName) {
    customerCode = customerName.trim().split(/\s+/)[0].toLowerCase();
  }
  if (!customerCode) {
    customerCode = invoiceNumber ? invoiceNumber.toLowerCase() : "";
  }
  var customerUpper = customerName ? customerName.toUpperCase() : "";

  // Append invoice ID to notes if not there
  var notes = data.catatan || "";
  if (invoiceNumber && invoiceNumber !== "-" && notes.indexOf(invoiceNumber) === -1) {
    if (notes) {
      notes = invoiceNumber + " - " + notes;
    } else {
      notes = invoiceNumber;
    }
  }
  if (data.createdBy && notes.indexOf(data.createdBy) === -1) {
    notes = notes + " (Dibuat oleh " + data.createdBy + ")";
  }

  // Set formulas for M, Y, Y2 if columns exist
  var mCol = idx["M"];
  var yCol = idx["Y"];
  var y2Col = idx["Y2"];
  if (mCol) row[mCol - 1] = "=TEXT(A" + targetRow + ", \"mmm\")";
  if (yCol) row[yCol - 1] = "=YEAR(A" + targetRow + ")";
  if (y2Col) row[y2Col - 1] = "=IF(MONTH(A" + targetRow + ")=12, YEAR(A" + targetRow + ")+1, YEAR(A" + targetRow + "))";

  setVal(row, idx, "TANGGAL",    data.tanggalInvoice || "");
  setVal(row, idx, "TANGAL",     data.tanggalInvoice || "");
  setVal(row, idx, "ID",         customerCode);
  setVal(row, idx, "PRODUK/JASA",data.produkJasa || "");
  setVal(row, idx, "KATEGORI",   data.paymentMethod || "");
  setVal(row, idx, "NOMINAL",    total);
  setVal(row, idx, "NET INCOME", total);
  setVal(row, idx, "CATATAN",    notes);
  setVal(row, idx, "CUSTOMER",   customerUpper);

  var range = sheet.getRange(targetRow, 1, 1, lastColumn);
  range.clearDataValidations();
  range.setValues([row]);

  // Apply yellow background highlight to CUSTOMER cell
  var customerCol = idx["CUSTOMER"];
  if (customerCol) {
    sheet.getRange(targetRow, customerCol).setBackground("#FFF2CC");
  }

  return { success: true, message: "Pendapatan berhasil diupdate", row: targetRow };
}

/* ================================================================
 * EXPENSE HANDLERS
 * ================================================================ */

function handleAddExpense(data) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Pengeluaran");
  if (!sheet) return { success: false, message: "Sheet Pengeluaran tidak ditemukan" };

  var lastColumn = sheet.getLastColumn();
  var headers = sheet.getRange(6, 1, 1, lastColumn).getValues()[0];
  var idx = buildHeaderIndex(headers);
  var row = new Array(lastColumn).fill("");

  setVal(row, idx, "ID",           data.expenseId || "");
  setVal(row, idx, "TANGGAL",      data.tanggalExpense || "");
  setVal(row, idx, "TANGAL",       data.tanggalExpense || "");
  setVal(row, idx, "ITEM / PRODUK",data.itemProduk || "");
  setVal(row, idx, "ITEM/PRODUK",  data.itemProduk || "");
  setVal(row, idx, "KATEGORI",     data.kategori || "");
  setVal(row, idx, "NOMINAL",      Number(data.nominal) || 0);
  setVal(row, idx, "CATATAN",      data.catatan || "");

  var targetRow = findNextEmptyRow(sheet, 7, 1);
  var range = sheet.getRange(targetRow, 1, 1, lastColumn);
  range.clearDataValidations();
  range.setValues([row]);
  return { success: true, message: "Pengeluaran berhasil ditambahkan", expenseId: data.expenseId, row: targetRow };
}

function handleEditExpense(data) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Pengeluaran");
  if (!sheet) return { success: false, message: "Sheet Pengeluaran tidak ditemukan" };

  var expenseId = data.expenseId || "";
  if (!expenseId) return { success: false, message: "expenseId kosong" };

  var lastRow = sheet.getLastRow();
  var lastColumn = sheet.getLastColumn();
  var headers = sheet.getRange(6, 1, 1, lastColumn).getValues()[0];
  var idx = buildHeaderIndex(headers);
  var idCol = idx["ID"];
  if (!idCol) return { success: false, message: "Kolom ID tidak ditemukan di sheet Pengeluaran" };

  var ids = sheet.getRange(7, idCol, lastRow - 6, 1).getValues();
  var targetRow = -1;
  for (var i = 0; i < ids.length; i++) {
    if (ids[i][0] && ids[i][0].toString().trim() === expenseId) {
      targetRow = 7 + i;
      break;
    }
  }
  if (targetRow === -1) return { success: false, message: "ID " + expenseId + " tidak ditemukan" };

  var row = sheet.getRange(targetRow, 1, 1, lastColumn).getValues()[0];

  setVal(row, idx, "TANGGAL",      data.tanggalExpense || "");
  setVal(row, idx, "TANGAL",       data.tanggalExpense || "");
  setVal(row, idx, "ITEM / PRODUK",data.itemProduk || "");
  setVal(row, idx, "ITEM/PRODUK",  data.itemProduk || "");
  setVal(row, idx, "KATEGORI",     data.kategori || "");
  setVal(row, idx, "NOMINAL",      Number(data.nominal) || 0);
  setVal(row, idx, "CATATAN",      data.catatan || "");

  var range = sheet.getRange(targetRow, 1, 1, lastColumn);
  range.clearDataValidations();
  range.setValues([row]);
  return { success: true, message: "Pengeluaran berhasil diupdate", row: targetRow };
}


/**
 * Mencari baris kosong pertama di kolom tertentu (1-based) dimulai dari startRow.
 */
function findNextEmptyRow(sheet, startRow, checkCol) {
  var lastRow = sheet.getLastRow();
  if (lastRow < startRow) {
    return startRow;
  }
  var range = sheet.getRange(startRow, checkCol, lastRow - startRow + 1, 1);
  var values = range.getValues();
  for (var i = 0; i < values.length; i++) {
    var val = values[i][0];
    if (val === undefined || val === null || val.toString().trim() === "") {
      return startRow + i;
    }
  }
  return lastRow + 1;
}

/* ================================================================
 * HELPERS
 * ================================================================ */

/**
 * Buat map: HEADER_NAME_UPPERCASE -> column index (1-based)
 * Secara otomatis menormalkan spasi di sekitar slash (e.g. "PRODUK / JASA" menjadi "PRODUK/JASA")
 */
function buildHeaderIndex(headers) {
  var map = {};
  for (var i = 0; i < headers.length; i++) {
    var h = headers[i];
    if (h && h.toString().trim() !== "") {
      var normalized = h.toString().trim().toUpperCase().replace(/\s*\/\s*/g, "/");
      map[normalized] = i + 1;
    }
  }
  return map;
}

/**
 * Set nilai pada array row berdasarkan header name.
 * Mendukung pencarian toleran typo (e.g. "POTONGAN" dapat mengisi kolom "POTRONGAN").
 */
function setVal(row, idx, headerName, value) {
  var key = headerName.toUpperCase().replace(/\s*\/\s*/g, "/");
  var col = idx[key];
  if (col !== undefined) {
    row[col - 1] = value;
  } else {
    // Custom fallbacks
    if (key === "POTONGAN" && idx["POTRONGAN"] !== undefined) {
      row[idx["POTRONGAN"] - 1] = value;
    }
  }
}

/**
 * Bungkus objek menjadi ContentService JSON response.
 */
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Pad angka menjadi 2 digit.
 */
function pad(n) {
  return String(n).padStart(2, "0");
}

/**
 * Memetakan nama kolom sheet Pendapatan ke camelCase key.
 */
function getMapKeyIncome(header) {
  var h = header.toString().trim().toUpperCase().replace(/\s*\/\s*/g, "/");
  switch (h) {
    case "ID":          return "invoiceNumber";
    case "TANGGAL":
    case "TANGAL":      return "tanggalInvoice";
    case "CUSTOMER":    return "customerName";
    case "NOMINAL":     return "total";
    case "KATEGORI":    return "paymentMethod";
    case "PRODUK/JASA": return "produkJasa";
    case "POTRONGAN":
    case "POTONGAN":    return "potongan";
    case "CATATAN":     return "catatan";
    default:
      return h.toLowerCase().replace(/[^a-zA-Z0-9]+(.)/g, function(_, c) { return c.toUpperCase(); });
  }
}

/**
 * Memetakan nama kolom sheet Pengeluaran ke camelCase key.
 */
function getMapKeyExpense(header) {
  var h = header.toString().trim().toUpperCase().replace(/\s*\/\s*/g, "/");
  switch (h) {
    case "ID":           return "expenseId";
    case "TANGGAL":
    case "TANGAL":       return "tanggalExpense";
    case "ITEM/PRODUK":  return "itemProduk";
    case "NOMINAL":      return "nominal";
    case "KATEGORI":     return "kategori";
    case "CATATAN":      return "catatan";
    default:
      return h.toLowerCase().replace(/[^a-zA-Z0-9]+(.)/g, function(_, c) { return c.toUpperCase(); });
  }
}
