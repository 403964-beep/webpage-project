/**
 * Admin Dashboard JavaScript for Kiyan Rackley's Website
 */

let adminToken = sessionStorage.getItem('admin_session_token') || null;
let contactMessages = [];
let activeFilter = 'all'; // 'all', 'new', 'replied'
let reasonsChart = null;

document.addEventListener('DOMContentLoaded', () => {
  setupAuthForm();
  setupFilterControls();
  setupAdminPhotoUpload();

  // If already authenticated in current session, show dashboard
  if (adminToken) {
    showDashboard();
    fetchMessages();
  }
});

/**
 * Admin Authentication
 */
function setupAuthForm() {
  const loginForm = document.getElementById('admin-login-form');
  const passwordInput = document.getElementById('admin-password-input');
  const loginError = document.getElementById('login-error-message');
  const logoutBtn = document.getElementById('admin-logout-btn');

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (loginError) loginError.style.display = 'none';

      const password = passwordInput?.value;
      if (!password) {
        if (loginError) {
          loginError.textContent = 'Please enter the Admin password.';
          loginError.style.display = 'block';
        }
        return;
      }

      try {
        const response = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        });

        const data = await response.json();

        if (response.ok && data.token) {
          adminToken = data.token;
          // Store session token (NOT the password) in sessionStorage
          sessionStorage.setItem('admin_session_token', adminToken);
          passwordInput.value = '';
          showDashboard();
          fetchMessages();
        } else {
          if (loginError) {
            loginError.textContent = data.error || 'Incorrect admin password.';
            loginError.style.display = 'block';
          }
        }
      } catch (err) {
        console.error('Login error:', err);
        if (loginError) {
          loginError.textContent = 'Network error during login.';
          loginError.style.display = 'block';
        }
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await fetch('/api/admin/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${adminToken}`,
          },
        });
      } catch (err) {
        // Continue logout even if network fails
      }
      adminToken = null;
      sessionStorage.removeItem('admin_session_token');
      hideDashboard();
    });
  }
}

function showDashboard() {
  const authSection = document.getElementById('admin-auth-section');
  const dashSection = document.getElementById('admin-dashboard-section');
  if (authSection) authSection.style.display = 'none';
  if (dashSection) {
    dashSection.style.display = 'block';
    dashSection.classList.add('visible');
  }
}

function hideDashboard() {
  const authSection = document.getElementById('admin-auth-section');
  const dashSection = document.getElementById('admin-dashboard-section');
  if (authSection) authSection.style.display = 'block';
  if (dashSection) {
    dashSection.style.display = 'none';
    dashSection.classList.remove('visible');
  }
  contactMessages = [];
}

/**
 * Retrieve messages from server
 */
async function fetchMessages() {
  if (!adminToken) return;

  try {
    const response = await fetch('/api/admin/messages', {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
      },
    });

    if (response.status === 401) {
      alert('Session expired or unauthorized. Please log in again.');
      adminToken = null;
      sessionStorage.removeItem('admin_session_token');
      hideDashboard();
      return;
    }

    if (!response.ok) {
      throw new Error('Failed to load messages');
    }

    contactMessages = await response.json();
    updateDashboardMetrics();
    renderMessagesTable();
    updateChart();
  } catch (err) {
    console.error('Failed to fetch contact messages:', err);
  }
}

/**
 * Filter Buttons Setup
 */
function setupFilterControls() {
  const filterBtns = document.querySelectorAll('.filter-btn');
  filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter || 'all';
      renderMessagesTable();
    });
  });

  const refreshBtn = document.getElementById('refresh-messages-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      fetchMessages();
    });
  }
}

/**
 * Update Summary Metrics
 */
