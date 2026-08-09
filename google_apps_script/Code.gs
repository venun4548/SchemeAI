/**
 * Code.gs
 * Main entry point for HTTP requests.
 */

function doGet(e) {
  return handleRequest('GET', e);
}

function doPost(e) {
  return handleRequest('POST', e);
}

function handleRequest(method, e) {
  let response = { success: false, message: 'Unknown request' };
  
  try {
    const params = e.parameter;
    const action = params.action;
    
    // Parse POST body if exists
    let payload = {};
    if (method === 'POST' && e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    }

    // Public Actions
    if (action === 'adminLogin') {
      response = adminLogin(payload.email, payload.password);
      return sendJsonResponse(response);
    }
    
    if (action === 'registerUser') {
      response = citizenRegister(payload.email, payload.password, payload.full_name);
      return sendJsonResponse(response);
    }
    
    if (action === 'loginUser') {
      response = citizenLogin(payload.email, payload.password);
      return sendJsonResponse(response);
    }
    
    if (action === 'setupDatabase') {
      response = setupDatabase();
      return sendJsonResponse(response);
    }

    // Public sheet-sync bridge used by the FastAPI backend (no auth required).
    // body: { sheet, id_column?, record }  -> appends/updates one row.
    if (action === 'syncRecord') {
      response = syncRecordToSheet(
        payload.sheet || params.sheet,
        payload.id_column || params.id_column || '',
        payload.record || {}
      );
      return sendJsonResponse(response);
    }

    // Public diagnostics: reports exactly which spreadsheet the script writes to
    // and the current row count for a sheet (no auth required).
    if (action === 'syncDiagnostics') {
      response = getSyncDiagnostics(payload.sheet || params.sheet || 'Users');
      return sendJsonResponse(response);
    }

    // Public verify: does a given id exist in a sheet, plus the file's tab list.
    if (action === 'syncVerify') {
      response = verifyRecord(payload.sheet || params.sheet || 'Users', payload.id_column || params.id_column || '', payload.id_value || params.id_value || '');
      return sendJsonResponse(response);
    }

    // Public self-test: append + readback inside a SINGLE execution to prove the
    // write path works end-to-end.
    if (action === 'syncSelfTest') {
      response = selfTest();
      return sendJsonResponse(response);
    }

    // Authenticated Actions
    const token = params.token || payload.token;
    
    // Check if token belongs to an admin or a citizen.
    // Defensive: functions live in Auth.gs / citizenAuth.gs - guard in case a
    // deployment is missing those files so public actions still work.
    let admin = null;
    let citizen = null;
    try { admin = typeof verifyAdminSession === 'function' ? verifyAdminSession(token) : null; } catch (err) { admin = null; }
    try { citizen = typeof verifyCitizenSession === 'function' ? verifyCitizenSession(token) : null; } catch (err) { citizen = null; }
    
    if (!admin && !citizen) {
      return sendJsonResponse({ success: false, error: 'Unauthorized', status: 401 });
    }

    switch(action) {
      // --- ADMIN ACTIONS ---
      case 'getAdminUsers':
        if (!admin) throw new Error('Unauthorized');
        response = getAdminUsers(admin, params);
        break;
      case 'getApplications':
        if (!admin) throw new Error('Unauthorized');
        response = getApplications(admin, params);
        break;
      case 'updateApplicationStatus':
        if (!admin) throw new Error('Unauthorized');
        response = updateApplicationStatus(admin, payload);
        break;
      case 'getSchemes':
        if (!admin) throw new Error('Unauthorized');
        response = getSchemes(admin, params);
        break;
      case 'createScheme':
        if (!admin) throw new Error('Unauthorized');
        response = createScheme(admin, payload);
        break;
      case 'publishScheme':
        if (!admin) throw new Error('Unauthorized');
        response = publishScheme(admin, payload);
        break;
      case 'getSupportCases':
        if (!admin) throw new Error('Unauthorized');
        response = getSupportCases(admin, params);
        break;
      case 'getDashboardStatistics':
        if (!admin) throw new Error('Unauthorized');
        response = getDashboardStatistics(admin);
        break;
      case 'getAuditLogs':
        if (!admin) throw new Error('Unauthorized');
        response = getAuditLogs(admin);
        break;
        
      // --- CITIZEN ACTIONS ---
      case 'dashboard/home':
        if (!citizen) throw new Error('Unauthorized');
        response = getCitizenDashboard(citizen);
        break;
      case 'profile/eligibility':
      case 'eligibility/score':
        if (!citizen) throw new Error('Unauthorized');
        response = getCitizenEligibility(citizen);
        break;
      case 'questionnaire/start':
        if (!citizen) throw new Error('Unauthorized');
        response = startQuestionnaire(citizen);
        break;
      case 'questionnaire/answer':
        if (!citizen) throw new Error('Unauthorized');
        response = answerQuestionnaire(citizen, payload);
        break;
      case 'questionnaire/reset':
        if (!citizen) throw new Error('Unauthorized');
        response = resetQuestionnaire(citizen);
        break;
      case 'profile/family':
        if (!citizen) throw new Error('Unauthorized');
        response = getCitizenFamily(citizen);
        break;
      case 'applications':
        if (!citizen) throw new Error('Unauthorized');
        response = getCitizenApplications(citizen);
        break;
      case 'offices':
        if (!citizen) throw new Error('Unauthorized');
        response = getCitizenOffices(citizen);
        break;
        
      default:
        response = { success: false, error: 'Invalid action' };
    }
  } catch (error) {
    response = { success: false, error: error.toString() };
  }
  
  return sendJsonResponse(response);
}

