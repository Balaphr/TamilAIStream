'use strict';

/* ============================================
   AI Publish Check - TamilAI.Stream Builder
   Pre-publish validation with rich UI modal
   ============================================ */

const AIPublishCheck = (() => {
    let modalEl = null;

    function runAndShow() {
        const result = AIAutomation.runPublishChecks(DataStore);
        showModal(result);
        return result;
    }

    function showModal(result) {
        if (modalEl) modalEl.remove();
        modalEl = document.createElement('div');
        modalEl.className = 'modal';
        modalEl.style.display = 'flex';
        modalEl.id = 'aiPublishCheckModal';

        const statusIcon = result.passed ? '<i class="fas fa-check-circle" style="color:#10b981;"></i>' : '<i class="fas fa-times-circle" style="color:#ef4444;"></i>';
        const statusText = result.passed ? 'Ready to Publish' : 'Issues Found';
        const statusColor = result.passed ? '#10b981' : '#ef4444';

        let issuesHtml = '';
        if (result.issues.length > 0) {
            issuesHtml = '<div style="margin-top:16px;">';
            const grouped = {};
            for (const issue of result.issues) {
                if (!grouped[issue.category]) grouped[issue.category] = [];
                grouped[issue.category].push(issue);
            }
            for (const [cat, items] of Object.entries(grouped)) {
                issuesHtml += '<div style="margin-bottom:12px;">';
                issuesHtml += '<div style="font-weight:600;font-size:13px;color:#c4b5fd;margin-bottom:6px;">' + escapeHtml(cat) + ' (' + items.length + ')</div>';
                for (const issue of items) {
                    const icon = issue.type === 'error' ? '<i class="fas fa-exclamation-circle" style="color:#ef4444;"></i>' :
                                 issue.type === 'warning' ? '<i class="fas fa-exclamation-triangle" style="color:#f59e0b;"></i>' :
                                 '<i class="fas fa-info-circle" style="color:#3b82f6;"></i>';
                    issuesHtml += '<div style="display:flex;gap:8px;padding:6px 10px;border-radius:6px;background:rgba(255,255,255,0.03);margin-bottom:4px;font-size:13px;">';
                    issuesHtml += '<span style="flex-shrink:0;">' + icon + '</span>';
                    issuesHtml += '<span style="color:#d1d5db;">' + escapeHtml(issue.message) + '</span>';
                    issuesHtml += '</div>';
                }
                issuesHtml += '</div>';
            }
            issuesHtml += '</div>';
        } else {
            issuesHtml = '<div style="text-align:center;padding:20px 0;color:#10b981;"><i class="fas fa-check-double" style="font-size:32px;margin-bottom:8px;display:block;"></i>All checks passed. Your content is ready!</div>';
        }

        modalEl.innerHTML =
            '<div class="modal-overlay" onclick="AIPublishCheck.close()"></div>' +
            '<div class="modal-content" style="max-width:600px;">' +
                '<div class="modal-header">' +
                    '<h2>' + statusIcon + ' Publish Check</h2>' +
                    '<button class="modal-close" onclick="AIPublishCheck.close()">&times;</button>' +
                '</div>' +
                '<div class="modal-body" style="max-height:65vh;overflow-y:auto;">' +
                    '<div style="text-align:center;padding:16px 0 8px;">' +
                        '<div style="font-size:42px;margin-bottom:6px;">' + (result.passed ? '&#9989;' : '&#10060;') + '</div>' +
                        '<div style="font-size:17px;font-weight:600;color:' + statusColor + ';">' + statusText + '</div>' +
                        '<div style="font-size:13px;color:#9ca3af;margin-top:4px;">' + escapeHtml(result.summary) + '</div>' +
                    '</div>' +
                    '<div style="display:flex;gap:10px;margin:12px 0 16px;">' +
                        '<div style="flex:1;background:rgba(239,68,68,0.12);border-radius:10px;padding:12px;text-align:center;">' +
                            '<div style="font-size:22px;font-weight:700;color:#ef4444;">' + result.errors + '</div>' +
                            '<div style="font-size:10px;color:#ef4444;text-transform:uppercase;letter-spacing:0.5px;">Errors</div>' +
                        '</div>' +
                        '<div style="flex:1;background:rgba(245,158,11,0.12);border-radius:10px;padding:12px;text-align:center;">' +
                            '<div style="font-size:22px;font-weight:700;color:#f59e0b;">' + result.warnings + '</div>' +
                            '<div style="font-size:10px;color:#f59e0b;text-transform:uppercase;letter-spacing:0.5px;">Warnings</div>' +
                        '</div>' +
                        '<div style="flex:1;background:rgba(59,130,246,0.12);border-radius:10px;padding:12px;text-align:center;">' +
                            '<div style="font-size:22px;font-weight:700;color:#3b82f6;">' + result.infos + '</div>' +
                            '<div style="font-size:10px;color:#3b82f6;text-transform:uppercase;letter-spacing:0.5px;">Info</div>' +
                        '</div>' +
                    '</div>' +
                    issuesHtml +
                '</div>' +
                '<div style="padding:12px 20px;border-top:1px solid rgba(255,255,255,0.1);display:flex;gap:8px;justify-content:flex-end;">' +
                    (result.passed
                        ? '<button class="builder-btn primary" onclick="AIPublishCheck.close();publishChanges()"><i class="fas fa-rocket"></i> Publish Now</button>'
                        : '<button class="builder-btn" disabled style="opacity:0.5;cursor:not-allowed;" title="Fix errors first"><i class="fas fa-ban"></i> Publish Blocked</button>'
                    ) +
                    '<button class="builder-btn" onclick="AIPublishCheck.close()">Close</button>' +
                '</div>' +
            '</div>';

        document.body.appendChild(modalEl);
    }

    function close() {
        if (modalEl) { modalEl.remove(); modalEl = null; }
    }

    function escapeHtml(str) {
        const d = document.createElement('div');
        d.textContent = str || '';
        return d.innerHTML;
    }

    return { runAndShow, close };
})();

if (typeof window !== 'undefined') window.AIPublishCheck = AIPublishCheck;
