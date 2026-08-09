/**
 * Database.gs
 * Handles interacting with the Google Sheet.
 */

// Name of the primary database spreadsheet (will be created if missing)
const DB_NAME = 'SCHEMEAI_DATABASE';

const SHEET_NAMES = [
  'Users', 'Admins', 'Roles', 'Schemes', 'SchemeEligibility',
  'Applications', 'Documents', 'SupportCases', 'SupportMessages',
  'AIRecommendations', 'AIIncidents', 'AIAgentLogs', 'Notifications',
  'ContentReviews', 'SchemeVersions', 'AuditLogs', 'SystemSettings'
];

const COLUMNS = {
  Users: ['user_id', 'full_name', 'phone', 'email', 'password_hash', 'state', 'district', 'occupation', 'income_range', 'created_at', 'updated_at', 'status', 'last_login'],
  Admins: ['admin_id', 'full_name', 'email', 'phone', 'password_hash', 'role', 'status', 'created_at', 'last_login', 'token'],
  Roles: ['role_id', 'role_name', 'description', 'permissions'],
  Schemes: ['scheme_id', 'scheme_name', 'description', 'category', 'government_level', 'state', 'district', 'benefit', 'eligibility_summary', 'required_documents', 'official_url', 'status', 'created_by', 'reviewed_by', 'published_by', 'created_at', 'updated_at', 'published_at'],
  SchemeEligibility: ['rule_id', 'scheme_id', 'field', 'operator', 'value', 'priority', 'created_at'],
  Applications: ['application_id', 'user_id', 'scheme_id', 'status', 'assigned_admin', 'submitted_at', 'updated_at', 'decision', 'decision_reason', 'priority'],
  Documents: ['document_id', 'application_id', 'user_id', 'document_type', 'document_url', 'status', 'verified_by', 'rejection_reason', 'uploaded_at', 'verified_at'],
  SupportCases: ['case_id', 'user_id', 'subject', 'category', 'description', 'priority', 'status', 'assigned_agent', 'created_at', 'updated_at', 'resolved_at'],
  SupportMessages: ['message_id', 'case_id', 'sender_id', 'sender_type', 'message', 'created_at'],
  AIRecommendations: ['recommendation_id', 'user_id', 'scheme_id', 'agent_name', 'eligibility_score', 'reason', 'confidence', 'created_at'],
  AIIncidents: ['incident_id', 'agent_name', 'severity', 'error_message', 'status', 'created_at', 'resolved_at', 'resolved_by', 'resolution'],
  AIAgentLogs: ['execution_id', 'agent_name', 'user_id', 'request_id', 'status', 'execution_time', 'latency', 'error', 'created_at'],
  Notifications: ['notification_id', 'user_id', 'type', 'title', 'message', 'read_status', 'created_at'],
  ContentReviews: ['review_id', 'scheme_id', 'reviewer_id', 'content_type', 'status', 'comments', 'created_at', 'reviewed_at'],
  SchemeVersions: ['version_id', 'scheme_id', 'version_number', 'changed_by', 'changes', 'created_at'],
  AuditLogs: ['audit_id', 'admin_id', 'role', 'action', 'entity_type', 'entity_id', 'old_value', 'new_value', 'ip_address', 'timestamp'],
  SystemSettings: ['setting_key', 'setting_value', 'updated_at']
};

function getDatabaseSpreadsheet() {
  const files = DriveApp.getFilesByName(DB_NAME);
  if (files.hasNext()) {
    return SpreadsheetApp.open(files.next());
  } else {
    return SpreadsheetApp.create(DB_NAME);
  }
}

