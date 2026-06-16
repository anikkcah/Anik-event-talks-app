// Global State
let releaseNotesData = [];
let activeFilter = 'all';
let searchQuery = '';
let selectedUpdateForTweet = null;

// DOM Elements
const feedContent = document.getElementById('feed-content');
const loadingState = document.getElementById('loading-state');
const errorState = document.getElementById('error-state');
const errorMessage = document.getElementById('error-message');
const emptyState = document.getElementById('empty-state');
const refreshBtn = document.getElementById('refresh-btn');
const refreshIcon = document.getElementById('refresh-icon');
const exportCsvBtn = document.getElementById('export-csv-btn');
const searchInput = document.getElementById('search-input');
const statusSummary = document.getElementById('status-summary');
const filterChips = document.querySelectorAll('.filter-chip');
const retryBtn = document.getElementById('retry-btn');

// Modal Elements
const tweetModal = document.getElementById('tweet-modal');
const tweetTextarea = document.getElementById('tweet-textarea');
const tweetRefTitle = document.getElementById('tweet-ref-title');
const charCount = document.getElementById('char-count');
const progressCircle = document.querySelector('.progress-ring__circle');
const copyTweetBtn = document.getElementById('copy-tweet-btn');
const publishTweetBtn = document.getElementById('publish-tweet-btn');
const cancelTweetBtn = document.getElementById('cancel-tweet-btn');
const closeModalBtn = document.getElementById('close-modal-btn');

// Toast Elements
const toast = document.getElementById('toast');
const toastIcon = document.getElementById('toast-icon');
const toastMessage = document.getElementById('toast-message');

// SVG Circle Constants for Character Progress Ring
const RING_RADIUS = 8;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

// Initialize Progress Ring
if (progressCircle) {
    progressCircle.style.strokeDasharray = `${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`;
    progressCircle.style.strokeDashoffset = RING_CIRCUMFERENCE;
}

// -------------------------------------------------------------
// Feed Parsing Utility
// Splits daily updates (e.g., h3 Feature, h3 Change) into items
// -------------------------------------------------------------
function parseReleaseContent(html, dateStr, link) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    const parsedItems = [];
    let currentCategory = 'Other';
    let currentBodyParts = [];
    
    // If the content is empty
    if (!html || html.trim() === '') {
        return [{
            id: btoa(dateStr + '-empty'),
            date: dateStr,
            link: link,
            category: 'Other',
            bodyHtml: '<p>No description provided.</p>',
            plainText: 'No description provided.'
        }];
    }
    
    // Iterate elements to separate by headings (h3/h4/h2)
    const children = Array.from(tempDiv.children);
    
    if (children.length === 0) {
        // Fallback if content has no HTML tag wrapper
        return [{
            id: btoa(dateStr + '-plain'),
            date: dateStr,
            link: link,
            category: 'Other',
            bodyHtml: `<p>${html}</p>`,
            plainText: tempDiv.textContent.trim()
        }];
    }
    
    children.forEach((child) => {
        const tagName = child.tagName.toLowerCase();
        
        if (tagName === 'h3' || tagName === 'h4' || tagName === 'h2') {
            // Push previous item if exists
            if (currentBodyParts.length > 0) {
                const itemHtml = currentBodyParts.join('');
                const parser = new DOMParser();
                const doc = parser.parseFromString(itemHtml, 'text/html');
                const text = doc.body.textContent || '';
                
                parsedItems.push({
                    id: btoa(dateStr + '-' + currentCategory + '-' + parsedItems.length),
                    date: dateStr,
                    link: link,
                    category: currentCategory,
                    bodyHtml: itemHtml,
                    plainText: text.trim()
                });
            }
            
            // Start new category group
            currentCategory = child.textContent.trim();
            currentBodyParts = [];
        } else {
            currentBodyParts.push(child.outerHTML);
        }
    });
    
    // Push the final item
    if (currentBodyParts.length > 0 || parsedItems.length === 0) {
        const itemHtml = currentBodyParts.length > 0 ? currentBodyParts.join('') : html;
        const parser = new DOMParser();
        const doc = parser.parseFromString(itemHtml, 'text/html');
        const text = doc.body.textContent || '';
        
        parsedItems.push({
            id: btoa(dateStr + '-' + currentCategory + '-' + parsedItems.length),
            date: dateStr,
            link: link,
            category: currentCategory,
            bodyHtml: itemHtml,
            plainText: text.trim()
        });
    }
    
    return parsedItems;
}

