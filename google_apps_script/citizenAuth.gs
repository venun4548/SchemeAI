/**
 * citizenAuth.gs
 * Authentication logic for Citizens
 */

function citizenRegister(email, password, fullName) {
  const users = sheetToJSON('Users');
  const existingUser = users.find(u => u.email === email);
  
  if (existingUser) {
    return { success: false, message: 'Email is already registered' };
  }
  
  const userId = 'USR-' + Utilities.getUuid().substring(0, 8);
  const now = new Date().toISOString();
  
  const newUser = {
    user_id: userId,
    full_name: fullName,
    email: email,
    phone: '',
    password_hash: hashPassword(password),
    state: '',
    district: '',
    occupation: '',
    income_range: '',
    created_at: now,
    updated_at: now,
    status: 'ACTIVE',
    last_login: now
  };
  
  addRecord('Users', newUser);
  
  // Create an authentication token
  const token = generateToken();
  const tokensSheet = getSheet('Tokens');
  if (tokensSheet.getLastRow() === 0) {
    tokensSheet.appendRow(['token', 'user_id', 'role', 'created_at']);
  }
  tokensSheet.appendRow([token, userId, 'CITIZEN', now]);
  
  return {
    success: true,
    token: token,
    user: {
      id: userId,
      full_name: fullName,
      email: email,
      role: 'citizen'
    }
  };
}

function citizenLogin(email, password) {
  const users = sheetToJSON('Users');
  const user = users.find(u => u.email === email);
  
  if (!user) {
    return { success: false, message: 'Invalid credentials' };
  }
  
  if (user.status !== 'ACTIVE') {
    return { success: false, message: 'Account is inactive' };
  }
  
  const hashedInput = hashPassword(password);
  
  if (user.password_hash !== hashedInput) {
    return { success: false, message: 'Invalid credentials' };
  }
  
  const token = generateToken();
  const now = new Date().toISOString();
  
  const tokensSheet = getSheet('Tokens');
  if (tokensSheet.getLastRow() === 0) {
    tokensSheet.appendRow(['token', 'user_id', 'role', 'created_at']);
  }
  tokensSheet.appendRow([token, user.user_id, 'CITIZEN', now]);
  
  updateRecord('Users', 'user_id', user.user_id, {
    last_login: now
  });
  
  return {
    success: true,
    token: token,
    user: {
      id: user.user_id,
      full_name: user.full_name,
      email: user.email,
      role: 'citizen'
    }
  };
}

function verifyCitizenSession(token) {
  if (!token) return null;
  const tokens = sheetToJSON('Tokens');
  const session = tokens.find(t => t.token === token && t.role === 'CITIZEN');
  
  if (session) {
    const users = sheetToJSON('Users');
    return users.find(u => u.user_id === session.user_id);
  }
  return null;
}