function updateDashboardMetrics() {
  const totalElem = document.getElementById('metric-total-messages');
  const newElem = document.getElementById('metric-new-messages');
  const repliedElem = document.getElementById('metric-replied-messages');
  const rateElem = document.getElementById('metric-reply-rate');

  const total = contactMessages.length;
  const newCount = contactMessages.filter((m) => !m.replied).length;
  const repliedCount = contactMessages.filter((m) => m.replied).length;
  const rate = total > 0 ? ((repliedCount / total) * 100).toFixed(1) : '0.0';

  if (totalElem) totalElem.textContent = total;
  if (newElem) newElem.textContent = newCount;
  if (repliedElem) repliedElem.textContent = repliedCount;
  if (rateElem) rateElem.textContent = `${rate}%`;
}

/**
 * Render Messages Table
 */
function renderMessagesTable() {
  const tbody = document.getElementById('messages-table-body');
  const emptyState = document.getElementById('table-empty-state');
  if (!tbody) return;

  // Filter messages
  let filtered = [...contactMessages];
  if (activeFilter === 'new') {
    filtered = filtered.filter((m) => !m.replied);
  } else if (activeFilter === 'replied') {
    filtered = filtered.filter((m) => m.replied);
  }

  tbody.innerHTML = '';

  if (filtered.length === 0) {
    if (emptyState) emptyState.style.display = 'block';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';

  filtered.forEach((msg) => {
    const tr = document.createElement('tr');
    tr.id = `message-row-${msg.id}`;

    const dateStr = new Date(msg.submittedAt).toLocaleDateString();
    const timeStr = new Date(msg.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    tr.innerHTML = `
      <td>
        <strong>${escapeHtml(msg.firstName)} ${escapeHtml(msg.lastName)}</strong><br>
        <small style="color: var(--text-muted);">${escapeHtml(msg.email)}</small>
      </td>
      <td>
        <span class="reason-pill" style="display:inline-block; padding: 0.2rem 0.6rem; border-radius: 4px; background: var(--bg-main); font-size: 0.8rem; font-weight:600;">
          ${escapeHtml(msg.reason)}
        </span>
      </td>
      <td style="max-width: 320px; word-break: break-word;">
        ${escapeHtml(msg.message)}
      </td>
      <td style="white-space: nowrap; font-size: 0.85rem; color: var(--text-muted);">
        ${dateStr}<br>${timeStr}
      </td>
      <td>
        ${
          msg.replied
            ? `<span class="status-badge replied">✓ Replied</span><br><small style="color:var(--text-light); font-size:0.75rem;">${new Date(msg.repliedAt).toLocaleDateString()}</small>`
            : `<span class="status-badge new">● New</span>`
        }
      </td>
      <td>
        ${
          !msg.replied
            ? `<button class="btn btn-primary btn-sm mark-replied-btn" data-id="${msg.id}" style="font-size: 0.8rem; padding: 0.35rem 0.75rem;">
                Mark as Replied
               </button>`
            : `<span style="color: var(--text-light); font-size: 0.8rem;">Completed</span>`
        }
      </td>
    `;

    tbody.appendChild(tr);
  });

  // Attach mark as replied listeners
  const markButtons = tbody.querySelectorAll('.mark-replied-btn');
  markButtons.forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const id = e.target.getAttribute('data-id');
      if (id) {
        await markMessageAsReplied(id, e.target);
      }
    });
  });
}

/**
 * Mark message as replied
 */
async function markMessageAsReplied(id, buttonElem) {
  if (!adminToken) return;

  if (buttonElem) {
    buttonElem.disabled = true;
    buttonElem.textContent = 'Updating...';
  }

  try {
    const response = await fetch(`/api/admin/messages/${encodeURIComponent(id)}/replied`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
      },
    });

    if (response.ok) {
      const updatedRecord = await response.json();
      // Update in-memory array
      const index = contactMessages.findIndex((m) => m.id === id);
      if (index !== -1) {
        contactMessages[index] = updatedRecord;
      }
      // Re-render
      updateDashboardMetrics();
      renderMessagesTable();
      updateChart();
    } else {
      alert('Failed to mark message as replied. Please try again.');
      if (buttonElem) {
        buttonElem.disabled = false;
        buttonElem.textContent = 'Mark as Replied';
      }
    }
  } catch (err) {
    console.error('Error marking as replied:', err);
    alert('Network error while updating message.');
    if (buttonElem) {
      buttonElem.disabled = false;
      buttonElem.textContent = 'Mark as Replied';
    }
  }
}