// -------------------------------------------------------------
// API Data Fetching
// -------------------------------------------------------------
async function fetchReleaseNotes(isRefresh = false) {
    // Show loading UI
    if (isRefresh) {
        refreshIcon.classList.add('spinning');
        refreshBtn.disabled = true;
    } else {
        showElement(loadingState);
        hideElement(feedContent);
        hideElement(errorState);
        hideElement(emptyState);
    }
    
    try {
        const response = await fetch('/api/release-notes');
        if (!response.ok) {
            throw new Error(`Server returned status ${response.status}`);
        }
        
        const data = await response.json();
        
        // Transform and store
        releaseNotesData = [];
        data.entries.forEach(entry => {
            const parsedItems = parseReleaseContent(entry.content_html, entry.date, entry.link);
            releaseNotesData.push({
                date: entry.date,
                link: entry.link,
                updated_iso: entry.updated_iso,
                items: parsedItems
            });
        });
        
        renderFeed();
        updateSummary();
        
        if (isRefresh) {
            showToast('Release notes updated successfully!');
        }
    } catch (error) {
        console.error('Error fetching release notes:', error);
        if (isRefresh) {
            showToast('Failed to refresh release notes', true);
        } else {
            errorMessage.textContent = error.message || 'Could not connect to the server.';
            showElement(errorState);
            hideElement(loadingState);
        }
    } finally {
        if (isRefresh) {
            refreshIcon.classList.remove('spinning');
            refreshBtn.disabled = false;
        } else {
            hideElement(loadingState);
        }
    }
}