function getSheet(sheetName) {
  const ss = getDatabaseSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    if (COLUMNS[sheetName]) {
      sheet.appendRow(COLUMNS[sheetName]);
      // Freeze header row
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

function setupDatabase() {
  const ss = getDatabaseSpreadsheet();
  SHEET_NAMES.forEach(name => {
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      if (COLUMNS[name]) {
        sheet.appendRow(COLUMNS[name]);
        sheet.setFrozenRows(1);
      }
    }
  });
  
  // Create default roles if not exist
  const roleSheet = getSheet('Roles');
  if (roleSheet.getLastRow() <= 1) {
    const roles = [
      ['SUPER_ADMIN', 'Super Admin', 'Full access', 'all'],
      ['OPERATIONS_ADMIN', 'Operations Admin', 'Manage applications', 'applications.view,applications.review,documents.view,documents.verify,support.view,analytics.view,audit.view'],
      ['SCHEME_ADMIN', 'Scheme Admin', 'Manage schemes', 'schemes.view,schemes.create,schemes.edit,schemes.review,schemes.publish,schemes.archive'],
      ['CONTENT_REVIEWER', 'Content Reviewer', 'Review scheme content', 'content.review,content.approve'],
      ['SUPPORT_AGENT', 'Support Agent', 'Handle support cases', 'support.view,support.create,support.assign,support.resolve'],
      ['AI_OPERATIONS', 'AI Operations', 'Manage AI', 'ai.view,ai.retry,ai.pause,ai.resume'],
      ['ANALYST', 'Analyst', 'View analytics', 'reports.view,reports.export,analytics.view']
    ];
    roles.forEach(role => {
       const roleId = Utilities.getUuid();
       roleSheet.appendRow([roleId, role[0], role[1], role[2]]);
    });
  }

  // Create test admins
  const adminSheet = getSheet('Admins');
  if (adminSheet.getLastRow() <= 1) {
    const defaultPasswordHash = hashPassword('password123'); // Simple testing hash
    const admins = [
      ['ADM-001', 'Super Admin User', 'superadmin@test.local', '9999999999', defaultPasswordHash, 'SUPER_ADMIN', 'ACTIVE', new Date().toISOString(), '', ''],
      ['ADM-002', 'Operations Admin User', 'operations@test.local', '9999999998', defaultPasswordHash, 'OPERATIONS_ADMIN', 'ACTIVE', new Date().toISOString(), '', ''],
      ['ADM-003', 'Scheme Admin User', 'scheme@test.local', '9999999997', defaultPasswordHash, 'SCHEME_ADMIN', 'ACTIVE', new Date().toISOString(), '', ''],
      ['ADM-004', 'Content Reviewer User', 'reviewer@test.local', '9999999996', defaultPasswordHash, 'CONTENT_REVIEWER', 'ACTIVE', new Date().toISOString(), '', ''],
      ['ADM-005', 'Support Agent User', 'support@test.local', '9999999995', defaultPasswordHash, 'SUPPORT_AGENT', 'ACTIVE', new Date().toISOString(), '', ''],
      ['ADM-006', 'AI Ops User', 'aiops@test.local', '9999999994', defaultPasswordHash, 'AI_OPERATIONS', 'ACTIVE', new Date().toISOString(), '', ''],
      ['ADM-007', 'Analyst User', 'analyst@test.local', '9999999993', defaultPasswordHash, 'ANALYST', 'ACTIVE', new Date().toISOString(), '', '']
    ];
    admins.forEach(admin => adminSheet.appendRow(admin));
  }

  return { success: true, message: "Database initialized successfully" };
}

// Convert sheet data to JSON array of objects
function sheetToJSON(sheetName) {
  const sheet = getSheet(sheetName);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  
  const headers = data[0];
  const result = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = row[j];
    }
    // Only include rows where the first ID column is not empty
    if (obj[headers[0]]) {
      result.push(obj);
    }
  }
  return result;
}

// Get single record by ID (case-insensitive on column names)
function getRecordById(sheetName, idColumnName, idValue) {
  const records = sheetToJSON(sheetName);
  const lc = String(idColumnName || '').toLowerCase();
  return records.find(r => {
    const key = Object.keys(r).find(k => k.toLowerCase() === lc);
    return key !== undefined && String(r[key]) === String(idValue);
  });
}

// Add a new record (header matching is case-insensitive)
function addRecord(sheetName, recordObj) {
  const sheet = getSheet(sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const lcObj = {};
  Object.keys(recordObj).forEach(k => { lcObj[k.toLowerCase()] = recordObj[k]; });
  const rowData = headers.map(header => lcObj[String(header).toLowerCase()] !== undefined ? lcObj[String(header).toLowerCase()] : '');
  sheet.appendRow(rowData);
  return recordObj;
}

// Update an existing record (header matching is case-insensitive)
function updateRecord(sheetName, idColumnName, idValue, updateObj) {
  const sheet = getSheet(sheetName);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return null;
  
  const headers = data[0];
  const idCol = String(idColumnName || '').toLowerCase();
  const idIndex = headers.findIndex(h => String(h).toLowerCase() === idCol);
  if (idIndex === -1) return null;
  
  const lcUpdate = {};
  Object.keys(updateObj).forEach(k => { lcUpdate[k.toLowerCase()] = updateObj[k]; });
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idIndex]) === String(idValue)) {
      // Found the row, update cells
      headers.forEach((header, colIndex) => {
        const value = lcUpdate[String(header).toLowerCase()];
        if (value !== undefined) {
          sheet.getRange(i + 1, colIndex + 1).setValue(value);
        }
      });
      return getRecordById(sheetName, idColumnName, idValue);
    }
  }
  return null;
}

// Create an audit log
function createAuditLog(adminId, role, action, entityType, entityId, oldValue, newValue, ipAddress) {
  const log = {
    audit_id: Utilities.getUuid(),
    admin_id: adminId,
    role: role,
    action: action,
    entity_type: entityType,
    entity_id: entityId,
    old_value: JSON.stringify(oldValue),
    new_value: JSON.stringify(newValue),
    ip_address: ipAddress || 'unknown',
    timestamp: new Date().toISOString()
  };
  addRecord('AuditLogs', log);
}
