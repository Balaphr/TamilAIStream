/* ============================================
   Ads Manager — Builder CRUD Functions
   Tamil AI Stream Admin Builder
   ============================================ */

const AD_POSITIONS = {
    0: 'Hero (Top Carousel)',
    2: 'After Recently Added',
    3: 'After Trending',
    4: 'After Latest Releases'
};

const AD_LOCATION_LABELS = {
    home: 'Home Page',
    music: 'Music List',
    radio: 'Radio Section',
    news: 'News/Posts',
    between: 'Between Content',
    sticky: 'Bottom Sticky'
};

function toggleAdsMaster(enabled) {
    const settings = DataStore.getSiteSettings();
    settings.adsEnabled = enabled;
    DataStore.setSiteSettings(settings);
    showToast(enabled ? 'Ads system enabled' : 'Ads system disabled', enabled ? 'success' : 'info');
    syncToLiveWebsite();
}

function updateAdsStats() {
    const ads = DataStore.getAdvertisements() || [];
    const now = new Date().toISOString();
    const total = ads.length;
    const active = ads.filter(a => a.enabled !== false && (!a.endDate || a.endDate >= now) && (!a.startDate || a.startDate <= now)).length;
    const scheduled = ads.filter(a => a.startDate && a.startDate > now).length;
    const expired = ads.filter(a => a.endDate && a.endDate < now).length;
    const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
    el('adsStatTotal', total);
    el('adsStatActive', active);
    el('adsStatScheduled', scheduled);
    el('adsStatExpired', expired);
}

function loadAdsTable() {
    let ads = DataStore.getAdvertisements();
    ads = _filterDeletedItems(ads, 'advertisements');
    const tbody = document.getElementById('adsTableBody');
    const emptyState = document.getElementById('adsEmptyState');
    if (!tbody) return;

    var settings = DataStore.getSiteSettings();
    var toggle = document.getElementById('adsMasterToggle');
    if (toggle) toggle.checked = settings.adsEnabled !== false;

    updateAdsStats();

    if (!ads.length) {
        tbody.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }
    if (emptyState) emptyState.style.display = 'none';

    var now = new Date().toISOString();
    tbody.innerHTML = ads.sort(function(a, b) { return (b.priority || 0) - (a.priority || 0); }).map(function(ad) {
        var thumbSrc = ad.imageUrl || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 60'%3E%3Crect width='120' height='60' rx='6' fill='%23374151'/%3E%3Ctext x='60' y='35' text-anchor='middle' fill='%239ca3af' font-size='11'%3EAd Banner%3C/text%3E%3C/svg%3E";
        var loc = ad.location || 'home';
        var locLabel = AD_LOCATION_LABELS[loc] || loc;
        var priority = ad.priority || 0;
        var scheduleHtml = '<span style="color:#888;font-size:11px;">Always</span>';
        if (ad.startDate || ad.endDate) {
            var start = ad.startDate ? new Date(ad.startDate).toLocaleDateString() : '...';
            var end = ad.endDate ? new Date(ad.endDate).toLocaleDateString() : '...';
            scheduleHtml = '<span style="font-size:11px;color:#aaa;">' + start + ' &ndash; ' + end + '</span>';
        }
        var statusLabel = 'Active';
        var statusClass = 'active';
        if (ad.enabled === false) { statusLabel = 'Disabled'; statusClass = 'inactive'; }
        else if (ad.endDate && ad.endDate < now) { statusLabel = 'Expired'; statusClass = 'inactive'; }
        else if (ad.startDate && ad.startDate > now) { statusLabel = 'Scheduled'; statusClass = 'inactive'; }

        return '<tr>' +
            '<td data-label="Preview"><img src="' + thumbSrc + '" alt="' + (ad.title || '') + '" style="width:100px;height:50px;object-fit:cover;border-radius:6px;border:1px solid rgba(255,255,255,0.1);"></td>' +
            '<td data-label="Title"><strong>' + (ad.title || 'Untitled') + '</strong><br><small style="color:#888;">' + (ad.description || '') + '</small></td>' +
            '<td data-label="Location"><span style="background:rgba(168,85,247,0.15);color:#c084fc;padding:3px 10px;border-radius:12px;font-size:11px;">' + locLabel + '</span></td>' +
            '<td data-label="Priority"><span style="background:rgba(255,255,255,0.06);color:#aaa;padding:3px 10px;border-radius:12px;font-size:11px;">' + priority + '</span></td>' +
            '<td data-label="Schedule">' + scheduleHtml + '</td>' +
            '<td data-label="Status"><span class="status-badge ' + statusClass + '" style="cursor:pointer;" onclick="toggleAd(\'' + ad.id + '\')">' + statusLabel + '</span></td>' +
            '<td data-label="Actions"><div style="display:flex;gap:6px;">' +
            '<button class="builder-btn small" onclick="openEditAdModal(\'' + ad.id + '\')" title="Edit"><i class="fas fa-edit"></i></button>' +
            '<button class="builder-btn small danger" onclick="deleteAd(\'' + ad.id + '\')" title="Delete"><i class="fas fa-trash"></i></button>' +
            '</div></td></tr>';
    }).join('');
}

