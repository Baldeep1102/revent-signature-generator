// Revent Email Signature Generator

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('signature-form');
    const preview = document.getElementById('signature-preview');
    const copyBtn = document.getElementById('copy-btn');
    const copyHtmlBtn = document.getElementById('copy-html-btn');
    const toast = document.getElementById('toast');

    // Photo elements
    const photoPreview = document.getElementById('photo-preview');
    const photoInput = document.getElementById('photo-input');
    const uploadPhotoBtn = document.getElementById('upload-photo-btn');
    const removePhotoBtn = document.getElementById('remove-photo-btn');

    // Crop modal elements
    const cropModal = document.getElementById('crop-modal');
    const cropImage = document.getElementById('crop-image');
    const cropContainer = document.getElementById('crop-container');
    const cropZoom = document.getElementById('crop-zoom');
    const cropSaveBtn = document.getElementById('crop-save');
    const cropCancelBtn = document.getElementById('crop-cancel-btn');
    const cropCancelX = document.getElementById('crop-cancel');

    // State
    let profilePhotoData = null;
    let adminSettings = {
        awards: [],
        companyTagline: ''
    };
    let cropState = {
        x: 0,
        y: 0,
        zoom: 1,
        isDragging: false,
        startX: 0,
        startY: 0,
        imgWidth: 0,
        imgHeight: 0
    };

    // Load admin settings from API
    const loadAdminSettings = async () => {
        try {
            const response = await fetch('/api/settings');
            if (response.ok) {
                adminSettings = await response.json();
            }
        } catch (error) {
            console.log('Could not load settings from server, using defaults');
        }
        updatePreview();
    };

    // Get admin settings (synchronous, uses cached data)
    const getAdminSettings = () => {
        return adminSettings;
    };

    // Load settings on page load
    loadAdminSettings();

    // Show toast notification
    const showToast = (message) => {
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    };

    // ==================== PHOTO CROPPING ====================

    // Open file picker
    uploadPhotoBtn.addEventListener('click', () => photoInput.click());

    // Handle file selection
    photoInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            showToast('Please select an image file');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            openCropModal(event.target.result);
        };
        reader.readAsDataURL(file);
    });

    // Open crop modal
    const openCropModal = (imageSrc) => {
        cropImage.src = imageSrc;
        cropModal.classList.add('show');
        cropZoom.value = 1;

        cropImage.onload = () => {
            initCropper();
        };
    };

    // Initialize cropper
    const initCropper = () => {
        const containerRect = cropContainer.getBoundingClientRect();
        const circleSize = 200;

        // Calculate initial size to fit the circle
        const imgRatio = cropImage.naturalWidth / cropImage.naturalHeight;
        let newWidth, newHeight;

        if (imgRatio > 1) {
            newHeight = circleSize;
            newWidth = circleSize * imgRatio;
        } else {
            newWidth = circleSize;
            newHeight = circleSize / imgRatio;
        }

        cropState.imgWidth = newWidth;
        cropState.imgHeight = newHeight;
        cropState.zoom = 1;
        cropState.x = (containerRect.width - newWidth) / 2;
        cropState.y = (containerRect.height - newHeight) / 2;

        updateCropImage();
    };

    // Update crop image position/size
    const updateCropImage = () => {
        const width = cropState.imgWidth * cropState.zoom;
        const height = cropState.imgHeight * cropState.zoom;
        cropImage.style.width = `${width}px`;
        cropImage.style.height = `${height}px`;
        cropImage.style.left = `${cropState.x}px`;
        cropImage.style.top = `${cropState.y}px`;
    };

    // Zoom control
    cropZoom.addEventListener('input', (e) => {
        const containerRect = cropContainer.getBoundingClientRect();
        const oldZoom = cropState.zoom;
        const newZoom = parseFloat(e.target.value);

        // Zoom towards center
        const centerX = containerRect.width / 2;
        const centerY = containerRect.height / 2;

        const oldWidth = cropState.imgWidth * oldZoom;
        const oldHeight = cropState.imgHeight * oldZoom;
        const newWidth = cropState.imgWidth * newZoom;
        const newHeight = cropState.imgHeight * newZoom;

        // Adjust position to keep center point stable
        cropState.x = cropState.x - (newWidth - oldWidth) / 2;
        cropState.y = cropState.y - (newHeight - oldHeight) / 2;
        cropState.zoom = newZoom;

        updateCropImage();
    });

    // Drag functionality
    cropContainer.addEventListener('mousedown', startDrag);
    cropContainer.addEventListener('touchstart', startDrag, { passive: false });

    function startDrag(e) {
        e.preventDefault();
        cropState.isDragging = true;
        const pos = getEventPos(e);
        cropState.startX = pos.x - cropState.x;
        cropState.startY = pos.y - cropState.y;
    }

    document.addEventListener('mousemove', drag);
    document.addEventListener('touchmove', drag, { passive: false });

    function drag(e) {
        if (!cropState.isDragging) return;
        e.preventDefault();
        const pos = getEventPos(e);
        cropState.x = pos.x - cropState.startX;
        cropState.y = pos.y - cropState.startY;
        updateCropImage();
    }

    document.addEventListener('mouseup', endDrag);
    document.addEventListener('touchend', endDrag);

    function endDrag() {
        cropState.isDragging = false;
    }

    function getEventPos(e) {
        if (e.touches && e.touches.length > 0) {
            const rect = cropContainer.getBoundingClientRect();
            return {
                x: e.touches[0].clientX - rect.left,
                y: e.touches[0].clientY - rect.top
            };
        }
        const rect = cropContainer.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    // Save cropped image
    cropSaveBtn.addEventListener('click', () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const outputSize = 150; // Output size in pixels

        canvas.width = outputSize;
        canvas.height = outputSize;

        // Calculate crop area
        const containerRect = cropContainer.getBoundingClientRect();
        const circleSize = 200;
        const circleCenterX = containerRect.width / 2;
        const circleCenterY = containerRect.height / 2;

        const imgWidth = cropState.imgWidth * cropState.zoom;
        const imgHeight = cropState.imgHeight * cropState.zoom;

        // Source coordinates on the image
        const srcX = (circleCenterX - circleSize / 2 - cropState.x) / cropState.zoom * (cropImage.naturalWidth / cropState.imgWidth);
        const srcY = (circleCenterY - circleSize / 2 - cropState.y) / cropState.zoom * (cropImage.naturalHeight / cropState.imgHeight);
        const srcSize = (circleSize / cropState.zoom) * (cropImage.naturalWidth / cropState.imgWidth);

        // Draw circular clip
        ctx.beginPath();
        ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();

        // Draw image
        ctx.drawImage(
            cropImage,
            srcX, srcY, srcSize, srcSize,
            0, 0, outputSize, outputSize
        );

        // Get data URL
        profilePhotoData = canvas.toDataURL('image/png');

        // Update preview
        photoPreview.innerHTML = `<img src="${profilePhotoData}" alt="Profile">`;
        photoPreview.classList.add('has-photo');
        removePhotoBtn.style.display = 'block';

        // Close modal
        closeCropModal();

        // Update signature preview
        updatePreview();
    });

    // Cancel/close crop modal
    const closeCropModal = () => {
        cropModal.classList.remove('show');
        photoInput.value = '';
    };

    cropCancelBtn.addEventListener('click', closeCropModal);
    cropCancelX.addEventListener('click', closeCropModal);

    cropModal.addEventListener('click', (e) => {
        if (e.target === cropModal) closeCropModal();
    });

    // Remove photo
    removePhotoBtn.addEventListener('click', () => {
        profilePhotoData = null;
        photoPreview.innerHTML = `
            <svg class="photo-placeholder" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="12" cy="8" r="4"/>
                <path d="M4 20c0-4 4-6 8-6s8 2 8 6"/>
            </svg>
        `;
        photoPreview.classList.remove('has-photo');
        removePhotoBtn.style.display = 'none';
        updatePreview();
    });

    // ==================== SIGNATURE GENERATION ====================

    // Generate signature HTML
    const generateSignature = () => {
        const name = document.getElementById('fullName').value || 'Your Name';
        const title = document.getElementById('jobTitle').value || 'Your Title';
        const email = document.getElementById('email').value || 'john@revent.store';
        const phone = document.getElementById('phone').value;
        const website = document.getElementById('website').value || 'https://revent.store';
        const linkedin = document.getElementById('linkedin').value;
        const twitter = document.getElementById('twitter').value;

        const settings = getAdminSettings();

        // Icon URLs - using reliable CDN hosted PNG icons
        const emailIconUrl = 'https://cdn-icons-png.flaticon.com/16/561/561127.png';
        const phoneIconUrl = 'https://cdn-icons-png.flaticon.com/16/724/724664.png';
        const websiteIconUrl = 'https://cdn-icons-png.flaticon.com/16/1006/1006771.png';
        const linkedinIconUrl = 'https://cdn-icons-png.flaticon.com/24/174/174857.png';
        const twitterIconUrl = 'https://cdn-icons-png.flaticon.com/24/5968/5968830.png';

        // Build contact rows with icons
        let contactRows = '';
        contactRows += `<tr><td style="padding:3px 0;"><img src="${emailIconUrl}" width="14" height="14" style="vertical-align:middle;margin-right:8px;"><a href="mailto:${email}" style="color:#5986d8;text-decoration:none;font-size:13px;">${email}</a></td></tr>`;

        if (phone) {
            contactRows += `<tr><td style="padding:3px 0;"><img src="${phoneIconUrl}" width="14" height="14" style="vertical-align:middle;margin-right:8px;"><a href="tel:${phone.replace(/\s/g, '')}" style="color:#5986d8;text-decoration:none;font-size:13px;">${phone}</a></td></tr>`;
        }

        if (website) {
            const displayUrl = website.replace(/^https?:\/\//, '');
            contactRows += `<tr><td style="padding:3px 0;"><img src="${websiteIconUrl}" width="14" height="14" style="vertical-align:middle;margin-right:8px;"><a href="${website}" style="color:#5986d8;text-decoration:none;font-size:13px;">${displayUrl}</a></td></tr>`;
        }

        // Awards HTML - clean, consistent table cells with borders
        let awardsHtml = '';
        if (settings.awards && settings.awards.length > 0) {
            awardsHtml = settings.awards.map(award =>
                `<td style="padding:0 6px 0 0;vertical-align:middle;">
                    <table cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e2e8f0;border-radius:6px;background:#ffffff;">
                        <tr>
                            <td style="width:58px;height:58px;text-align:center;vertical-align:middle;padding:4px;">
                                <img src="${award}" alt="Award" width="48" height="48" style="display:block;margin:0 auto;">
                            </td>
                        </tr>
                    </table>
                </td>`
            ).join('');
        }

        // Tagline section
        let taglineHtml = '';
        if (settings.companyTagline) {
            taglineHtml = `<tr><td colspan="4" style="padding-top:10px;"><p style="margin:0;font-size:12px;color:#64748b;font-style:italic;">${settings.companyTagline}</p></td></tr>`;
        }

        // Profile photo with gradient border (using table for email compatibility)
        let photoHtml = '';
        if (profilePhotoData) {
            photoHtml = `
                <table cellpadding="0" cellspacing="0" border="0">
                    <tr>
                        <td style="padding:3px;background:linear-gradient(135deg,#11c5ce,#5986d8,#895cdf,#e40eeb);border-radius:50%;">
                            <img src="${profilePhotoData}" alt="${name}" width="84" height="84" style="border-radius:50%;display:block;border:2px solid white;">
                        </td>
                    </tr>
                </table>
            `;
        }

        // Revent logo - use configured URL or text fallback
        const logoUrl = settings.logoUrl || '';

        // Logo HTML - use image if URL provided, otherwise styled text
        let logoHtml = '';
        if (logoUrl) {
            logoHtml = `<img src="${logoUrl}" alt="Revent" width="110" style="display:block;">`;
        } else {
            // Text-based logo fallback (works in all email clients)
            logoHtml = `<span style="font-size:28px;font-weight:bold;color:#5986d8;letter-spacing:-1px;">revent</span>`;
        }

        const signatureHtml = `
<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1e293b;">
    <!-- Main Row: Photo | Logo | Divider | Name/Contact -->
    <tr>
        <td style="vertical-align:middle;padding-right:15px;">
            ${photoHtml}
        </td>
        <td style="vertical-align:middle;padding-right:15px;">
            ${logoHtml}
        </td>
        <td style="vertical-align:middle;padding-right:15px;padding-left:5px;">
            <table cellpadding="0" cellspacing="0" border="0" style="border-left:3px solid #5986d8;height:90px;">
                <tr><td></td></tr>
            </table>
        </td>
        <td style="vertical-align:middle;">
            <p style="margin:0;font-size:18px;font-weight:bold;color:#1e293b;">${name}</p>
            <p style="margin:2px 0 0 0;font-size:13px;color:#64748b;">${title}</p>
            <p style="margin:2px 0 8px 0;font-size:13px;color:#64748b;">Revent</p>
            <table cellpadding="0" cellspacing="0" border="0">
                ${contactRows}
            </table>
        </td>
    </tr>
    <!-- Social Icons -->
    ${(linkedin || twitter) ? `<tr><td colspan="4" style="padding-top:12px;">${linkedin ? `<a href="${linkedin}" style="text-decoration:none;margin-right:10px;"><img src="${linkedinIconUrl}" width="22" height="22" style="vertical-align:middle;border-radius:4px;"></a>` : ''}${twitter ? `<a href="${twitter}" style="text-decoration:none;"><img src="${twitterIconUrl}" width="22" height="22" style="vertical-align:middle;"></a>` : ''}</td></tr>` : ''}
    <!-- Awards -->
    ${awardsHtml ? `<tr><td colspan="4" style="padding-top:14px;"><table cellpadding="0" cellspacing="0" border="0"><tr>${awardsHtml}</tr></table></td></tr>` : ''}
    <!-- Tagline -->
    ${taglineHtml}
</table>
        `.trim();

        return signatureHtml;
    };

    // Update preview
    const updatePreview = () => {
        if (preview) {
            preview.innerHTML = generateSignature();
        }
    };

    // Copy signature as rich text
    const copySignature = async () => {
        const signatureHtml = generateSignature();

        try {
            const container = document.createElement('div');
            container.innerHTML = signatureHtml;
            document.body.appendChild(container);

            const range = document.createRange();
            range.selectNodeContents(container);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);

            if (navigator.clipboard && window.ClipboardItem) {
                const blob = new Blob([signatureHtml], { type: 'text/html' });
                const clipboardItem = new ClipboardItem({ 'text/html': blob });
                await navigator.clipboard.write([clipboardItem]);
                showToast('Signature copied! Paste into your email client.');
            } else {
                document.execCommand('copy');
                showToast('Signature copied! Paste into your email client.');
            }

            selection.removeAllRanges();
            document.body.removeChild(container);
        } catch (err) {
            console.error('Copy failed:', err);
            showToast('Copy failed. Try Copy HTML instead.');
        }
    };

    // Copy HTML source
    const copyHtml = async () => {
        const signatureHtml = generateSignature();
        try {
            await navigator.clipboard.writeText(signatureHtml);
            showToast('HTML copied to clipboard!');
        } catch (err) {
            const textarea = document.createElement('textarea');
            textarea.value = signatureHtml;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            showToast('HTML copied to clipboard!');
        }
    };

    // Event listeners
    if (form) {
        form.addEventListener('input', updatePreview);
    }

    if (copyBtn) {
        copyBtn.addEventListener('click', copySignature);
    }

    if (copyHtmlBtn) {
        copyHtmlBtn.addEventListener('click', copyHtml);
    }

    // Initial render
    updatePreview();
});
