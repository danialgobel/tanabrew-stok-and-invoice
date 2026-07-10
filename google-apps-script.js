/**
 * Google Apps Script Web App Endpoint for Tanabrew Spreadsheet API
 * Salin dan tempel (copy-paste) seluruh isi file ini untuk menimpa kode Anda di Google Apps Script Editor.
 */

function doGet(e) {
  const action = e.parameter.action || "health";

  switch (action) {
    case "health":
      return ContentService
        .createTextOutput(
          JSON.stringify({
            success: true,
            message: "Tanabrew Spreadsheet API Running 🚀"
          })
        )
        .setMimeType(ContentService.MimeType.JSON);

    case "income":
      try {
        const activeSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
        const sheet = activeSpreadsheet.getSheetByName("Pendapatan");
        
        if (!sheet) {
          return ContentService.createTextOutput(JSON.stringify({
            success: false,
            message: "Sheet Pendapatan tidak ditemukan",
            records: []
          })).setMimeType(ContentService.MimeType.JSON);
        }
        
        const headerRow = 6;
        const dataStartRow = 7;
        
        const lastRow = sheet.getLastRow();
        const lastColumn = sheet.getLastColumn();
        
        if (lastRow < dataStartRow || lastColumn <= 0) {
          return ContentService.createTextOutput(JSON.stringify({
            success: true,
            records: []
          })).setMimeType(ContentService.MimeType.JSON);
        }
        
        const headers = sheet.getRange(headerRow, 1, 1, lastColumn).getValues()[0];
        const data = sheet.getRange(dataStartRow, 1, lastRow - (dataStartRow - 1), lastColumn).getValues();
        
        const records = [];
        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          
          if (!row[0] || row[0].toString().trim() === "") {
            continue;
          }
          
          const record = {};
          
          record["jamInvoice"] = "-";
          record["paymentStatus"] = "LUNAS";
          record["createdBy"] = "System";
          record["role"] = "admin";
          
          let rawId = row[1] ? row[1].toString().trim() : "";
          if (rawId === "") {
            rawId = "TR-TEMP-" + (i + 1);
          }
          record["invoiceNumber"] = rawId;
          
          for (let j = 0; j < headers.length; j++) {
            const header = headers[j];
            if (header !== undefined && header !== null && header !== "") {
              const key = getMapKeyIncome(header);
              
              if (key === "invoiceNumber") {
                continue;
              }
              
              if (key === "tanggalInvoice" && row[j] instanceof Date) {
                const dateVal = row[j];
                const yyyy = dateVal.getFullYear();
                const mm = String(dateVal.getMonth() + 1).padStart(2, "0");
                const dd = String(dateVal.getDate()).padStart(2, "0");
                record[key] = `${yyyy}-${mm}-${dd}`;
                record["timestamp"] = dateVal.toISOString();
              } else {
                record[key] = row[j];
              }
            }
          }
          
          if (!record["timestamp"]) {
            record["timestamp"] = new Date().toISOString();
          }
          
          records.push(record);
        }
        
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          records: records
        })).setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          message: "Error: " + error.toString(),
          records: []
        })).setMimeType(ContentService.MimeType.JSON);
      }

    case "expense":
      try {
        const activeSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
        const sheet = activeSpreadsheet.getSheetByName("Pengeluaran");
        
        if (!sheet) {
          return ContentService.createTextOutput(JSON.stringify({
            success: false,
            message: "Sheet Pengeluaran tidak ditemukan",
            records: []
          })).setMimeType(ContentService.MimeType.JSON);
        }
        
        const headerRow = 6;
        const dataStartRow = 7;
        
        const lastRow = sheet.getLastRow();
        const lastColumn = sheet.getLastColumn();
        
        if (lastRow < dataStartRow || lastColumn <= 0) {
          return ContentService.createTextOutput(JSON.stringify({
            success: true,
            records: []
          })).setMimeType(ContentService.MimeType.JSON);
        }
        
        const headers = sheet.getRange(headerRow, 1, 1, lastColumn).getValues()[0];
        const data = sheet.getRange(dataStartRow, 1, lastRow - (dataStartRow - 1), lastColumn).getValues();
        
        const records = [];
        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          
          if (!row[0] || row[0].toString().trim() === "") {
            continue;
          }
          
          const record = {};
          
          let rawId = row[1] ? row[1].toString().trim() : "";
          if (rawId === "") {
            rawId = "EXP-TEMP-" + (i + 1);
          }
          record["expenseId"] = rawId;
          
          for (let j = 0; j < headers.length; j++) {
            const header = headers[j];
            if (header !== undefined && header !== null && header !== "") {
              const key = getMapKeyExpense(header);
              
              if (key === "expenseId") {
                continue;
              }
              
              if (key === "tanggalExpense" && row[j] instanceof Date) {
                const dateVal = row[j];
                const yyyy = dateVal.getFullYear();
                const mm = String(dateVal.getMonth() + 1).padStart(2, "0");
                const dd = String(dateVal.getDate()).padStart(2, "0");
                record[key] = `${yyyy}-${mm}-${dd}`;
                record["timestamp"] = dateVal.toISOString();
              } else {
                record[key] = row[j];
              }
            }
          }
          
          if (!record["timestamp"]) {
            record["timestamp"] = new Date().toISOString();
          }
          
          records.push(record);
        }
        
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          records: records
        })).setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          message: "Error: " + error.toString(),
          records: []
        })).setMimeType(ContentService.MimeType.JSON);
      }

    default:
      return ContentService
        .createTextOutput(
          JSON.stringify({
            success: false,
            message: "Unknown action"
          })
        )
        .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const postData = JSON.parse(e.postData.contents);
    const action = postData.action || "invoice_sync";
    const activeSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    
    if (action === "add_income" || action === "invoice_sync") {
      const sheet = activeSpreadsheet.getSheetByName("Pendapatan");
      if (!sheet) {
        return createErrorResponse("Sheet Pendapatan tidak ditemukan");
      }
      
      const headerRow = 6;
      const lastColumn = sheet.getLastColumn();
      const headers = sheet.getRange(headerRow, 1, 1, lastColumn).getValues()[0];
      
      const headerIndices = getHeaderIndices(headers);
      const rowValues = new Array(lastColumn).fill("");
      
      function setValue(headerName, value) {
        const colIdx = headerIndices[headerName];
        if (colIdx !== undefined) {
          rowValues[colIdx - 1] = value;
        }
      }
      
      const invoiceNumber = postData.invoiceNumber || "";
      const total = Number(postData.total) || 0;
      
      let produkJasa = postData.produkJasa || "";
      if (!produkJasa && Array.isArray(postData.items)) {
        produkJasa = postData.items.map(function(item) {
          return item.nama_barang + " (" + item.jumlah + "x)";
        }).join(", ");
      }
      
      setValue("TANGGAL", postData.tanggalInvoice);
      setValue("TANGAL", postData.tanggalInvoice);
      setValue("ID", invoiceNumber);
      setValue("PRODUK/JASA", produkJasa);
      setValue("KATEGORI", postData.paymentMethod);
      setValue("NOMINAL", total);
      setValue("POTONGAN", 0);
      setValue("FEE", 0);
      setValue("NET INCOME", total);
      setValue("CATATAN", postData.catatan || ("Dibuat oleh " + (postData.createdBy || "System")));
      setValue("CUSTOMER", postData.customerName);
      
      const lastRow = sheet.getLastRow();
      const nextRow = lastRow + 1;
      sheet.getRange(nextRow, 1, 1, lastColumn).setValues([rowValues]);
      
      return createSuccessResponse("Data pendapatan berhasil disimpan", {
        invoiceNumber: invoiceNumber
      });
      
    } else if (action === "edit_income") {
      const sheet = activeSpreadsheet.getSheetByName("Pendapatan");
      if (!sheet) {
        return createErrorResponse("Sheet Pendapatan tidak ditemukan");
      }
      
      const headerRow = 6;
      const lastRow = sheet.getLastRow();
      const lastColumn = sheet.getLastColumn();
      const headers = sheet.getRange(headerRow, 1, 1, lastColumn).getValues()[0];
      
      const headerIndices = getHeaderIndices(headers);
      const idColIdx = headerIndices["ID"];
      
      if (idColIdx === undefined) {
        return createErrorResponse("Kolom ID tidak ditemukan di sheet Pendapatan");
      }
      
      const targetId = postData.invoiceNumber;
      if (!targetId) {
        return createErrorResponse("Invoice Number kosong");
      }
      
      // Cari baris berdasarkan ID
      let targetRowIdx = -1;
      const idValues = sheet.getRange(headerRow + 1, idColIdx, lastRow - headerRow, 1).getValues();
      for (let i = 0; i < idValues.length; i++) {
        if (idValues[i][0].toString().trim() === targetId.toString().trim()) {
          targetRowIdx = headerRow + 1 + i;
          break;
        }
      }
      
      if (targetRowIdx === -1) {
        return createErrorResponse("Transaksi dengan ID " + targetId + " tidak ditemukan di sheet Pendapatan");
      }
      
      const rowRange = sheet.getRange(targetRowIdx, 1, 1, lastColumn);
      const rowValues = rowRange.getValues()[0];
      
      function updateValue(headerName, value) {
        const colIdx = headerIndices[headerName];
        if (colIdx !== undefined) {
          rowValues[colIdx - 1] = value;
        }
      }
      
      const total = Number(postData.total) || 0;
      
      updateValue("TANGGAL", postData.tanggalInvoice);
      updateValue("TANGAL", postData.tanggalInvoice);
      updateValue("PRODUK/JASA", postData.produkJasa);
      updateValue("KATEGORI", postData.paymentMethod);
      updateValue("NOMINAL", total);
      updateValue("NET INCOME", total);
      updateValue("CATATAN", postData.catatan);
      updateValue("CUSTOMER", postData.customerName);
      
      rowRange.setValues([rowValues]);
      
      return createSuccessResponse("Data pendapatan berhasil diperbarui");
      
    } else if (action === "add_expense") {
      const sheet = activeSpreadsheet.getSheetByName("Pengeluaran");
      if (!sheet) {
        return createErrorResponse("Sheet Pengeluaran tidak ditemukan");
      }
      
      const headerRow = 6;
      const lastColumn = sheet.getLastColumn();
      const headers = sheet.getRange(headerRow, 1, 1, lastColumn).getValues()[0];
      
      const headerIndices = getHeaderIndices(headers);
      const rowValues = new Array(lastColumn).fill("");
      
      function setValue(headerName, value) {
        const colIdx = headerIndices[headerName];
        if (colIdx !== undefined) {
          rowValues[colIdx - 1] = value;
        }
      }
      
      const expenseId = postData.expenseId || "";
      const nominal = Number(postData.nominal) || 0;
      
      setValue("TANGGAL", postData.tanggalExpense);
      setValue("TANGAL", postData.tanggalExpense);
      setValue("ID", expenseId);
      setValue("ITEM / PRODUK", postData.itemProduk);
      setValue("ITEM/PRODUK", postData.itemProduk);
      setValue("KATEGORI", postData.kategori);
      setValue("NOMINAL", nominal);
      setValue("NET EXPENSE", nominal);
      setValue("CATATAN", postData.catatan || "");
      
      const lastRow = sheet.getLastRow();
      const nextRow = lastRow + 1;
      sheet.getRange(nextRow, 1, 1, lastColumn).setValues([rowValues]);
      
      return createSuccessResponse("Data pengeluaran berhasil disimpan", {
        expenseId: expenseId
      });
      
    } else if (action === "edit_expense") {
      const sheet = activeSpreadsheet.getSheetByName("Pengeluaran");
      if (!sheet) {
        return createErrorResponse("Sheet Pengeluaran tidak ditemukan");
      }
      
      const headerRow = 6;
      const lastRow = sheet.getLastRow();
      const lastColumn = sheet.getLastColumn();
      const headers = sheet.getRange(headerRow, 1, 1, lastColumn).getValues()[0];
      
      const headerIndices = getHeaderIndices(headers);
      const idColIdx = headerIndices["ID"];
      
      if (idColIdx === undefined) {
        return createErrorResponse("Kolom ID tidak ditemukan di sheet Pengeluaran");
      }
      
      const targetId = postData.expenseId;
      if (!targetId) {
        return createErrorResponse("Expense ID kosong");
      }
      
      // Cari baris berdasarkan ID
      let targetRowIdx = -1;
      const idValues = sheet.getRange(headerRow + 1, idColIdx, lastRow - headerRow, 1).getValues();
      for (let i = 0; i < idValues.length; i++) {
        if (idValues[i][0].toString().trim() === targetId.toString().trim()) {
          targetRowIdx = headerRow + 1 + i;
          break;
        }
      }
      
      if (targetRowIdx === -1) {
        return createErrorResponse("Transaksi dengan ID " + targetId + " tidak ditemukan di sheet Pengeluaran");
      }
      
      const rowRange = sheet.getRange(targetRowIdx, 1, 1, lastColumn);
      const rowValues = rowRange.getValues()[0];
      
      function updateValue(headerName, value) {
        const colIdx = headerIndices[headerName];
        if (colIdx !== undefined) {
          rowValues[colIdx - 1] = value;
        }
      }
      
      const nominal = Number(postData.nominal) || 0;
      
      updateValue("TANGGAL", postData.tanggalExpense);
      updateValue("TANGAL", postData.tanggalExpense);
      updateValue("ITEM / PRODUK", postData.itemProduk);
      updateValue("ITEM/PRODUK", postData.itemProduk);
      updateValue("KATEGORI", postData.kategori);
      updateValue("NOMINAL", nominal);
      updateValue("NET EXPENSE", nominal);
      updateValue("CATATAN", postData.catatan);
      
      rowRange.setValues([rowValues]);
      
      return createSuccessResponse("Data pengeluaran berhasil diperbarui");
    }
    
    return createErrorResponse("Action post tidak dikenali");
    
  } catch (error) {
    return createErrorResponse("Error: " + error.toString());
  }
}

