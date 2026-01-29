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

    // Load admin settings
    const getAdminSettings = () => {
        const settings = localStorage.getItem('revent-signature-admin');
        return settings ? JSON.parse(settings) : {
            logoUrl: '',
            awards: [],
            companyTagline: ''
        };
    };

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

        // Icons for contact info
        const emailIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5986d8" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/></svg>`;
        const phoneIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5986d8" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18.01"/></svg>`;
        const websiteIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5986d8" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`;

        const emailIconUri = 'data:image/svg+xml;base64,' + btoa(emailIcon);
        const phoneIconUri = 'data:image/svg+xml;base64,' + btoa(phoneIcon);
        const websiteIconUri = 'data:image/svg+xml;base64,' + btoa(websiteIcon);

        // Build contact rows with icons
        let contactRows = '';
        contactRows += `<tr><td style="padding:3px 0;"><img src="${emailIconUri}" width="14" height="14" style="vertical-align:middle;margin-right:8px;"><a href="mailto:${email}" style="color:#5986d8;text-decoration:none;font-size:13px;">${email}</a></td></tr>`;

        if (phone) {
            contactRows += `<tr><td style="padding:3px 0;"><img src="${phoneIconUri}" width="14" height="14" style="vertical-align:middle;margin-right:8px;"><a href="tel:${phone.replace(/\s/g, '')}" style="color:#5986d8;text-decoration:none;font-size:13px;">${phone}</a></td></tr>`;
        }

        if (website) {
            const displayUrl = website.replace(/^https?:\/\//, '');
            contactRows += `<tr><td style="padding:3px 0;"><img src="${websiteIconUri}" width="14" height="14" style="vertical-align:middle;margin-right:8px;"><a href="${website}" style="color:#5986d8;text-decoration:none;font-size:13px;text-decoration:underline;">${displayUrl}</a></td></tr>`;
        }

        // Social icons
        const linkedinIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#0A66C2"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>`;
        const twitterIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#000000"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`;

        const linkedinIconUri = 'data:image/svg+xml;base64,' + btoa(linkedinIcon);
        const twitterIconUri = 'data:image/svg+xml;base64,' + btoa(twitterIcon);

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

        // Profile photo with gradient border
        let photoHtml = '';
        if (profilePhotoData) {
            photoHtml = `
                <div style="width:90px;height:90px;border-radius:50%;padding:3px;background:linear-gradient(135deg,#11c5ce,#5986d8,#895cdf,#e40eeb);display:inline-block;">
                    <img src="${profilePhotoData}" alt="${name}" width="84" height="84" style="border-radius:50%;display:block;border:2px solid white;">
                </div>
            `;
        }

        // Revent logo SVG
        const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 846.26 240.95" width="120" height="34"><defs><linearGradient id="g1" x1="0%" y1="50%" x2="100%" y2="50%"><stop offset="0%" stop-color="#11c5ce"/><stop offset="40%" stop-color="#5986d8"/><stop offset="70%" stop-color="#895cdf"/><stop offset="100%" stop-color="#e40eeb"/></linearGradient><linearGradient id="g2" x1="0%" y1="50%" x2="100%" y2="50%"><stop offset="0%" stop-color="#11c5ce"/><stop offset="45%" stop-color="#5986d8"/><stop offset="74%" stop-color="#895cdf"/><stop offset="100%" stop-color="#e40eeb"/></linearGradient></defs><path d="M668.42,550.85c12.35,0,21.58-4.24,30.44-12.44,2.17-2,4.33-2.07,6.41-.09l3.48,3.29c2.08,2,2.26,4.15.28,6.32-10,10.74-22.14,17.71-40.13,17.71-31.76,0-53-22.8-53-51.07s21.95-51.07,51.63-51.07c29.12,0,49.75,22.05,49.75,48.91,0,1-.09,2.25-.19,3.39-.28,2.82-2.07,4.14-4.8,4.14H633.37C635.26,537.37,649.58,550.85,668.42,550.85ZM634,505.71h65.21C696.6,490,684,478.29,667.48,478.29,651.18,478.29,637.42,490.17,634,505.71Z" transform="translate(-266.64 -382.41)"/><path d="M776.58,563.38h-10a5.31,5.31,0,0,1-5.28-3.58L726.92,471c-1.22-3.21.28-5.19,3.58-5.19h8.39a5.17,5.17,0,0,1,5.27,3.58L771.58,541,799,469.34a5.19,5.19,0,0,1,5.28-3.58h8.39c3.29,0,4.8,2,3.58,5.19L781.86,559.8A5.31,5.31,0,0,1,776.58,563.38Z" transform="translate(-266.64 -382.41)"/><path d="M878.51,550.85c12.35,0,21.58-4.24,30.44-12.44,2.17-2,4.33-2.07,6.41-.09l3.48,3.29c2.08,2,2.26,4.15.28,6.32-10,10.74-22.14,17.71-40.13,17.71-31.76,0-53-22.8-53-51.07s21.95-51.07,51.63-51.07c29.12,0,49.75,22.05,49.75,48.91,0,1-.09,2.25-.19,3.39-.28,2.82-2.07,4.14-4.8,4.14H843.46C845.35,537.37,859.67,550.85,878.51,550.85Zm-34.39-45.14h65.21c-2.64-15.73-15.27-27.42-31.76-27.42C861.27,478.29,847.51,490.17,844.12,505.71Z" transform="translate(-266.64 -382.41)"/><path d="M960.66,563.38h-8.1c-2.92,0-4.53-1.6-4.53-4.53V470.29c0-2.92,1.61-4.53,4.53-4.53h8.1c2.92,0,4.52,1.61,4.52,4.53v10.45a37.87,37.87,0,0,1,31.66-17.24c24,0,39.29,15.36,39.29,39.86v55.49c0,2.93-1.6,4.53-4.52,4.53h-8.1c-2.92,0-4.53-1.6-4.53-4.53V504.3c0-15.55-9.42-25.44-25.34-25.44-14.89,0-28.46,13.1-28.46,30.15v49.84C965.18,561.78,963.58,563.38,960.66,563.38Z" transform="translate(-266.64 -382.41)"/><path d="M1104.15,550.57c1.22,0,2.63,0,4-.10,3-.19,4.71,1.32,4.71,4.34v4.33c0,2.54-1,4.43-3.58,5.18a42.23,42.23,0,0,1-10.37,1.32c-20,0-31-10.55-31-33.26V480.84H1052c-2.92,0-4.52-1.6-4.52-4.52v-6c0-2.92,1.6-4.53,4.52-4.53H1068v-19.6a4.73,4.73,0,0,1,3.87-5l8.19-2.26c3.11-.85,5.09.66,5.09,3.86v23h22.15c2.92,0,4.52,1.61,4.52,4.53v6c0,2.92-1.6,4.52-4.52,4.52h-22.15v51.35C1085.11,544.54,1090.39,550.57,1104.15,550.57Z" transform="translate(-266.64 -382.41)"/><path d="M565.22,563.29h-9.06a4,4,0,0,1-4-4V503.17a43.75,43.75,0,0,1,43.75-43.75h5.91a4.71,4.71,0,0,1,4.71,4.7v7.73a4.7,4.7,0,0,1-4.71,4.7h-5.91a26.62,26.62,0,0,0-26.62,26.63v56.07A4,4,0,0,1,565.22,563.29Z" transform="translate(-266.64 -382.41)"/><path fill="url(#g1)" d="M381.92,623.37a120.89,120.89,0,0,1-109.51-70.2c-12.71-27.65-3.85-60.84,21.07-78.92a64.46,64.46,0,0,1,83.81,6.63l1.35,1.35,8.55-8.55a34.17,34.17,0,0,1,58.34,24.82,33.87,33.87,0,0,1-10.94,24.42L380.49,573l-40-39a10.58,10.58,0,0,1-.18-15h0a10.58,10.58,0,0,1,15-.18l25.58,25,39-36.13a13.56,13.56,0,0,0,4.38-8,13,13,0,0,0-22.09-11.08l-23.52,23.52-16.31-16.32a43.41,43.41,0,0,0-56.42-4.46c-16.78,12.18-22.78,34.44-14.27,53a99.35,99.35,0,0,0,162.93,26.28,99.31,99.31,0,1,0-146.8-133.78L292,422.74a120,120,0,0,1,97.83-40.07c59.84,3.82,108.11,51.79,112.29,111.59A119.55,119.55,0,0,1,470.05,585,121,121,0,0,1,381.92,623.37Z" transform="translate(-266.64 -382.41)"/><path fill="url(#g2)" d="M289.87,441.43h0l43.42.2a4.22,4.22,0,0,0,3-7.19L296.52,394.3a4.22,4.22,0,0,0-7.21,3Z" transform="translate(-266.64 -382.41)"/></svg>`;
        const logoDataUri = 'data:image/svg+xml;base64,' + btoa(logoSvg);

        // Gradient divider as SVG image (for email compatibility)
        const dividerSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="3" height="90"><defs><linearGradient id="dg" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#11c5ce"/><stop offset="40%" stop-color="#5986d8"/><stop offset="70%" stop-color="#895cdf"/><stop offset="100%" stop-color="#e40eeb"/></linearGradient></defs><rect width="3" height="90" rx="1.5" fill="url(#dg)"/></svg>`;
        const dividerUri = 'data:image/svg+xml;base64,' + btoa(dividerSvg);

        const signatureHtml = `
<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1e293b;">
    <!-- Main Row: Photo | Logo | Divider | Name/Contact -->
    <tr>
        <td style="vertical-align:middle;padding-right:15px;">
            ${photoHtml}
        </td>
        <td style="vertical-align:middle;padding-right:15px;">
            <img src="${logoDataUri}" alt="Revent" width="110" style="display:block;">
        </td>
        <td style="vertical-align:middle;padding-right:15px;">
            <img src="${dividerUri}" alt="" width="3" height="90" style="display:block;">
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
    ${(linkedin || twitter) ? `<tr><td colspan="4" style="padding-top:12px;">${linkedin ? `<a href="${linkedin}" style="text-decoration:none;margin-right:10px;"><img src="${linkedinIconUri}" width="22" height="22" style="vertical-align:middle;"></a>` : ''}${twitter ? `<a href="${twitter}" style="text-decoration:none;"><img src="${twitterIconUri}" width="22" height="22" style="vertical-align:middle;"></a>` : ''}</td></tr>` : ''}
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
