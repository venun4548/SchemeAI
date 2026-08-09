/**
 * citizenAPI.gs
 * Endpoints for the Citizen Portal
 */

function getCitizenDashboard(user) {
  const applications = sheetToJSON('Applications').filter(a => a.user_id === user.user_id);
  const notifications = sheetToJSON('Notifications').filter(n => n.user_id === user.user_id);
  
  return {
    success: true,
    profile: {
      name: user.full_name,
      email: user.email,
      state: user.state,
      district: user.district
    },
    profile_completeness: (user.state && user.district && user.income_range) ? 100 : 50,
    active_applications: applications.filter(a => a.status === 'pending' || a.status === 'in_review').length,
    saved_count: 0,
    counts: { high: 2, partial: 1, low: 0 },
    runtime_ms: 45,
    best_match: {
      scheme: { id: 's1', name: 'Digital India Subsidy', ministry: 'MeitY', amount: '₹15,000', category: 'Technology' },
      final_score: 95
    },
    agent_logs: [],
    applications: applications,
    notifications: notifications,
    trace: []
  };
}

function getCitizenEligibility(user) {
  // In a real implementation, we would compare the user's profile to SchemeEligibility rules.
  // For now, we simulate returning the processed data.
  return {
    success: true,
    total_schemes: 24,
    average_score: 68,
    counts: { high: 2, partial: 1, low: 0 },
    top_score: { scheme_id: 's1', scheme_name: 'Digital India Subsidy', score: 95, confidence: 92 },
    items: [
      { id: 's1', name: 'Digital India Subsidy', score: 95 },
      { id: 's2', name: 'PM Kisan Samman Nidhi', score: 88 }
    ]
  };
}

function startQuestionnaire(user) {
  return {
    success: true,
    session: { progress: 10, completed: false },
    question: {
      key: 'income',
      prompt: 'What is your annual household income?',
      hint: 'This helps us find income-based subsidies.',
      kind: 'number',
      min: 0
    }
  };
}

function answerQuestionnaire(user, payload) {
  // Update the user's profile with the answer
  if (payload.key === 'income') {
    updateRecord('Users', 'user_id', user.user_id, { income_range: payload.value });
  }
  
  return {
    success: true,
    progress: 100,
    completed: true,
    answers: { [payload.key]: payload.value }
  };
}

function resetQuestionnaire(user) {
  return startQuestionnaire(user);
}

function getCitizenFamily(user) {
  return {
    success: true,
    items: [
      { id: 'm1', name: 'Demo Spouse', relation: 'Spouse', dob: '1985-06-15', gender: 'Female' },
      { id: 'm2', name: 'Demo Child', relation: 'Child', dob: '2015-02-10', gender: 'Male' }
    ]
  };
}

function getCitizenApplications(user) {
  const applications = sheetToJSON('Applications').filter(a => a.user_id === user.user_id);
  // Join with Schemes to get scheme names
  const schemes = sheetToJSON('Schemes');
  
  const items = applications.map(app => {
    const scheme = schemes.find(s => s.scheme_id === app.scheme_id);
    return {
      ...app,
      scheme_name: scheme ? scheme.scheme_name : 'Unknown Scheme'
    };
  });
  
  return {
    success: true,
    items: items,
    total: items.length
  };
}

function getCitizenOffices(user) {
  return {
    success: true,
    items: [
      { id: 'o1', name: 'Central District Office', address: '123 Main St', contact: '1800-111-222', type: 'Regional' }
    ]
  };
}