function getHeaderIndices(headers) {
  const indices = {};
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i].toString().trim().toUpperCase();
    indices[h] = i + 1;
  }
  return indices;
}

function createSuccessResponse(message, data) {
  const res = {
    status: "success",
    success: true,
    message: message
  };
  if (data) {
    for (let key in data) {
      res[key] = data[key];
    }
  }
  return ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.JSON);
}

function createErrorResponse(message) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "error",
    success: false,
    message: message
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Memetakan nama kolom Pendapatan secara dinamis ke camelCase
 */
function getMapKeyIncome(header) {
  const h = header.toString().trim().toUpperCase();
  switch (h) {
    case "ID":
      return "invoiceNumber";
    case "TANGGAL":
    case "TANGAL":
      return "tanggalInvoice";
    case "CUSTOMER":
      return "customerName";
    case "NOMINAL":
      return "total";
    case "KATEGORI":
      return "paymentMethod";
    default:
      return h.toLowerCase().replace(/[^a-zA-Z0-9]+(.)/g, function(match, chr) {
        return chr.toUpperCase();
      });
  }
}

/**
 * Memetakan nama kolom Pengeluaran secara dinamis ke camelCase
 */
function getMapKeyExpense(header) {
  const h = header.toString().trim().toUpperCase();
  switch (h) {
    case "ID":
      return "expenseId";
    case "TANGGAL":
    case "TANGAL":
      return "tanggalExpense";
    case "ITEM / PRODUK":
    case "ITEM/PRODUK":
      return "itemProduk";
    case "NOMINAL":
      return "nominal";
    case "KATEGORI":
      return "kategori";
    case "CATATAN":
      return "catatan";
    default:
      return h.toLowerCase().replace(/[^a-zA-Z0-9]+(.)/g, function(match, chr) {
        return chr.toUpperCase();
      });
  }
}