function sendJsonResponse(data) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

/**
 * Append-or-update one row in a sheet (used by the FastAPI sync bridge).
 * If idColumn is provided and a row already has that id, the row is updated;
 * otherwise a new row is appended.
 */
function syncRecordToSheet(sheetName, idColumn, record) {
  if (!sheetName || !record || typeof record !== 'object') {
    return { success: false, message: 'Missing sheet name or record', sheet: sheetName };
  }
  const ss = getDatabaseSpreadsheet();
  getSheet(sheetName); // ensures the sheet + header row exist
  if (idColumn && record[idColumn] !== undefined && record[idColumn] !== null && record[idColumn] !== '') {
    const idVal = String(record[idColumn]);
    const existing = getRecordById(sheetName, idColumn, idVal);
    if (existing) {
      updateRecord(sheetName, idColumn, idVal, record);
      return { success: true, updated: true, sheet: sheetName, spreadsheet_id: ss.getId() };
    }
  }
  addRecord(sheetName, record);

  // Same-execution readback (like selfTest): report what THIS execution sees.
  const after = getSheet(sheetName);
  const allRows = after.getDataRange().getValues();
  const idColLc = String(idColumn || '').toLowerCase();
  const idIdx = after.getLastColumn() >= 1 ? (allRows[0] || []).findIndex(h => String(h).toLowerCase() === idColLc) : -1;
  const readback = { rows_after: allRows.length, found: false, row: null };
  if (idIdx >= 0 && idColumn && record[idColumn] !== undefined) {
    const target = String(record[idColumn]);
    const hit = allRows.find(r => String(r[idIdx]) === target);
    readback.found = !!hit;
    readback.row = hit ? hit.map(c => String(c)).join(' | ') : null;
  }

  // List every matching file in THIS execution too.
  const files = [];
  const it = DriveApp.getFilesByName(DB_NAME);
  while (it.hasNext()) {
    const f = it.next();
    files.push({ id: f.getId(), name: f.getName(), url: f.getUrl() });
  }

  return {
    success: true,
    updated: false,
    sheet: sheetName,
    spreadsheet_id: ss.getId(),
    readback: readback,
    matching_files_this_execution: files
  };
}

/**
 * Public diagnostics: which spreadsheet ID/URL the script writes to, the Users
 * row count, and the last synced user email (if any).
 */
