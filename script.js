/**
 * Universal Client-side JavaScript for Kiyan Rackley's Website
 */

document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  setupContactForm();
  setupMediaGallery();
  setupPhotoUpload();
});

/**
 * Universal Navigation Handling & Active Link State
 */
function setupNavigation() {
  // Mobile menu toggle
  const toggleBtn = document.getElementById('nav-toggle-btn');
  const navMenu = document.getElementById('nav-menu');

  if (toggleBtn && navMenu) {
    toggleBtn.addEventListener('click', () => {
      navMenu.classList.toggle('open');
      const isExpanded = navMenu.classList.contains('open');
      toggleBtn.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
    });
  }

  // Active state verification
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  const navLinks = document.querySelectorAll('.nav-item a');

  navLinks.forEach((link) => {
    const href = link.getAttribute('href');
    if (!href) return;
    
    // Check exact match or default home
    if (
      href === currentPath ||
      (currentPath === '' && href === 'index.html') ||
      (currentPath === '/' && href === 'index.html')
    ) {
      link.classList.add('active');
      link.setAttribute('aria-current', 'page');
    } else {
      link.classList.remove('active');
      link.removeAttribute('aria-current');
    }
  });
}

/**
 * Contact Form Submission & Validation (Home Page)
 */
function setupContactForm() {
  const form = document.getElementById('contact-form');
  if (!form) return;

  const successBox = document.getElementById('form-success-message');
  const errorBox = document.getElementById('form-error-message');
  const submitBtn = document.getElementById('contact-submit-btn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Reset feedback boxes
    if (successBox) successBox.style.display = 'none';
    if (errorBox) errorBox.style.display = 'none';

    // Retrieve input values
    const firstName = document.getElementById('first-name')?.value.trim();
    const lastName = document.getElementById('last-name')?.value.trim();
    const email = document.getElementById('email')?.value.trim();
    const reason = document.getElementById('reason')?.value.trim();
    const message = document.getElementById('message')?.value.trim();

    // Client-side validation
    if (!firstName) {
      showError('Please enter your First Name.');
      return;
    }
    if (!lastName) {
      showError('Please enter your Last Name.');
      return;
    }
    if (!email) {
      showError('Please enter your Email address.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showError('Please provide a valid email address (e.g. name@example.com).');
      return;
    }

    const validReasons = ['Comment', 'Question', 'Partnership', 'Opportunity', 'Other'];
    if (!reason || !validReasons.includes(reason)) {
      showError('Please select a valid Reason for Contact.');
      return;
    }

    if (!message) {
      showError('Please enter your message.');
      return;
    }

    // Disable button during submission
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerText = 'Sending Message...';
    }

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          reason,
          message,
        }),
      });

      const data = await response.json();

      if (response.status === 201) {
        // Success
        form.reset();
        if (successBox) {
          successBox.innerHTML = `
            <strong>Message Sent Successfully!</strong><br>
            Thank you, ${escapeHtml(data.firstName)}. Your message (ID: <code>${escapeHtml(data.id)}</code>) 
            was recorded on ${new Date(data.submittedAt).toLocaleDateString()} at ${new Date(data.submittedAt).toLocaleTimeString()}.
          `;
          successBox.style.display = 'block';
        }
      } else {
        // Error from server (400 or 500)
        showError(data.error || 'Failed to submit form. Please check your entries.');
      }
    } catch (err) {
      console.error('Submission network error:', err);
      showError('Network error connecting to server. Please try again.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerText = 'Send Message';
      }
    }
  });

  function showError(msg) {
    if (errorBox) {
      errorBox.innerHTML = `<strong>Error:</strong> ${escapeHtml(msg)}`;
      errorBox.style.display = 'block';
    }
  }
}

/**
 * Media Page Gallery Modal Lightbox & Dynamic Image Customization
 */