/**
 * Render or Update Chart.js chart
 */
function updateChart() {
  const canvas = document.getElementById('reasonsChart');
  if (!canvas || typeof Chart === 'undefined') return;

  // Tally messages by Reason
  const categories = ['Comment', 'Question', 'Partnership', 'Opportunity', 'Other'];
  const counts = {
    Comment: 0,
    Question: 0,
    Partnership: 0,
    Opportunity: 0,
    Other: 0,
  };

  contactMessages.forEach((msg) => {
    if (counts.hasOwnProperty(msg.reason)) {
      counts[msg.reason]++;
    } else {
      counts.Other++;
    }
  });

  const dataValues = categories.map((cat) => counts[cat]);

  if (reasonsChart) {
    reasonsChart.data.datasets[0].data = dataValues;
    reasonsChart.update();
  } else {
    const ctx = canvas.getContext('2d');
    reasonsChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: categories,
        datasets: [
          {
            label: 'Number of Messages',
            data: dataValues,
            backgroundColor: [
              'rgba(29, 78, 216, 0.85)',   // Royal Blue
              'rgba(59, 130, 246, 0.85)',  // Vivid Blue
              'rgba(30, 58, 138, 0.85)',   // Deep Blue
              'rgba(96, 165, 250, 0.85)',  // Light Royal Blue
              'rgba(15, 23, 42, 0.85)',    // Obsidian Black
            ],
            borderColor: [
              '#1d4ed8',
              '#3b82f6',
              '#1e3a8a',
              '#60a5fa',
              '#334155',
            ],
            borderWidth: 1.5,
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
          title: {
            display: true,
            text: 'Messages by Reason for Contact',
            color: '#f8fafc',
            font: {
              size: 16,
              weight: 'bold',
            },
            padding: {
              bottom: 15,
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1,
              precision: 0,
              color: '#94a3b8',
            },
            grid: {
              color: '#1e2638',
            },
          },
          x: {
            ticks: {
              color: '#94a3b8',
            },
            grid: {
              display: false,
            },
          },
        },
      },
    });
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Handle Portrait Photo Upload in Admin Dashboard
 */
function setupAdminPhotoUpload() {
  const fileInput = document.getElementById('admin-photo-input');
  const previewImg = document.getElementById('admin-portrait-preview');
  const statusEl = document.getElementById('admin-photo-status');

  if (!fileInput) return;

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file || !file.type.startsWith('image/')) {
      if (statusEl) {
        statusEl.textContent = 'Please select a valid image file.';
        statusEl.style.display = 'block';
      }
      return;
    }

    if (statusEl) {
      statusEl.textContent = 'Uploading exact original photo...';
      statusEl.style.display = 'block';
    }

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const response = await fetch('/api/upload-portrait', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: ev.target.result }),
        });

        const result = await response.json();
        if (response.ok && result.success) {
          const freshUrl = result.imageUrl || `/assets/images/student-portrait.jpg?t=${Date.now()}`;
          if (previewImg) previewImg.src = freshUrl;
          if (statusEl) {
            statusEl.textContent = 'Photo updated successfully! Homepage and media gallery have been updated.';
            statusEl.style.color = '#34d399';
          }
        } else {
          if (statusEl) {
            statusEl.textContent = result.error || 'Failed to update photo.';
            statusEl.style.color = '#f87171';
          }
        }
      } catch (err) {
        console.error('Error uploading photo:', err);
        if (statusEl) {
          statusEl.textContent = 'Network error while saving photo.';
          statusEl.style.color = '#f87171';
        }
      }
    };
    reader.readAsDataURL(file);
  });
}