function openAddAdModal() {
    document.getElementById('adModalTitle').textContent = 'Add Advertisement';
    document.getElementById('adEditId').value = '';
    document.getElementById('adForm').reset();
    document.getElementById('adEnabled').value = 'true';
    document.getElementById('adLocation').value = 'home';
    document.getElementById('adPriority').value = '1';
    document.getElementById('adLabel').value = 'Sponsored';
    document.getElementById('adStartDate').value = '';
    document.getElementById('adEndDate').value = '';
    var preview = document.getElementById('adImagePreview');
    if (preview) preview.style.display = 'none';
    document.getElementById('adModalOverlay').style.display = 'flex';
}

function openEditAdModal(adId) {
    var ads = DataStore.getAdvertisements();
    var ad = ads.find(function(a) { return a.id === adId; });
    if (!ad) return;

    document.getElementById('adModalTitle').textContent = 'Edit Advertisement';
    document.getElementById('adEditId').value = ad.id;
    document.getElementById('adTitle').value = ad.title || '';
    document.getElementById('adDescription').value = ad.description || '';
    document.getElementById('adImageUrl').value = ad.imageUrl || '';
    document.getElementById('adTargetLink').value = ad.targetLink || '';
    document.getElementById('adLocation').value = ad.location || 'home';
    document.getElementById('adPriority').value = ad.priority || 1;
    document.getElementById('adEnabled').value = ad.enabled !== false ? 'true' : 'false';
    document.getElementById('adLabel').value = ad.label || 'Sponsored';
    document.getElementById('adStartDate').value = ad.startDate ? ad.startDate.slice(0, 16) : '';
    document.getElementById('adEndDate').value = ad.endDate ? ad.endDate.slice(0, 16) : '';

    var preview = document.getElementById('adImagePreview');
    if (ad.imageUrl && preview) {
        preview.querySelector('img').src = ad.imageUrl;
        preview.style.display = 'block';
    } else if (preview) {
        preview.style.display = 'none';
    }

    document.getElementById('adModalOverlay').style.display = 'flex';
}

function closeAdModal() {
    document.getElementById('adModalOverlay').style.display = 'none';
}

function previewAdForm() {
    var title = document.getElementById('adTitle').value || 'Ad Title';
    var imageUrl = document.getElementById('adImageUrl').value || '';
    var label = document.getElementById('adLabel').value || 'Sponsored';
    var loc = document.getElementById('adLocation').value;
    var locLabel = AD_LOCATION_LABELS[loc] || loc;

    var bannerHtml = imageUrl
        ? '<img src="' + imageUrl + '" style="width:100%;aspect-ratio:16/5;object-fit:cover;border-radius:14px 14px 0 0;">'
        : '<div style="height:80px;background:linear-gradient(135deg,#0d1330,#1a0a2e);display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.15);font-size:2rem;border-radius:14px 14px 0 0;"><i class="fas fa-ad"></i></div>';

    var html = '<div style="background:linear-gradient(145deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02));border:1px solid rgba(255,255,255,0.08);border-radius:14px;overflow:hidden;">' +
        bannerHtml +
        '<div style="padding:10px 16px;display:flex;align-items:center;justify-content:space-between;">' +
        '<div style="display:flex;align-items:center;gap:8px;">' +
        '<span style="background:rgba(168,85,247,0.12);border:1px solid rgba(168,85,247,0.2);color:#c084fc;padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;text-transform:uppercase;">' + label + '</span>' +
        '<span style="color:rgba(255,255,255,0.85);font-size:13px;font-weight:600;">' + title + '</span>' +
        '</div>' +
        '<span style="background:rgba(52,211,153,0.15);border:1px solid rgba(52,211,153,0.25);color:#6ee7b7;padding:4px 12px;border-radius:20px;font-size:11px;">Learn More</span>' +
        '</div></div>' +
        '<div style="margin-top:8px;font-size:11px;color:#888;">Location: ' + locLabel + '</div>';

    var w = window.open('', '_blank', 'width=500,height=300');
    if (w) {
        w.document.write('<html><head><title>Ad Preview</title><style>body{margin:0;padding:20px;background:#0a0c18;font-family:Inter,sans-serif;}</style></head><body>' + html + '</body></html>');
        w.document.close();
    }
}