// -------------------------------------------------------------
// UI Rendering
// -------------------------------------------------------------
function renderFeed() {
    feedContent.innerHTML = '';
    
    let visibleGroupsCount = 0;
    let visibleItemsCount = 0;
    
    releaseNotesData.forEach(group => {
        // Filter the items within the group
        const filteredItems = group.items.filter(item => {
            // Apply category filter
            let categoryMatch = false;
            if (activeFilter === 'all') {
                categoryMatch = true;
            } else if (activeFilter === 'Other') {
                // Other matches any category not matching the standard Feature/Change/Deprecated
                categoryMatch = !['Feature', 'Change', 'Deprecated'].includes(item.category);
            } else {
                categoryMatch = item.category.toLowerCase() === activeFilter.toLowerCase();
            }
            
            // Apply search query match
            let searchMatch = true;
            if (searchQuery.trim() !== '') {
                const query = searchQuery.toLowerCase();
                const textContent = item.plainText.toLowerCase();
                const catText = item.category.toLowerCase();
                const dateText = group.date.toLowerCase();
                searchMatch = textContent.includes(query) || catText.includes(query) || dateText.includes(query);
            }
            
            return categoryMatch && searchMatch;
        });
        
        if (filteredItems.length > 0) {
            visibleGroupsCount++;
            visibleItemsCount += filteredItems.length;
            
            // Create Group Card
            const groupCard = document.createElement('article');
            groupCard.className = 'release-group-card';
            
            // Group Header
            const groupHeader = document.createElement('div');
            groupHeader.className = 'group-header';
            groupHeader.innerHTML = `
                <div class="group-date">
                    <span class="material-symbols-outlined date-icon">event</span>
                    <h2>${group.date}</h2>
                </div>
                <a href="${group.link}" target="_blank" rel="noopener noreferrer" class="group-link">
                    <span>Source Doc</span>
                    <span class="material-symbols-outlined">open_in_new</span>
                </a>
            `;
            groupCard.appendChild(groupHeader);
            
            // Items list container
            const itemsContainer = document.createElement('div');
            itemsContainer.className = 'release-items';
            
            filteredItems.forEach(item => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'release-item';
                
                // Get Badge CSS Class
                let badgeClass = 'other';
                const cat = item.category.toLowerCase();
                if (cat === 'feature') badgeClass = 'feature';
                else if (cat === 'change') badgeClass = 'change';
                else if (cat === 'deprecated') badgeClass = 'deprecated';
                
                const itemHeader = document.createElement('div');
                itemHeader.className = 'release-item-header';
                
                // Set Badge Icon based on category
                let badgeIcon = 'info';
                if (cat === 'feature') badgeIcon = 'stars';
                else if (cat === 'change') badgeIcon = 'published_with_changes';
                else if (cat === 'deprecated') badgeIcon = 'unpublished';
                
                itemHeader.innerHTML = `
                    <span class="category-badge ${badgeClass}">
                        <span class="material-symbols-outlined" style="font-size: 0.9rem;">${badgeIcon}</span>
                        ${item.category}
                    </span>
                `;
                
                // Button Group Wrapper
                const itemActions = document.createElement('div');
                itemActions.className = 'item-actions';

                // Copy Button
                const copyBtn = document.createElement('button');
                copyBtn.className = 'copy-item-btn';
                copyBtn.innerHTML = `
                    <span class="material-symbols-outlined" style="font-size: 0.95rem;">content_copy</span>
                    <span>Copy</span>
                `;
                copyBtn.addEventListener('click', async () => {
                    try {
                        const copyText = `BigQuery Update (${group.date} - ${item.category}):\n"${item.plainText}"\n\nSource: ${item.link}`;
                        await navigator.clipboard.writeText(copyText);
                        showToast('Copied to clipboard!');
                    } catch (err) {
                        console.error('Failed to copy text: ', err);
                        showToast('Failed to copy to clipboard', true);
                    }
                });

                // Tweet Button for this entry
                const tweetBtn = document.createElement('button');
                tweetBtn.className = 'tweet-item-btn';
                tweetBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" width="14" height="14">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path>
                    </svg>
                    <span>Tweet</span>
                `;
                
                tweetBtn.addEventListener('click', () => {
                    openTweetComposer(item, group.date);
                });
                
                itemActions.appendChild(copyBtn);
                itemActions.appendChild(tweetBtn);
                itemHeader.appendChild(itemActions);
                itemDiv.appendChild(itemHeader);
                
                // Content Body
                const itemBody = document.createElement('div');
                itemBody.className = 'release-body';
                itemBody.innerHTML = item.bodyHtml;
                
                itemDiv.appendChild(itemBody);
                itemsContainer.appendChild(itemDiv);
            });
            
            groupCard.appendChild(itemsContainer);
            feedContent.appendChild(groupCard);
        }
    });
    
    // Toggle displays based on visibility
    if (visibleItemsCount === 0) {
        hideElement(feedContent);
        showElement(emptyState);
    } else {
        showElement(feedContent);
        hideElement(emptyState);
    }
}

function updateSummary() {
    let totalItems = 0;
    releaseNotesData.forEach(g => totalItems += g.items.length);
    
    if (totalItems === 0) {
        statusSummary.textContent = 'No updates loaded.';
        return;
    }
    
    if (searchQuery.trim() !== '' || activeFilter !== 'all') {
        const visibleItems = document.querySelectorAll('.release-item').length;
        statusSummary.textContent = `Showing ${visibleItems} of ${totalItems} updates.`;
    } else {
        statusSummary.textContent = `Latest ${totalItems} updates parsed.`;
    }
}

// -------------------------------------------------------------
// Twitter Composer Handlers
// -------------------------------------------------------------
function openTweetComposer(item, dateStr) {
    selectedUpdateForTweet = item;
    
    tweetRefTitle.textContent = `${dateStr} (${item.category})`;
    
    // Pre-populate clean text description
    // Strip hashtags or format clean tweet text
    let cleanDesc = item.plainText;
    
    // Truncate to leave space for branding, link, and tags
    // Max tweet size = 280. 
    // Extra elements: "BigQuery Update [Date] ([Cat]): " (approx 35 chars) + "\n\n#BigQuery #GoogleCloud\n" (25 chars) + " [Link]" (25 chars)
    // Safe text length is around 180 chars.
    const brandingHeader = `BigQuery Update (${dateStr}): [${item.category}] `;
    const brandingFooter = `\n\n#BigQuery #GoogleCloud\n${item.link}`;
    
    const availableLength = 280 - brandingHeader.length - brandingFooter.length;
    
    if (cleanDesc.length > availableLength) {
        cleanDesc = cleanDesc.substring(0, availableLength - 3) + '...';
    }
    
    const draftText = `${brandingHeader}"${cleanDesc}"${brandingFooter}`;
    
    tweetTextarea.value = draftText;
    updateCharacterCount();
    
    // Show Modal
    showElement(tweetModal);
    tweetTextarea.focus();
}

function updateCharacterCount() {
    const text = tweetTextarea.value;
    const length = text.length;
    
    charCount.textContent = length;
    
    // Warning styling
    const countWrapper = document.querySelector('.character-count-wrapper');
    if (length > 280) {
        countWrapper.className = 'character-count-wrapper exceeded';
        publishTweetBtn.disabled = true;
    } else if (length > 250) {
        countWrapper.className = 'character-count-wrapper warning';
        publishTweetBtn.disabled = false;
    } else {
        countWrapper.className = 'character-count-wrapper';
        publishTweetBtn.disabled = false;
    }
    
    // Progress Ring offset computation
    const percentage = Math.min(length / 280, 1);
    const offset = RING_CIRCUMFERENCE - (percentage * RING_CIRCUMFERENCE);
    progressCircle.style.strokeDashoffset = offset;
    
    // Color changes based on status
    if (length > 280) {
        progressCircle.style.stroke = '#ef4444'; // Red
    } else if (length > 250) {
        progressCircle.style.stroke = '#f59e0b'; // Orange
    } else {
        progressCircle.style.stroke = '#1d9bf0'; // Twitter Blue
    }
}

function closeTweetComposer() {
    hideElement(tweetModal);
    selectedUpdateForTweet = null;
}

// Copy draft to clipboard
async function copyTweetToClipboard() {
    const text = tweetTextarea.value;
    try {
        await navigator.clipboard.writeText(text);
        showToast('Tweet copied to clipboard!');
    } catch (err) {
        console.error('Failed to copy text: ', err);
        showToast('Failed to copy to clipboard', true);
    }
}

// Publish (Open Web Intent)
function publishTweet() {
    const text = tweetTextarea.value;
    if (text.length > 280) {
        showToast('Tweet text exceeds 280 characters!', true);
        return;
    }
    
    const encodedText = encodeURIComponent(text);
    const twitterIntentUrl = `https://twitter.com/intent/tweet?text=${encodedText}`;
    
    window.open(twitterIntentUrl, '_blank', 'noopener,noreferrer');
    closeTweetComposer();
    showToast('Redirected to Twitter X intent!');
}

// -------------------------------------------------------------
// Global Helper UI Functions
// -------------------------------------------------------------
function showElement(el) {
    el.classList.remove('hidden');
}

function hideElement(el) {
    el.classList.add('hidden');
}

function showToast(message, isError = false) {
    toastMessage.textContent = message;
    
    if (isError) {
        toastIcon.textContent = 'error_outline';
        toastIcon.className = 'toast-icon error';
    } else {
        toastIcon.textContent = 'check_circle';
        toastIcon.className = 'toast-icon';
    }
    
    showElement(toast);
    
    // Fade out after 3.5 seconds
    setTimeout(() => {
        hideElement(toast);
    }, 3500);
}

// -------------------------------------------------------------
// Export Release Notes to CSV
// -------------------------------------------------------------
function exportToCSV() {
    if (releaseNotesData.length === 0) {
        showToast('No data to export', true);
        return;
    }
    
    const csvRows = [];
    csvRows.push(['Date', 'Category', 'Update Content', 'Source Link']);
    
    let exportCount = 0;
    
    releaseNotesData.forEach(group => {
        group.items.forEach(item => {
            let categoryMatch = false;
            if (activeFilter === 'all') {
                categoryMatch = true;
            } else if (activeFilter === 'Other') {
                categoryMatch = !['Feature', 'Change', 'Deprecated'].includes(item.category);
            } else {
                categoryMatch = item.category.toLowerCase() === activeFilter.toLowerCase();
            }
            
            let searchMatch = true;
            if (searchQuery.trim() !== '') {
                const query = searchQuery.toLowerCase();
                const textContent = item.plainText.toLowerCase();
                const catText = item.category.toLowerCase();
                const dateText = group.date.toLowerCase();
                searchMatch = textContent.includes(query) || catText.includes(query) || dateText.includes(query);
            }
            
            if (categoryMatch && searchMatch) {
                // Escape fields for CSV format
                const date = group.date.replace(/"/g, '""');
                const category = item.category.replace(/"/g, '""');
                const content = item.plainText.replace(/"/g, '""');
                const link = item.link.replace(/"/g, '""');
                
                csvRows.push([`"${date}"`, `"${category}"`, `"${content}"`, `"${link}"`]);
                exportCount++;
            }
        });
    });
    
    if (exportCount === 0) {
        showToast('No updates match your filters to export', true);
        return;
    }
    
    const csvContent = csvRows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `bigquery_release_notes_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast(`Exported ${exportCount} updates to CSV!`);
}

// -------------------------------------------------------------
// Event Listeners
// -------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    // Initial fetch
    fetchReleaseNotes();
    
    // Refresh handlers
    refreshBtn.addEventListener('click', () => fetchReleaseNotes(true));
    retryBtn.addEventListener('click', () => fetchReleaseNotes(false));
    exportCsvBtn.addEventListener('click', exportToCSV);
    
    // Search input handlers (Debounced or quick)
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        renderFeed();
        updateSummary();
    });
    
    // Filters handlers
    filterChips.forEach(chip => {
        chip.addEventListener('click', (e) => {
            // Remove active from all
            filterChips.forEach(c => c.classList.remove('active'));
            // Add active to current
            chip.classList.add('active');
            
            activeFilter = chip.getAttribute('data-type');
            renderFeed();
            updateSummary();
        });
    });
    
    // Modal events
    closeModalBtn.addEventListener('click', closeTweetComposer);
    cancelTweetBtn.addEventListener('click', closeTweetComposer);
    copyTweetBtn.addEventListener('click', copyTweetToClipboard);
    publishTweetBtn.addEventListener('click', publishTweet);
    tweetTextarea.addEventListener('input', updateCharacterCount);
    
    // Close modal on click outside card
    tweetModal.addEventListener('click', (e) => {
        if (e.target === tweetModal) {
            closeTweetComposer();
        }
    });
});