/**
 * doPost: Menerima data dari frontend dan menulis ke Spreadsheet.
 * Body dikirim sebagai text/plain yang berisi JSON.
 */
function doPost(e) {
  var output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  try {
    var raw = e.postData && e.postData.contents ? e.postData.contents : "{}";
    var postData = JSON.parse(raw);
    var action = postData.action || "";

    var result;
    switch (action) {
      case "add_income":
        result = handleAddIncome(postData);
        break;
      case "edit_income":
        result = handleEditIncome(postData);
        break;
      case "add_expense":
        result = handleAddExpense(postData);
        break;
      case "edit_expense":
        result = handleEditExpense(postData);
        break;
      default:
        result = { success: false, message: "Unknown action: " + action };
    }

    output.setContent(JSON.stringify(result));
  } catch (err) {
    output.setContent(JSON.stringify({ success: false, message: String(err) }));
  }

  return output;
}

/* ---- INCOME HANDLERS ---- */

function handleAddIncome(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Pendapatan");
  if (!sheet) return { success: false, message: "Sheet Pendapatan tidak ditemukan" };

  var lastColumn = sheet.getLastColumn();
  var headers = sheet.getRange(6, 1, 1, lastColumn).getValues()[0];
  var headerIndices = getHeaderIndices(headers);
  var rowValues = new Array(lastColumn).fill("");

  function setValue(headerName, value) {
    var colIdx = headerIndices[headerName];
    if (colIdx !== undefined) rowValues[colIdx - 1] = value;
  }

  var invoiceNumber = data.invoiceNumber || "";
  var total = Number(data.total) || 0;
  var produkJasa = data.produkJasa || "";
  if (!produkJasa && Array.isArray(data.items)) {
    produkJasa = data.items.map(function(item) {
      return item.nama_barang + " (" + item.jumlah + "x)";
    }).join(", ");
  }

  setValue("TANGGAL",   data.tanggalInvoice);
  setValue("TANGAL",    data.tanggalInvoice);
  setValue("ID",        invoiceNumber);
  setValue("PRODUK/JASA", produkJasa);
  setValue("KATEGORI",  data.paymentMethod);
  setValue("NOMINAL",   total);
  setValue("POTONGAN",  0);
  setValue("FEE",       0);
  setValue("NET INCOME",total);
  setValue("CATATAN",   data.catatan || ("Ditambahkan oleh " + (data.createdBy || "System")));
  setValue("CUSTOMER",  data.customerName);

  sheet.appendRow(rowValues);
  return { success: true, message: "Pendapatan berhasil ditambahkan", invoiceNumber: invoiceNumber };
}