function getSyncDiagnostics(sheetName) {
  const ss = getDatabaseSpreadsheet();
  const sheet = ss.getSheetByName(sheetName || 'Users');
  const lastRow = sheet ? sheet.getLastRow() : 0;
  const lastEmail = lastRow > 1 ? sheet.getRange(lastRow, 4).getValue() : '';

  // List every tab so we can confirm which one is "Users".
  const tabs = [];
  ss.getSheets().forEach(s => tabs.push({ name: s.getName(), rows: s.getLastRow(), cols: s.getLastColumn() }));

  // Dump first few data rows so we can see what's actually in the sheet.
  const sample = [];
  if (sheet && lastRow > 1) {
    const rows = sheet.getRange(2, 1, Math.min(lastRow - 1, 5), sheet.getLastColumn()).getValues();
    rows.forEach(r => sample.push(r.map(cell => String(cell)).join(' | ')));
  }

  // List every file matching the database name so we can detect duplicates.
  const files = [];
  const it = DriveApp.getFilesByName(DB_NAME);
  while (it.hasNext()) {
    const f = it.next();
    files.push({ id: f.getId(), name: f.getName(), mime: f.getMimeType(), url: f.getUrl() });
  }

  return {
    success: true,
    spreadsheet_id: ss.getId(),
    spreadsheet_name: ss.getName(),
    spreadsheet_url: ss.getUrl(),
    sheet: (sheetName || 'Users'),
    sheet_rows: lastRow,
    last_row_column4: String(lastEmail),
    tabs: tabs,
    sample_rows: sample,
    matching_files: files
  };
}

function verifyRecord(sheetName, idColumn, idValue) {
  const ss = getDatabaseSpreadsheet();
  const found = idColumn && idValue ? getRecordById(sheetName, idColumn, idValue) : null;
  return {
    success: true,
    spreadsheet_id: ss.getId(),
    spreadsheet_url: ss.getUrl(),
    sheet: sheetName,
    id_column: idColumn,
    id_value: idValue,
    found: !!found,
    record: found || null
  };
}

/**
 * End-to-end self test in ONE execution: create a scratch sheet, append a row,
 * read it back, and report the spreadsheet the whole thing ran against.
 */
function selfTest() {
  const ss = getDatabaseSpreadsheet();
  const probeId = 'probe-' + new Date().getTime();
  const sheetName = 'SyncProbe';

  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(['probe_id', 'note']);
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const rowData = headers.map(h => h === 'probe_id' ? probeId : (h === 'note' ? 'self-test' : ''));
  sheet.appendRow(rowData);

  // Read back within the same execution.
  const data = sheet.getDataRange().getValues();
  const found = data.find(r => r[0] === probeId);

  // Deep probe: dump the Users sheet header as the script sees it, and run
  // addRecord directly on Users to see whether THAT path persists.
  const usersSheet = ss.getSheetByName('Users');
  const usersHeaders = usersSheet ? usersSheet.getRange(1, 1, 1, usersSheet.getLastColumn()).getValues()[0] : [];
  let usersAddResult = null;
  if (usersSheet) {
    const testUid = 'selftest-' + probeId;
    addRecord('Users', { user_id: testUid, full_name: 'SelfTest', email: testUid + '@t.in', phone: '1', status: 'active' });
    const usersData = usersSheet.getDataRange().getValues();
    usersAddResult = {
      rows_after: usersData.length,
      found: !!usersData.find(r => String(r[0]) === testUid)
    };
  }

  return {
    success: true,
    spreadsheet_id: ss.getId(),
    spreadsheet_url: ss.getUrl(),
    sheet: sheetName,
    probe_id: probeId,
    appended: true,
    readback_found: !!found,
    readback_row: found ? found.join(' | ') : null,
    rows_after: sheet.getLastRow(),
    users_headers: usersHeaders.map(String),
    users_add_result: usersAddResult
  };
}