async function saveAd(event) {
    event.preventDefault();
    var editId = document.getElementById('adEditId').value;
    var title = document.getElementById('adTitle').value.trim();
    var description = document.getElementById('adDescription').value.trim();
    var imageUrlInput = document.getElementById('adImageUrl').value.trim();
    var imageFile = document.getElementById('adImageFile').files[0];
    var targetLink = document.getElementById('adTargetLink').value.trim();
    var location = document.getElementById('adLocation').value || 'home';
    var priority = parseInt(document.getElementById('adPriority').value) || 1;
    var enabled = document.getElementById('adEnabled').value === 'true';
    var label = document.getElementById('adLabel').value.trim() || 'Sponsored';
    var startDateVal = document.getElementById('adStartDate').value;
    var endDateVal = document.getElementById('adEndDate').value;

    if (!title) { showToast('Title is required', 'warning'); return; }

    var imageUrl = imageUrlInput;
    var imagePublicId = '';

    if (imageFile) {
        try {
            var result = await R2Uploader.uploadImage(imageFile, 'tamil-ai-stream/banners', function(pct) {
                console.log('Upload progress:', pct + '%');
            });
            if (result && result.url) {
                imageUrl = result.url;
                imagePublicId = result.publicId || '';
            }
        } catch (err) {
            console.error('Banner upload failed:', err);
            showToast('Image upload failed. Using URL fallback.', 'warning');
            if (!imageUrl) { showToast('Please provide an image URL or file', 'error'); return; }
        }
    }

    if (!imageUrl) { showToast('Banner image is required', 'warning'); return; }

    var ads = DataStore.getAdvertisements();
    var now = new Date().toISOString();
    var startDate = startDateVal ? new Date(startDateVal).toISOString() : null;
    var endDate = endDateVal ? new Date(endDateVal).toISOString() : null;

    if (editId) {
        var idx = ads.findIndex(function(a) { return a.id === editId; });
        if (idx !== -1) {
            ads[idx] = Object.assign({}, ads[idx], {
                title: title, description: description, imageUrl: imageUrl,
                imagePublicId: imagePublicId || ads[idx].imagePublicId,
                targetLink: targetLink, location: location, priority: priority,
                enabled: enabled, label: label,
                startDate: startDate, endDate: endDate, updatedAt: now
            });
        }
    } else {
        ads.push({
            id: 'ad_' + Date.now(),
            title: title, description: description, imageUrl: imageUrl, imagePublicId: imagePublicId,
            targetLink: targetLink, location: location, priority: priority,
            enabled: enabled, label: label,
            startDate: startDate, endDate: endDate,
            createdAt: now, updatedAt: now
        });
    }

    DataStore.setAdvertisements(ads);
    closeAdModal();
    loadAdsTable();
    showToast(editId ? 'Advertisement updated' : 'Advertisement added', 'success');
    syncToLiveWebsite();
}

function deleteAd(adId) {
    if (!confirm('Move this advertisement to Trash?')) return;
    var ads = DataStore._getRaw(DataStore.KEYS.ADVERTISEMENTS) || [];
    var ad = ads.find(function(a) { return a.id === adId; });
    if (ad) DataStore.moveToTrash(ad, 'advertisements');
    ads = ads.filter(function(a) { return a.id !== adId; });
    localStorage.setItem(DataStore.KEYS.ADVERTISEMENTS, JSON.stringify(ads));
    loadAdsTable();
    showToast('Advertisement moved to Trash', 'success');
    syncToLiveWebsite();
}

function toggleAd(adId) {
    var ads = DataStore.getAdvertisements();
    var ad = ads.find(function(a) { return a.id === adId; });
    if (ad) {
        ad.enabled = !ad.enabled;
        ad.updatedAt = new Date().toISOString();
        DataStore.setAdvertisements(ads);
        loadAdsTable();
        showToast(ad.enabled ? 'Advertisement enabled' : 'Advertisement disabled', 'info');
        syncToLiveWebsite();
    }
}