function handleEditIncome(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Pendapatan");
  if (!sheet) return { success: false, message: "Sheet Pendapatan tidak ditemukan" };

  var invoiceNumber = data.invoiceNumber || "";
  var lastRow = sheet.getLastRow();
  var lastColumn = sheet.getLastColumn();
  var headers = sheet.getRange(6, 1, 1, lastColumn).getValues()[0];
  var headerIndices = getHeaderIndices(headers);

  var idColIdx = headerIndices["ID"];
  if (!idColIdx) return { success: false, message: "Kolom ID tidak ditemukan" };

  var dataRange = sheet.getRange(7, idColIdx, lastRow - 6, 1).getValues();
  var targetRow = -1;
  for (var i = 0; i < dataRange.length; i++) {
    if (dataRange[i][0] && dataRange[i][0].toString().trim() === invoiceNumber) {
      targetRow = 7 + i;
      break;
    }
  }

  if (targetRow === -1) return { success: false, message: "Invoice " + invoiceNumber + " tidak ditemukan" };

  var rowValues = sheet.getRange(targetRow, 1, 1, lastColumn).getValues()[0];
  function setValue(headerName, value) {
    var colIdx = headerIndices[headerName];
    if (colIdx !== undefined) rowValues[colIdx - 1] = value;
  }

  var total = Number(data.total) || 0;
  setValue("TANGGAL",    data.tanggalInvoice);
  setValue("TANGAL",     data.tanggalInvoice);
  setValue("PRODUK/JASA",data.produkJasa || "");
  setValue("KATEGORI",   data.paymentMethod);
  setValue("NOMINAL",    total);
  setValue("NET INCOME", total);
  setValue("CATATAN",    data.catatan || "");
  setValue("CUSTOMER",   data.customerName);

  sheet.getRange(targetRow, 1, 1, lastColumn).setValues([rowValues]);
  return { success: true, message: "Pendapatan berhasil diupdate", row: targetRow };
}

