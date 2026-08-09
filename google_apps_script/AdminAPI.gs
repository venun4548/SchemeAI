/**
 * AdminAPI.gs
 * API Endpoints for the Admin Portal
 */

// User Management
function getAdminUsers(admin, params) {
  if (!hasPermission(admin, 'users.view')) {
    return { success: false, error: 'Forbidden' };
  }
  return { success: true, data: sheetToJSON('Users') };
}

// Applications
function getApplications(admin, params) {
  if (!hasPermission(admin, 'applications.view')) {
    return { success: false, error: 'Forbidden' };
  }
  return { success: true, data: sheetToJSON('Applications') };
}

function updateApplicationStatus(admin, payload) {
  if (!hasPermission(admin, 'applications.review')) {
    return { success: false, error: 'Forbidden' };
  }
  
  const { application_id, status } = payload;
  const oldApp = getRecordById('Applications', 'application_id', application_id);
  if (!oldApp) return { success: false, error: 'Application not found' };
  
  const updated = updateRecord('Applications', 'application_id', application_id, {
    status: status,
    updated_at: new Date().toISOString()
  });
  
  createAuditLog(admin.admin_id, admin.role, 'APPLICATION_STATUS_CHANGED', 'APPLICATION', application_id, oldApp.status, status, null);
  
  return { success: true, data: updated };
}

// Schemes
function getSchemes(admin, params) {
  // Wait, does everyone need to view schemes? Assuming yes if they are in the portal or specifically SCHEME_ADMIN
  return { success: true, data: sheetToJSON('Schemes') };
}

function createScheme(admin, payload) {
  if (!hasPermission(admin, 'schemes.create')) {
    return { success: false, error: 'Forbidden' };
  }
  
  const scheme = {
    scheme_id: 'SCH-' + Utilities.getUuid().split('-')[0].toUpperCase(),
    ...payload,
    status: 'DRAFT',
    created_by: admin.admin_id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  const created = addRecord('Schemes', scheme);
  createAuditLog(admin.admin_id, admin.role, 'SCHEME_CREATED', 'SCHEME', scheme.scheme_id, null, scheme.scheme_name, null);
  
  return { success: true, data: created };
}

function publishScheme(admin, payload) {
  if (!hasPermission(admin, 'schemes.publish')) {
    return { success: false, error: 'Forbidden' };
  }
  const { scheme_id } = payload;
  const oldScheme = getRecordById('Schemes', 'scheme_id', scheme_id);
  
  const updated = updateRecord('Schemes', 'scheme_id', scheme_id, {
    status: 'PUBLISHED',
    published_by: admin.admin_id,
    published_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });
  
  createAuditLog(admin.admin_id, admin.role, 'SCHEME_PUBLISHED', 'SCHEME', scheme_id, oldScheme.status, 'PUBLISHED', null);
  
  // Create scheme version record
  addRecord('SchemeVersions', {
    version_id: Utilities.getUuid(),
    scheme_id: scheme_id,
    version_number: Date.now(),
    changed_by: admin.admin_id,
    changes: JSON.stringify(oldScheme),
    created_at: new Date().toISOString()
  });
  
  return { success: true, data: updated };
}

// Support Cases
function getSupportCases(admin, params) {
  if (!hasPermission(admin, 'support.view')) {
    return { success: false, error: 'Forbidden' };
  }
  return { success: true, data: sheetToJSON('SupportCases') };
}

// Analytics
function getDashboardStatistics(admin) {
  const apps = sheetToJSON('Applications');
  const docs = sheetToJSON('Documents');
  const cases = sheetToJSON('SupportCases');
  const schemes = sheetToJSON('Schemes');
  const incidents = sheetToJSON('AIIncidents');
  const audits = sheetToJSON('AuditLogs');
  
  const stats = {
    queues: {
      pending_review: apps.filter(a => a.status === 'UNDER_REVIEW').length,
      submitted: apps.filter(a => a.status === 'SUBMITTED').length,
      assigned_to_me: apps.filter(a => a.assigned_admin === admin.admin_id).length,
      documents_pending: docs.filter(d => d.status === 'PENDING').length,
      high_risk_documents: docs.filter(d => d.status === 'PENDING' && d.risk_level === 'HIGH').length,
      open_cases: cases.filter(c => c.status === 'OPEN').length,
      escalated_cases: cases.filter(c => c.status === 'ESCALATED').length,
      overdue_sla: cases.filter(c => c.status === 'OVERDUE').length,
      pending_publications: schemes.filter(s => s.status === 'DRAFT').length,
      open_incidents: incidents.filter(i => i.status === 'OPEN').length,
      open_feedback: 0
    },
    recent_audit: audits.slice(-5).map(a => ({
      id: a.audit_id,
      action: a.action,
      entity: a.entity_type,
      entity_name: a.entity_id,
      actor_name: 'Admin ' + a.admin_id,
      created_at: a.timestamp,
      result: 'success'
    })).reverse(),
    recent_cases: cases.slice(-5).map(c => ({
      id: c.case_id,
      subject: c.subject,
      case_ref: c.case_id.substring(0,8),
      updated_at: c.updated_at,
      status: c.status
    })).reverse(),
    now: new Date().toISOString()
  };
  
  return { success: true, data: stats };
}

function getAuditLogs(admin) {
  if (admin.role !== 'SUPER_ADMIN' && admin.role !== 'OPERATIONS_ADMIN') {
    return { success: false, error: 'Forbidden' };
  }
  return { success: true, data: sheetToJSON('AuditLogs') };
}