function setupMediaGallery() {
  const cards = document.querySelectorAll('.gallery-card');
  const lightboxModal = document.getElementById('media-lightbox-modal');
  if (!cards.length) return;
  const adminToken = sessionStorage.getItem('admin_session_token');

  // Track initial defaults so cards can always be cleanly restored
  const defaultCardMap = {};
  cards.forEach((card) => {
    const img = card.querySelector('.gallery-media-frame img');
    const video = card.querySelector('.gallery-media-frame video');
    const titleEl = card.querySelector('.gallery-card-title');
    const captionEl = card.querySelector('.gallery-card-caption');

    defaultCardMap[card.id] = {
      src: card.dataset.src || (img ? img.getAttribute('src') : '') || (video ? video.getAttribute('src') : ''),
      title: card.dataset.title || (titleEl ? titleEl.textContent.trim() : ''),
      caption: card.dataset.caption || (captionEl ? captionEl.textContent.trim() : ''),
      type: card.dataset.type || 'image',
    };
  });

  // Track active overrides loaded from server
  let currentOverrides = {};
  let currentViewingCardId = null;
  let activeTargetCardId = 'gallery-card-1';
  let pendingImageSource = null; // Can be base64 string or URL

  // Elements for Lightbox
  const lightboxContainer = document.getElementById('modal-media-container');
  const lightboxTitle = document.getElementById('modal-title');
  const lightboxCaption = document.getElementById('modal-caption');
  const lightboxCloseBtn = document.getElementById('modal-close-btn');
  const lightboxChangeBtn = document.getElementById('modal-change-img-btn');
  const lightboxResetBtn = document.getElementById('modal-reset-img-btn');

  // Elements for Change Image Modal
  const changeModal = document.getElementById('change-image-modal');
  const changeModalCloseBtn = document.getElementById('change-modal-close-btn');
  const changeModalCancelBtn = document.getElementById('change-modal-cancel-btn');
  const changeModalSaveBtn = document.getElementById('change-modal-save-btn');
  const changeModalResetBtn = document.getElementById('change-modal-reset-btn');
  const targetCardSelect = document.getElementById('change-target-card-select');
  const tabBtnUpload = document.getElementById('tab-btn-upload');
  const tabBtnUrl = document.getElementById('tab-btn-url');
  const tabPanelUpload = document.getElementById('tab-panel-upload');
  const tabPanelUrl = document.getElementById('tab-panel-url');
  const dropzone = document.getElementById('change-dropzone');
  const fileInput = document.getElementById('change-file-input');
  const browseBtn = document.getElementById('change-browse-btn');
  const urlInput = document.getElementById('change-url-input');
  const urlPreviewBtn = document.getElementById('change-url-preview-btn');
  const currentImgPreview = document.getElementById('current-img-preview');
  const newImgPreview = document.getElementById('new-img-preview');
  const newImgPlaceholder = document.getElementById('new-img-placeholder');
  const changeTitleInput = document.getElementById('change-title-input');
  const changeCaptionInput = document.getElementById('change-caption-input');
  const feedbackEl = document.getElementById('change-modal-feedback');
  const toastEl = document.getElementById('gallery-toast');

  // Elements for Toolbar
  const btnToggleEditMode = document.getElementById('btn-toggle-edit-mode');
  const btnQuickChangeAny = document.getElementById('btn-quick-change-any');
  const btnResetAllMedia = document.getElementById('btn-reset-all-media');
  const galleryGrid = document.getElementById('media-gallery-grid');
  if (!adminToken) {
    [btnToggleEditMode, btnQuickChangeAny, lightboxChangeBtn, lightboxResetBtn].forEach((button) => {
      if (button) button.style.display = 'none';
    });
    document.querySelectorAll('.card-edit-image-btn, .card-change-link-btn').forEach((button) => {
      button.style.display = 'none';
    });
  }

  // 1. Toast Notification Helper
  let toastTimer = null;
  function showToast(message, type = 'success') {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.className = `toast-notification visible ${type}`;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove('visible');
    }, 4000);
  }

  // 2. Fetch Saved Media Overrides from Server
  async function loadMediaConfig() {
    try {
      const res = await fetch('/api/media');
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.overrides) {
        currentOverrides = data.overrides;
        applyOverridesToDOM();
      }
    } catch (err) {
      console.warn('Could not load custom media configuration:', err);
    }
  }

  // Apply current overrides to the gallery cards in DOM
  function applyOverridesToDOM() {
    const overrideKeys = Object.keys(currentOverrides);
    let hasAnyCustom = false;

    cards.forEach((card) => {
      const cardId = card.id;
      const override = currentOverrides[cardId];

      if (override && override.src) {
        hasAnyCustom = true;
        card.dataset.src = override.src;
        if (override.title) card.dataset.title = override.title;
        if (override.caption) card.dataset.caption = override.caption;

        const img = card.querySelector('.gallery-media-frame img');
        const video = card.querySelector('.gallery-media-frame video');
        const titleEl = card.querySelector('.gallery-card-title');
        const captionEl = card.querySelector('.gallery-card-caption');

        if (img) img.src = override.src;
        if (video) video.src = override.src;
        if (titleEl && override.title) titleEl.textContent = override.title;
        if (captionEl && override.caption) captionEl.textContent = override.caption;

        card.classList.add('has-custom-media');
      } else {
        // Reset to initial defaults if removed
        const def = defaultCardMap[cardId];
        if (def) {
          card.dataset.src = def.src;
          card.dataset.title = def.title;
          card.dataset.caption = def.caption;

          const img = card.querySelector('.gallery-media-frame img');
          const video = card.querySelector('.gallery-media-frame video');
          const titleEl = card.querySelector('.gallery-card-title');
          const captionEl = card.querySelector('.gallery-card-caption');

          if (img) img.src = def.src;
          if (video) video.src = def.src;
          if (titleEl) titleEl.textContent = def.title;
          if (captionEl) captionEl.textContent = def.caption;
        }
        card.classList.remove('has-custom-media');
      }
    });

    if (btnResetAllMedia) {
      btnResetAllMedia.style.display = hasAnyCustom && adminToken ? 'inline-flex' : 'none';
    }
  }

  // Load configuration on initialization
  loadMediaConfig();

  // 3. Card Click Handling (Lightbox vs Change Image Trigger)
  cards.forEach((card) => {
    card.addEventListener('click', (e) => {
      // Check if user clicked on one of the change image buttons
      if (e.target.closest('.card-edit-image-btn') || e.target.closest('.card-change-link-btn')) {
        e.preventDefault();
        e.stopPropagation();
        openChangeImageModal(card.id);
        return;
      }

      // Normal Lightbox opening
      const type = card.dataset.type;
      const title = card.dataset.title;
      const caption = card.dataset.caption;
      const src = card.dataset.src;
      const externalUrl = card.dataset.externalUrl;

      if (type === 'social' && externalUrl && !card.classList.contains('has-custom-media')) {
        window.open(externalUrl, '_blank', 'noopener,noreferrer');
        return;
      }

      currentViewingCardId = card.id;

      if (lightboxTitle) lightboxTitle.textContent = title;
      if (lightboxCaption) {
        if (externalUrl) {
          lightboxCaption.innerHTML = `${caption} <br><a href="${externalUrl}" target="_blank" rel="noopener noreferrer" style="color: #38bdf8; display: inline-flex; align-items: center; gap: 0.35rem; margin-top: 0.5rem; text-decoration: underline; font-weight: 600;">Watch official clip on Hudl &nearr;</a>`;
        } else {
          lightboxCaption.textContent = caption;
        }
      }

      if (lightboxContainer) {
        lightboxContainer.innerHTML = '';
        if (type === 'video' || (src && src.endsWith('.mp4'))) {
          const videoElem = document.createElement('video');
          videoElem.src = src;
          videoElem.controls = true;
          videoElem.autoplay = true;
          videoElem.playsInline = true;
          videoElem.style.maxWidth = '100%';
          videoElem.style.maxHeight = '500px';
          videoElem.style.borderRadius = 'var(--radius-sm)';
          videoElem.style.backgroundColor = '#000';
          lightboxContainer.appendChild(videoElem);
        } else {
          const imgElem = document.createElement('img');
          imgElem.src = src;
          imgElem.alt = title;
          imgElem.style.maxWidth = '100%';
          imgElem.style.maxHeight = '500px';
          lightboxContainer.appendChild(imgElem);
        }
      }

      // Update lightbox buttons
      if (lightboxResetBtn) {
        lightboxResetBtn.style.display = currentOverrides[card.id] && adminToken ? 'inline-flex' : 'none';
      }

      if (lightboxModal) {
        lightboxModal.classList.add('active');
      }
    });
  });

  // Lightbox Close Logic
  function closeLightbox() {
    if (!lightboxModal) return;
    lightboxModal.classList.remove('active');
    if (lightboxContainer) {
      const video = lightboxContainer.querySelector('video');
      if (video) video.pause();
      lightboxContainer.innerHTML = '';
    }
    currentViewingCardId = null;
  }

  if (lightboxCloseBtn) {
    lightboxCloseBtn.addEventListener('click', closeLightbox);
  }
  if (lightboxModal) {
    lightboxModal.addEventListener('click', (e) => {
      if (e.target === lightboxModal) closeLightbox();
    });
  }

  // Lightbox Action: Change This Image
  if (lightboxChangeBtn) {
    lightboxChangeBtn.addEventListener('click', () => {
      const targetId = currentViewingCardId || 'gallery-card-1';
      closeLightbox();
      openChangeImageModal(targetId);
    });
  }

  // Lightbox Action: Reset Image
  if (lightboxResetBtn) {
    lightboxResetBtn.addEventListener('click', async () => {
      if (!currentViewingCardId) return;
      await resetCardImage(currentViewingCardId);
      closeLightbox();
    });
  }

  // 4. Change Image Modal Logic
  function openChangeImageModal(cardId) {
    if (!changeModal) return;
    activeTargetCardId = cardId || 'gallery-card-1';

    if (targetCardSelect) {
      targetCardSelect.value = activeTargetCardId;
    }

    syncChangeModalState(activeTargetCardId);

    // Reset feedback
    if (feedbackEl) {
      feedbackEl.textContent = '';
      feedbackEl.className = 'form-feedback';
      feedbackEl.style.display = 'none';
    }

    // Default to Upload Tab
    switchTab('upload');

    changeModal.classList.add('active');
  }

  function closeChangeModal() {
    if (!changeModal) return;
    changeModal.classList.remove('active');
    pendingImageSource = null;
    if (fileInput) fileInput.value = '';
    if (urlInput) urlInput.value = '';
  }

  if (changeModalCloseBtn) changeModalCloseBtn.addEventListener('click', closeChangeModal);
  if (changeModalCancelBtn) changeModalCancelBtn.addEventListener('click', closeChangeModal);
  if (changeModal) {
    changeModal.addEventListener('click', (e) => {
      if (e.target === changeModal) closeChangeModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (changeModal && changeModal.classList.contains('active')) {
        closeChangeModal();
      } else if (lightboxModal && lightboxModal.classList.contains('active')) {
        closeLightbox();
      }
    }
  });

  // Synchronize modal preview & inputs with the chosen card
  function syncChangeModalState(cardId) {
    const card = document.getElementById(cardId);
    if (!card) return;

    const currentSrc = card.dataset.src;
    const currentTitle = card.dataset.title;
    const currentCaption = card.dataset.caption;

    // Current Image Preview
    if (currentImgPreview) {
      currentImgPreview.src = currentSrc;
      currentImgPreview.alt = currentTitle || 'Current image';
    }

    // Fill Title & Caption inputs
    if (changeTitleInput) changeTitleInput.value = currentTitle || '';
    if (changeCaptionInput) changeCaptionInput.value = currentCaption || '';

    // Reset replacement preview
    pendingImageSource = null;
    if (newImgPreview) {
      newImgPreview.style.display = 'none';
      newImgPreview.src = '';
    }
    if (newImgPlaceholder) {
      newImgPlaceholder.style.display = 'block';
      newImgPlaceholder.textContent = 'Choose a file or enter a URL above';
    }
    if (urlInput) urlInput.value = '';
    if (fileInput) fileInput.value = '';

    // Show/hide Reset Card button depending on whether it has an override
    if (changeModalResetBtn) {
      changeModalResetBtn.style.display = currentOverrides[cardId] ? 'inline-block' : 'none';
    }
  }

  // When card dropdown changes
  if (targetCardSelect) {
    targetCardSelect.addEventListener('change', (e) => {
      activeTargetCardId = e.target.value;
      syncChangeModalState(activeTargetCardId);
    });
  }

  // Tab Switching
  function switchTab(tabName) {
    if (tabName === 'upload') {
      if (tabBtnUpload) tabBtnUpload.classList.add('active');
      if (tabBtnUrl) tabBtnUrl.classList.remove('active');
      if (tabPanelUpload) tabPanelUpload.style.display = 'block';
      if (tabPanelUrl) tabPanelUrl.style.display = 'none';
    } else {
      if (tabBtnUrl) tabBtnUrl.classList.add('active');
      if (tabBtnUpload) tabBtnUpload.classList.remove('active');
      if (tabPanelUrl) tabPanelUrl.style.display = 'block';
      if (tabPanelUpload) tabPanelUpload.style.display = 'none';
    }
  }

  if (tabBtnUpload) tabBtnUpload.addEventListener('click', () => switchTab('upload'));
  if (tabBtnUrl) tabBtnUrl.addEventListener('click', () => switchTab('url'));

  // File Upload Handlers (Click + Drag and Drop)
  if (browseBtn && fileInput) {
    browseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput.click();
    });
  }

  if (dropzone && fileInput) {
    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fileInput.click();
      }
    });

    ['dragenter', 'dragover'].forEach((evt) => {
      dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach((evt) => {
      dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('dragover');
      });
    });

    dropzone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const file = dt && dt.files && dt.files[0];
      if (file) handleChosenFile(file);
    });

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) handleChosenFile(file);
    });
  }

  function handleChosenFile(file) {
    if (!file) return;

    if (!file.type.startsWith('image/') && !file.type.startsWith('video/mp4')) {
      showModalFeedback('Please select a valid image file (JPG, PNG, WebP, GIF, SVG) or MP4 video.', 'danger');
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      showModalFeedback('Selected file is larger than 25MB. Please choose a smaller image.', 'danger');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      pendingImageSource = e.target.result;
      updateNewImagePreview(pendingImageSource);
      showModalFeedback(`Loaded file: ${file.name} (${Math.round(file.size / 1024)} KB). Click "Save & Apply Image" to finish.`, 'success');
    };
    reader.onerror = () => {
      showModalFeedback('Failed to read the selected file. Please try again.', 'danger');
    };
    reader.readAsDataURL(file);
  }

  // URL Input Handler
  function handleUrlPreview() {
    if (!urlInput) return;
    const url = urlInput.value.trim();
    if (!url) {
      showModalFeedback('Please enter an image or media URL.', 'danger');
      return;
    }

    pendingImageSource = url;
    updateNewImagePreview(url);
    showModalFeedback('Image URL preview loaded. Click "Save & Apply Image" to set this photo.', 'success');
  }

  if (urlPreviewBtn) urlPreviewBtn.addEventListener('click', handleUrlPreview);
  if (urlInput) {
    urlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleUrlPreview();
      }
    });
  }

  function updateNewImagePreview(src) {
    if (!newImgPreview || !newImgPlaceholder) return;
    newImgPreview.src = src;
    newImgPreview.style.display = 'block';
    newImgPlaceholder.style.display = 'none';

    newImgPreview.onerror = () => {
      showModalFeedback('Could not load image from this URL. Please verify the link is public and accessible.', 'danger');
    };
  }

  function showModalFeedback(msg, type = 'success') {
    if (!feedbackEl) return;
    feedbackEl.textContent = msg;
    feedbackEl.className = `form-feedback ${type === 'danger' ? 'danger' : 'success'}`;
    feedbackEl.style.display = 'block';
  }

  // 5. Save & Apply Image to Server
  if (changeModalSaveBtn) {
    changeModalSaveBtn.addEventListener('click', async () => {
      const cardId = activeTargetCardId;
      const title = changeTitleInput ? changeTitleInput.value.trim() : '';
      const caption = changeCaptionInput ? changeCaptionInput.value.trim() : '';

      if (!pendingImageSource && !title && !caption) {
        showModalFeedback('Please select an image file or enter an image URL to replace this card.', 'danger');
        return;
      }

      changeModalSaveBtn.disabled = true;
      const origText = changeModalSaveBtn.textContent;
      changeModalSaveBtn.textContent = 'Saving...';

      try {
        const payload = {
          cardId,
          ...(pendingImageSource ? { imageSrc: pendingImageSource } : {}),
          ...(title ? { title } : {}),
          ...(caption ? { caption } : {}),
        };

        const res = await fetch('/api/media/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to update image.');
        }

        currentOverrides = data.overrides || currentOverrides;
        applyOverridesToDOM();

        closeChangeModal();
        showToast(`Card photo updated successfully!`, 'success');
      } catch (err) {
        console.error('Error updating media item:', err);
        showModalFeedback(err.message || 'Failed to save image. Please try again.', 'danger');
      } finally {
        changeModalSaveBtn.disabled = false;
        changeModalSaveBtn.textContent = origText;
      }
    });
  }

  // 6. Reset Single Card Image
  async function resetCardImage(cardId) {
    try {
      const res = await fetch('/api/media/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
        body: JSON.stringify({ cardId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to reset.');
      }
      currentOverrides = data.overrides || {};
      applyOverridesToDOM();
      showToast('Image reset back to original default.', 'success');
    } catch (err) {
      console.error('Failed to reset card image:', err);
      showToast('Could not reset image.', 'error');
    }
  }

  if (changeModalResetBtn) {
    changeModalResetBtn.addEventListener('click', async () => {
      await resetCardImage(activeTargetCardId);
      closeChangeModal();
    });
  }

  // 7. Reset All Images Toolbar Action
  if (btnResetAllMedia) {
    btnResetAllMedia.addEventListener('click', async () => {
      const confirmed = window.confirm('Are you sure you want to reset all customized images back to their original gallery defaults?');
      if (!confirmed) return;

      try {
        const res = await fetch('/api/media/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
          body: JSON.stringify({ all: true }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to reset all.');
        currentOverrides = {};
        applyOverridesToDOM();
        showToast('All gallery media images have been restored to defaults.', 'success');
      } catch (err) {
        console.error('Reset all media error:', err);
        showToast('Failed to reset all images.', 'error');
      }
    });
  }

  // 8. Toolbar Actions: Toggle Highlight Mode & Quick Change
  if (btnToggleEditMode && galleryGrid) {
    btnToggleEditMode.addEventListener('click', () => {
      const isActive = galleryGrid.classList.toggle('edit-mode-active');
      btnToggleEditMode.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      if (isActive) {
        btnToggleEditMode.classList.remove('btn-outline');
        btnToggleEditMode.classList.add('btn-primary');
        showToast('Edit mode active: Change buttons are highlighted on each card.');
      } else {
        btnToggleEditMode.classList.remove('btn-primary');
        btnToggleEditMode.classList.add('btn-outline');
      }
    });
  }

  if (btnQuickChangeAny) {
    btnQuickChangeAny.addEventListener('click', () => {
      openChangeImageModal('gallery-card-1');
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
 * Setup Portrait Photo Upload & Drag-and-Drop
 */
function setupPhotoUpload() {
  const photoWrapper = document.getElementById('student-photo-wrapper');
  const fileInput = document.getElementById('portrait-file-input');
  const statusEl = document.getElementById('photo-upload-status');
  const heroPortrait = document.getElementById('student-hero-portrait');

  if (!photoWrapper || !fileInput) return;
  const adminToken = sessionStorage.getItem('admin_session_token');
  if (!adminToken) {
    const uploadOverlay = document.getElementById('photo-upload-overlay');
    if (uploadOverlay) uploadOverlay.style.display = 'none';
    return;
  }

  function showStatus(text, duration = 3500) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.classList.add('visible');
    setTimeout(() => {
      statusEl.classList.remove('visible');
    }, duration);
  }

  async function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      showStatus('Please select an image file (PNG, JPG, etc.).');
      return;
    }

    showStatus('Uploading original photo...');

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64Data = e.target.result;
      try {
        const response = await fetch('/api/upload-portrait', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
          body: JSON.stringify({ imageBase64: base64Data }),
        });

        const result = await response.json();
        if (response.ok && result.success) {
          const freshUrl = result.imageUrl || `/assets/images/student-portrait.jpg?t=${Date.now()}`;
          if (heroPortrait) {
            heroPortrait.src = freshUrl;
          }
          const galleryPortraits = document.querySelectorAll('img[src*="student-portrait"]');
          galleryPortraits.forEach(img => {
            img.src = freshUrl;
          });
          showStatus('Original photo updated successfully!');
        } else {
          showStatus(result.error || 'Upload failed. Please try again.');
        }
      } catch (err) {
        console.error('Error uploading photo:', err);
        showStatus('Network error while saving photo.');
      }
    };
    reader.readAsDataURL(file);
  }

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      handleFile(file);
    }
  });

  // Drag and drop onto the photo wrapper
  ['dragenter', 'dragover'].forEach(eventName => {
    photoWrapper.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      photoWrapper.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    photoWrapper.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      photoWrapper.classList.remove('dragover');
    });
  });

  photoWrapper.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const file = dt && dt.files && dt.files[0];
    if (file) {
      handleFile(file);
    }
  });
}