/* ---- EXPENSE HANDLERS ---- */

function handleAddExpense(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Pengeluaran");
  if (!sheet) return { success: false, message: "Sheet Pengeluaran tidak ditemukan" };

  var lastColumn = sheet.getLastColumn();
  var headers = sheet.getRange(6, 1, 1, lastColumn).getValues()[0];
  var headerIndices = getHeaderIndices(headers);
  var rowValues = new Array(lastColumn).fill("");

  function setValue(headerName, value) {
    var colIdx = headerIndices[headerName];
    if (colIdx !== undefined) rowValues[colIdx - 1] = value;
  }

  setValue("ID",        data.expenseId || "");
  setValue("TANGGAL",   data.tanggalExpense || "");
  setValue("TANGAL",    data.tanggalExpense || "");
  setValue("ITEM / PRODUK", data.itemProduk || "");
  setValue("ITEM/PRODUK",   data.itemProduk || "");
  setValue("KATEGORI",  data.kategori || "");
  setValue("NOMINAL",   Number(data.nominal) || 0);
  setValue("CATATAN",   data.catatan || "");

  sheet.appendRow(rowValues);
  return { success: true, message: "Pengeluaran berhasil ditambahkan", expenseId: data.expenseId };
}

function handleEditExpense(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Pengeluaran");
  if (!sheet) return { success: false, message: "Sheet Pengeluaran tidak ditemukan" };

  var expenseId = data.expenseId || "";
  var lastRow = sheet.getLastRow();
  var lastColumn = sheet.getLastColumn();
  var headers = sheet.getRange(6, 1, 1, lastColumn).getValues()[0];
  var headerIndices = getHeaderIndices(headers);

  var idColIdx = headerIndices["ID"];
  if (!idColIdx) return { success: false, message: "Kolom ID tidak ditemukan" };

  var dataRange = sheet.getRange(7, idColIdx, lastRow - 6, 1).getValues();
  var targetRow = -1;
  for (var i = 0; i < dataRange.length; i++) {
    if (dataRange[i][0] && dataRange[i][0].toString().trim() === expenseId) {
      targetRow = 7 + i;
      break;
    }
  }

  if (targetRow === -1) return { success: false, message: "ID " + expenseId + " tidak ditemukan" };

  var rowValues = sheet.getRange(targetRow, 1, 1, lastColumn).getValues()[0];
  function setValue(headerName, value) {
    var colIdx = headerIndices[headerName];
    if (colIdx !== undefined) rowValues[colIdx - 1] = value;
  }

  setValue("TANGGAL",   data.tanggalExpense || "");
  setValue("TANGAL",    data.tanggalExpense || "");
  setValue("ITEM / PRODUK", data.itemProduk || "");
  setValue("ITEM/PRODUK",   data.itemProduk || "");
  setValue("KATEGORI",  data.kategori || "");
  setValue("NOMINAL",   Number(data.nominal) || 0);
  setValue("CATATAN",   data.catatan || "");

  sheet.getRange(targetRow, 1, 1, lastColumn).setValues([rowValues]);
  return { success: true, message: "Pengeluaran berhasil diupdate", row: targetRow };
}

/**
 * Helper: buat map header -> column index (1-based)
 */
function getHeaderIndices(headers) {
  var map = {};
  for (var i = 0; i < headers.length; i++) {
    var h = headers[i];
    if (h && h.toString().trim() !== "") {
      map[h.toString().trim().toUpperCase()] = i + 1;
    }
  }
  return map;
}
