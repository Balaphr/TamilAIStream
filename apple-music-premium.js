'use strict';

// ============================================
// Apple Music Premium - Tamil AI Stream
// Premium music-app style sections
// ============================================

const AMPremium = {
    init() {
        this.renderAllSections();
        this.initScrollReveal();
        this.initCarouselNavigation();
        console.log('[AMPremium] Apple Music Premium sections loaded');
    },

    // ============================================
    // Data Helpers
    // ============================================
    getPublishedSongs() {
        return (DataStore.getSongs() || []).filter(s => s.status === 'published');
    },

    getActiveStations() {
        return (DataStore.getStations() || []).filter(s => s.status === 'active');
    },

    getArtistHits() {
        return (DataStore.getArtistHits() || []).filter(a => a.status === 'active');
    },

    // ============================================
    // 1. Made for You - AI personalized cards
    // ============================================
    renderMadeForYou() {
        const track = document.querySelector('#amMadeForYouCarousel .am-carousel-track');
        if (!track) return;

        const stations = this.getActiveStations();
        const songs = this.getPublishedSongs();

        const mfyItems = [
            {
                title: 'Daily Mix 1',
                desc: 'Your personalized Tamil hits mix',
                art: stations[0]?.thumbnail || '',
                bg: stations[0]?.gradient || 'linear-gradient(135deg,#1a4731,#0d2b1f)',
                badge: 'AI Pick',
                play: () => stations[0] ? playStation(stations[0].name) : null
            },
            {
                title: 'Tamil Classics Reimagined',
                desc: 'Timeless Tamil melodies curated for you',
                art: songs[5]?.albumCover || '',
                bg: 'linear-gradient(135deg,#2d1b4e,#1a1035)',
                badge: 'Curated',
                play: () => songs[5] ? playSong(songs[5], songs) : null
            },
            {
                title: 'Workout Energy',
                desc: 'High-energy Tamil tracks to keep you moving',
                art: songs[0]?.albumCover || '',
                bg: 'linear-gradient(135deg,#4a1a1a,#2d0f0f)',
                badge: 'Mood',
                play: () => songs[0] ? playSong(songs[0], songs) : null
            },
            {
                title: 'Chill Tamil Vibes',
                desc: 'Relaxing Tamil music for unwinding',
                art: songs[3]?.albumCover || '',
                bg: 'linear-gradient(135deg,#1b2d4a,#0f1a2d)',
                badge: 'Mood',
                play: () => songs[3] ? playSong(songs[3], songs) : null
            },
            {
                title: 'Tamil Rock Essentials',
                desc: 'The best of Tamil rock music',
                art: stations[2]?.thumbnail || '',
                bg: stations[2]?.gradient || 'linear-gradient(135deg,#3d1a1a,#2d0f0f)',
                badge: 'New',
                play: () => stations[2] ? playStation(stations[2].name) : null
            },
            {
                title: 'Late Night Tamil',
                desc: 'Smooth Tamil tracks for late nights',
                art: songs[4]?.albumCover || '',
                bg: 'linear-gradient(135deg,#1a1a3d,#0f0f2d)',
                badge: 'AI Pick',
                play: () => songs[4] ? playSong(songs[4], songs) : null
            }
        ];

        track.innerHTML = mfyItems.map((item, i) => `
            <div class="am-mfy-card am-reveal" style="transition-delay:${i * 0.08}s">
                <div class="am-mfy-card-art" style="background:${item.bg}">
                    ${item.art ? `<img src="${item.art}" alt="${item.title}" loading="lazy" onerror="this.style.display='none'">` : ''}
                    <span class="am-mfy-card-badge"><i class="fas fa-wand-magic-sparkles"></i> ${item.badge}</span>
                    <button class="am-mfy-card-play" data-index="${i}"><i class="fas fa-play" style="margin-left:2px"></i></button>
                </div>
                <div class="am-mfy-card-info">
                    <div class="am-mfy-card-title">${item.title}</div>
                    <div class="am-mfy-card-desc">${item.desc}</div>
                </div>
            </div>
        `).join('');

        track.querySelectorAll('.am-mfy-card-play').forEach((btn, i) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                mfyItems[i].play();
            });
        });
    },

    // ============================================
    // 2. New Releases - Songs sorted by date
    // ============================================
    renderNewReleases() {
        const track = document.querySelector('#amNewReleasesCarousel .am-carousel-track');
        if (!track) return;

        const songs = this.getPublishedSongs()
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
            .slice(0, 15);

        if (!songs.length) {
            track.innerHTML = '<div class="am-empty"><i class="fas fa-music"></i><p>No new releases yet</p></div>';
            return;
        }

        track.innerHTML = songs.map((song, i) => `
            <div class="am-new-release-card am-reveal" data-song-id="${song.id}" style="transition-delay:${i * 0.06}s">
                <div class="am-new-release-art">
                    <img src="${song.albumCover || song.cover || ''}" alt="${song.title}" loading="lazy"
                         onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 200 200%22%3E%3Crect width=%22200%22 height=%22200%22 fill=%22%231a1a1a%22/%3E%3Ccircle cx=%22100%22 cy=%22100%22 r=%2240%22 fill=%22%2334d399%22 opacity=%220.2%22/%3E%3Cpath d=%22M90 80 L90 130 L120 105Z%22 fill=%22%2334d399%22 opacity=%220.4%22/%3E%3C/svg%3E'">
                    <button class="am-new-release-play" data-song-idx="${i}"><i class="fas fa-play" style="margin-left:2px"></i></button>
                </div>
                <div class="am-new-release-title" title="${song.title}">${song.title}</div>
                <div class="am-new-release-artist">${song.artist}</div>
            </div>
        `).join('');

        track.querySelectorAll('.am-new-release-card').forEach((card, i) => {
            card.addEventListener('click', () => playSong(songs[i], songs));
        });
    },

    // ============================================
    // 3. Top Charts - Numbered song list
    // ============================================
    renderTopCharts() {
        const container = document.getElementById('amTopChartsList');
        if (!container) return;

        const songs = this.getPublishedSongs().slice(0, 10);

        if (!songs.length) {
            container.innerHTML = '<div class="am-empty"><i class="fas fa-chart-line"></i><p>No chart data available</p></div>';
            return;
        }

        container.innerHTML = songs.map((song, i) => `
            <div class="am-chart-item am-reveal" data-song-id="${song.id}" style="transition-delay:${i * 0.04}s">
                <span class="am-chart-rank">${i + 1}</span>
                <div class="am-chart-art">
                    <img src="${song.albumCover || song.cover || ''}" alt="${song.title}" loading="lazy"
                         onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 48 48%22%3E%3Crect width=%2248%22 height=%2248%22 fill=%22%231a1a1a%22/%3E%3Ccircle cx=%2224%22 cy=%2224%22 r=%2212%22 fill=%22%2334d399%22 opacity=%220.3%22/%3E%3C/svg%3E'">
                </div>
                <div class="am-chart-info">
                    <div class="am-chart-title">${song.title}</div>
                    <div class="am-chart-artist">${song.artist}</div>
                </div>
                <span class="am-chart-duration">${song.duration || ''}</span>
                <button class="am-chart-play"><i class="fas fa-play"></i></button>
            </div>
        `).join('');

        container.querySelectorAll('.am-chart-item').forEach((item, i) => {
            item.addEventListener('click', () => playSong(songs[i], songs));
        });
    },

    // ============================================
    // 4. Curated Playlists - Editorial cards
    // ============================================
    renderCuratedPlaylists() {
        const track = document.querySelector('#amCuratedPlaylistsCarousel .am-carousel-track');
        if (!track) return;

        const stations = this.getActiveStations();
        const songs = this.getPublishedSongs();

        const playlists = [
            {
                title: 'Tamil FM Top 20',
                desc: 'The biggest Tamil radio hits this week',
                art: stations[0]?.thumbnail || '',
                bg: stations[0]?.gradient || 'linear-gradient(135deg,#0f3b2e,#064e3b)',
                play: () => stations[0] ? playStation(stations[0].name) : null
            },
            {
                title: 'Anirudh Special',
                desc: 'Best of Anirudh Ravichander',
                art: songs[0]?.albumCover || '',
                bg: 'linear-gradient(135deg,#1a2744,#0f1a2d)',
                play: () => songs[0] ? playSong(songs[0], songs) : null
            },
            {
                title: 'A.R. Rahman Collection',
                desc: 'Timeless masterpieces',
                art: songs[5]?.albumCover || '',
                bg: 'linear-gradient(135deg,#3d1f1a,#2d140f)',
                play: () => songs[5] ? playSong(songs[5], songs) : null
            },
            {
                title: '90s Tamil Nostalgia',
                desc: 'Classic Tamil hits from the 90s',
                art: stations[1]?.thumbnail || '',
                bg: stations[1]?.gradient || 'linear-gradient(135deg,#2d1a44,#1a0f2d)',
                play: () => stations[1] ? playStation(stations[1].name) : null
            },
            {
                title: 'Tamil Dance Party',
                desc: 'Non-stop Tamil dance hits',
                art: songs[2]?.albumCover || '',
                bg: 'linear-gradient(135deg,#1a4433,#0f2d1f)',
                play: () => songs[2] ? playSong(songs[2], songs) : null
            }
        ];

        track.innerHTML = playlists.map((pl, i) => `
            <div class="am-curated-card am-reveal" style="transition-delay:${i * 0.08}s">
                <div class="am-curated-art" style="background:${pl.bg}">
                    ${pl.art ? `<img src="${pl.art}" alt="${pl.title}" loading="lazy" onerror="this.style.display='none'">` : ''}
                    <div class="am-curated-overlay">
                        <button class="am-curated-play"><i class="fas fa-play" style="margin-left:2px"></i></button>
                    </div>
                </div>
                <div class="am-curated-title">${pl.title}</div>
                <div class="am-curated-desc">${pl.desc}</div>
            </div>
        `).join('');

        track.querySelectorAll('.am-curated-play').forEach((btn, i) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                playlists[i].play();
            });
        });
    },

    // ============================================
    // 5. Recently Played Carousel
    // ============================================
    renderRecentlyPlayed() {
        const track = document.querySelector('#amRecentlyPlayedCarousel .am-carousel-track');
        if (!track) return;

        let history = [];
        try {
            if (typeof YTMusic !== 'undefined' && YTMusic.history) {
                history = YTMusic.history.slice(-12).reverse();
            } else {
                history = (DataStore.getHistory() || []).slice(-12).reverse();
            }
        } catch(e) {}

        if (!history.length) {
            track.innerHTML = '<div class="am-empty"><i class="fas fa-clock-rotate-left"></i><p>Start listening to see your recent tracks</p></div>';
            return;
        }

        track.innerHTML = history.map((item, i) => `
            <div class="am-new-release-card am-reveal" data-history-idx="${i}" style="transition-delay:${i * 0.06}s">
                <div class="am-new-release-art">
                    <img src="${item.thumbnail || item.albumCover || ''}" alt="${item.title}" loading="lazy"
                         onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 200 200%22%3E%3Crect width=%22200%22 height=%22200%22 fill=%22%231a1a1a%22/%3E%3Ccircle cx=%22100%22 cy=%22100%22 r=%2240%22 fill=%22%2334d399%22 opacity=%220.2%22/%3E%3C/svg%3E'">
                    <button class="am-new-release-play"><i class="fas fa-play" style="margin-left:2px"></i></button>
                </div>
                <div class="am-new-release-title" title="${item.title}">${item.title}</div>
                <div class="am-new-release-artist">${item.artist || ''}</div>
            </div>
        `).join('');

        track.querySelectorAll('.am-new-release-card').forEach((card, i) => {
            card.addEventListener('click', () => {
                const item = history[i];
                if (item && item.streamUrl) {
                    playStation(item.title);
                } else if (item) {
                    playSong(item, history);
                }
            });
        });
    },

    // ============================================
    // 6. Artist Essentials - Featured artists
    // ============================================
    renderArtistEssentials() {
        const track = document.querySelector('#amArtistEssentialsCarousel .am-carousel-track');
        if (!track) return;

        const artistHits = this.getArtistHits();

        if (!artistHits.length) {
            track.innerHTML = '<div class="am-empty"><i class="fas fa-star"></i><p>Artist collections coming soon</p></div>';
            return;
        }

        track.innerHTML = artistHits.map((artist, i) => {
            const thumbSrc = artist.thumbnail || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 140 140'%3E%3Ccircle cx='70' cy='55' r='35' fill='%2334d399' opacity='0.25'/%3E%3Cpath d='M40 120 Q70 135 100 120 L100 140 L40 140Z' fill='%2334d399' opacity='0.2'/%3E%3Ccircle cx='70' cy='55' r='20' fill='%2334d399' opacity='0.35'/%3E%3C/svg%3E";
            return `
                <div class="am-artist-card am-reveal" data-artist="${artist.artist}" style="transition-delay:${i * 0.06}s">
                    <div class="am-artist-avatar" style="background:${artist.gradient || 'linear-gradient(135deg,#1e3a5f,#0d1f3c)'}">
                        <img src="${thumbSrc}" alt="${artist.name}" loading="lazy"
                             ${artist.thumbnail ? `onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 140 140\\'%3E%3Ccircle cx=\\'70\\' cy=\\'55\\' r=\\'35\\' fill=\\'%2334d399\\' opacity=\\'0.25\\'/%3E%3C/svg%3E'"` : ''}>
                        <div class="am-artist-avatar-play"><i class="fas fa-play" style="margin-left:2px"></i></div>
                    </div>
                    <div class="am-artist-name">${artist.name}</div>
                    <div class="am-artist-meta">${artist.songCount} songs</div>
                </div>
            `;
        }).join('');

        track.querySelectorAll('.am-artist-card').forEach((card) => {
            const artistKey = card.dataset.artist;
            card.addEventListener('click', (e) => {
                if (e.target.closest('.am-artist-avatar-play')) {
                    const hit = artistHits.find(h => h.artist === artistKey);
                    if (hit && hit.songs && hit.songs.length) {
                        const firstSong = hit.songs[0];
                        if (firstSong.audioUrl) playSong(firstSong, hit.songs);
                        else if (typeof showToast === 'function') showToast('Playing ' + hit.name, 'info');
                    }
                    return;
                }
                if (typeof openPlaylistPage === 'function') {
                    openPlaylistPage(artistKey, card.querySelector('.am-artist-name').textContent, card.querySelector('.am-artist-meta').textContent);
                }
            });
        });
    },

    // ============================================
    // Render All Sections
    // ============================================
    renderAllSections() {
        this.renderMadeForYou();
        this.renderNewReleases();
        this.renderTopCharts();
        this.renderCuratedPlaylists();
        this.renderRecentlyPlayed();
        this.renderArtistEssentials();
    },

    // ============================================
    // Scroll-Reveal System
    // ============================================
    initScrollReveal() {
        if (!('IntersectionObserver' in window)) {
            document.querySelectorAll('.am-reveal').forEach(el => el.classList.add('am-revealed'));
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('am-revealed');
                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        });

        document.querySelectorAll('.am-reveal').forEach(el => observer.observe(el));

        const sectionObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('am-revealed');
                    sectionObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.05 });

        document.querySelectorAll('.am-section').forEach(el => {
            if (!el.classList.contains('am-reveal')) {
                el.classList.add('am-reveal');
            }
            sectionObserver.observe(el);
        });
    },

    // ============================================
    // Carousel Navigation
    // ============================================
    initCarouselNavigation() {
        document.querySelectorAll('.am-carousel-prev, .am-carousel-next').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetId = btn.dataset.target;
                const carousel = document.getElementById(targetId);
                if (!carousel) return;
                const track = carousel.querySelector('.am-carousel-track');
                if (!track) return;
                const scrollAmount = track.clientWidth * 0.75;
                if (btn.classList.contains('am-carousel-prev')) {
                    track.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
                } else {
                    track.scrollBy({ left: scrollAmount, behavior: 'smooth' });
                }
            });
        });
    }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        AMPremium.init();
    }, 350);
});
