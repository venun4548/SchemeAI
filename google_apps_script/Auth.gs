/**
 * Auth.gs
 * Authentication and Authorization logic
 */

function hashPassword(password) {
  const signature = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password);
  return signature.map(function(e) {
    let v = (e < 0 ? e + 256 : e).toString(16);
    return v.length == 1 ? "0" + v : v;
  }).join("");
}

function generateToken() {
  return Utilities.getUuid();
}

function adminLogin(email, password) {
  const admins = sheetToJSON('Admins');
  const admin = admins.find(a => a.email === email);
  
  if (!admin) {
    return { success: false, message: 'Invalid credentials' };
  }
  
  if (admin.status !== 'ACTIVE') {
    return { success: false, message: 'Account is inactive' };
  }
  
  const hashedInput = hashPassword(password);
  
  if (admin.password_hash !== hashedInput) {
    return { success: false, message: 'Invalid credentials' };
  }
  
  const token = generateToken();
  const now = new Date().toISOString();
  
  updateRecord('Admins', 'admin_id', admin.admin_id, {
    token: token,
    last_login: now
  });
  
  createAuditLog(admin.admin_id, admin.role, 'LOGIN', 'ADMIN', admin.admin_id, null, { login_time: now }, null);
  
  return {
    success: true,
    token: token,
    admin: {
      admin_id: admin.admin_id,
      full_name: admin.full_name,
      email: admin.email,
      role: admin.role
    }
  };
}

function verifyAdminSession(token) {
  if (!token) return null;
  const admins = sheetToJSON('Admins');
  return admins.find(a => a.token === token);
}

function hasPermission(admin, requiredPermission) {
  if (admin.role === 'SUPER_ADMIN') return true;
  
  const roles = sheetToJSON('Roles');
  const roleObj = roles.find(r => r.role_name === admin.role);
  if (!roleObj) return false;
  
  const permissions = roleObj.permissions.split(',').map(p => p.trim());
  return permissions.includes(requiredPermission) || permissions.includes('all');
}
