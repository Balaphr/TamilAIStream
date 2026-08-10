'use strict';

/* ============================================
   AI Automation Core - TamilAI.Stream Builder
   Metadata extraction, duplicate detection,
   content categorization, playlist generation
   ============================================ */

const AIAutomation = (() => {

    /* ---- Audio Metadata Extraction ---- */
    async function extractAudioMetadata(file) {
        const meta = {
            duration: 0,
            bitrate: 0,
            sampleRate: 0,
            channels: 0,
            format: '',
            fileSize: file.size,
            fileName: file.name,
            hash: ''
        };

        try {
            meta.hash = await computeFileHash(file);
        } catch (e) { /* hash failed, continue */ }

        try {
            const url = URL.createObjectURL(file);
            const audio = new Audio();
            audio.preload = 'auto';

            await new Promise((resolve, reject) => {
                audio.addEventListener('loadedmetadata', resolve, { once: true });
                audio.addEventListener('error', reject, { once: true });
                audio.src = url;
                setTimeout(resolve, 5000);
            });

            meta.duration = audio.duration || 0;
            if (isFinite(meta.duration) && meta.duration > 0) {
                meta.duration = Math.round(meta.duration);
            } else {
                meta.duration = 0;
            }

            URL.revokeObjectURL(url);
        } catch (e) {
            meta.duration = 0;
        }

        meta.format = guessFormat(file.name, file.type);
        return meta;
    }

    async function computeFileHash(file) {
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let hash = 0;
        const sampleSize = Math.min(bytes.length, 1024 * 64);
        const step = Math.max(1, Math.floor(bytes.length / sampleSize));
        for (let i = 0; i < bytes.length; i += step) {
            hash = ((hash << 5) - hash + bytes[i]) | 0;
        }
        return 'h_' + Math.abs(hash).toString(36);
    }

    function guessFormat(name, mime) {
        const ext = (name || '').split('.').pop().toLowerCase();
        const formats = { mp3: 'MP3', wav: 'WAV', ogg: 'OGG', aac: 'AAC', m4a: 'M4A', flac: 'FLAC', wma: 'WMA' };
        if (formats[ext]) return formats[ext];
        if (mime) {
            if (mime.includes('mpeg') || mime.includes('mp3')) return 'MP3';
            if (mime.includes('ogg')) return 'OGG';
            if (mime.includes('wav')) return 'WAV';
            if (mime.includes('aac') || mime.includes('m4a')) return 'AAC';
        }
        return ext.toUpperCase() || 'Unknown';
    }

    /* ---- Filename Intelligence ---- */
    function parseFilenameIntelligence(filename) {
        const clean = filename
            .replace(/\.[^.]+$/, '')
            .replace(/[_\-]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        const result = {
            title: '',
            artist: '',
            movie: '',
            year: '',
            language: '',
            genre: '',
            mood: '',
            tags: []
        };

        const yearMatch = clean.match(/\b(19[5-9]\d|20[0-2]\d)\b/);
        if (yearMatch) {
            result.year = yearMatch[1];
        }

        const langPatterns = [
            { pattern: /\b(tamil|தமிழ்)\b/i, lang: 'Tamil' },
            { pattern: /\b(hindi|हिन्दी)\b/i, lang: 'Hindi' },
            { pattern: /\b(english)\b/i, lang: 'English' },
            { pattern: /\b(telugu|తెలుగు)\b/i, lang: 'Telugu' },
            { pattern: /\b(malayalam|മലയാളം)\b/i, lang: 'Malayalam' },
            { pattern: /\b(kannada|ಕನ್ನಡ)\b/i, lang: 'Kannada' },
            { pattern: /\b(french|français)\b/i, lang: 'French' },
            { pattern: /\b(japanese|日本語)\b/i, lang: 'Japanese' },
            { pattern: /\b(korean|한국어)\b/i, lang: 'Korean' },
            { pattern: /\b(chinese|中文)\b/i, lang: 'Chinese' },
            { pattern: /\b(arabic|عربي)\b/i, lang: 'Arabic' },
            { pattern: /\b(spanish|español)\b/i, lang: 'Spanish' },
            { pattern: /\b(portuguese|português)\b/i, lang: 'Portuguese' }
        ];
        for (const lp of langPatterns) {
            if (lp.pattern.test(clean)) {
                result.language = lp.lang;
                break;
            }
        }

        const genrePatterns = [
            { pattern: /\b(devotional|devotion|pooja|prayer|temple|god|deity|praise)\b/i, genre: 'Devotional', mood: 'Peaceful', tags: ['devotional', 'spiritual'] },
            { pattern: /\b(love|romantic|romance|heart|affection|prem|kaadhal)\b/i, genre: 'Romance', mood: 'Romantic', tags: ['love', 'romantic'] },
            { pattern: /\b(dance|club|party|beat|dj|remix)\b/i, genre: 'Dance', mood: 'Energetic', tags: ['dance', 'party'] },
            { pattern: /\b(sad|sorrow|pain|heartbreak|viraha|weep)\b/i, genre: 'Melody', mood: 'Sad', tags: ['melody', 'emotional'] },
            { pattern: /\b(action|fight|mass|hero|power)\b/i, genre: 'Action', mood: 'Energetic', tags: ['action', 'mass'] },
            { pattern: /\b(bgm|theme|instrumental|instrument|piano|violin|flute)\b/i, genre: 'Instrumental', mood: 'Relaxing', tags: ['instrumental', 'bgm'] },
            { pattern: /\b(folk|traditional|culture|native|gaana)\b/i, genre: 'Folk', mood: 'Energetic', tags: ['folk', 'traditional'] },
            { pattern: /\b(hip.?hop|rap|trap)\b/i, genre: 'Hip Hop', mood: 'Energetic', tags: ['hiphop', 'rap'] },
            { pattern: /\b(chill|lofi|lo-fi|chillhop|study)\b/i, genre: 'Lo-fi', mood: 'Relaxing', tags: ['lofi', 'chill'] },
            { pattern: /\b workout|gym|fitness|exercise/i, genre: 'Workout', mood: 'Energetic', tags: ['workout', 'fitness'] },
            { pattern: /\b(lullaby|sleep|night|soothing|cradle)\b/i, genre: 'Lullaby', mood: 'Peaceful', tags: ['sleep', 'lullaby'] },
            { pattern: /\b(comedy|funny|humor)\b/i, genre: 'Comedy', mood: 'Happy', tags: ['comedy', 'funny'] },
            { pattern: /\b(patriotic|national|india|bharat)\b/i, genre: 'Patriotic', mood: 'Inspiring', tags: ['patriotic', 'national'] }
        ];
        for (const gp of genrePatterns) {
            if (gp.pattern.test(clean)) {
                result.genre = gp.genre;
                result.mood = gp.mood;
                result.tags.push(...gp.tags);
                break;
            }
        }

        const artistSep = clean.indexOf(' - ');
        const dashSep = clean.indexOf(' – ');
        const pipeSep = clean.indexOf(' | ');
        let titlePart = clean;
        let artistPart = '';

        if (artistSep > 0) {
            titlePart = clean.substring(0, artistSep).trim();
            artistPart = clean.substring(artistSep + 3).trim();
        } else if (dashSep > 0) {
            titlePart = clean.substring(0, dashSep).trim();
            artistPart = clean.substring(dashSep + 3).trim();
        } else if (pipeSep > 0) {
            titlePart = clean.substring(0, pipeSep).trim();
            artistPart = clean.substring(pipeSep + 3).trim();
        }

        const moviePatterns = [
            /\bfrom\s+(.+?)(?:\s+|\(|$)/i,
            /\b\[(.+?)\]/i,
            /\b\((.+?)\)/i
        ];
        for (const mp of moviePatterns) {
            const m = clean.match(mp);
            if (m) {
                result.movie = m[1].trim();
                titlePart = titlePart.replace(mp, '').trim();
                break;
            }
        }

        result.title = titlePart || clean;
        result.artist = artistPart || '';

        if (!result.language) {
            result.language = 'Tamil';
        }

        return result;
    }

    /* ---- Duplicate Detection ---- */
    function detectDuplicates(newSong, existingSongs) {
        const duplicates = [];
        for (const existing of existingSongs) {
            const score = computeSimilarity(newSong, existing);
            if (score >= 0.85) {
                duplicates.push({ song: existing, score: Math.round(score * 100) });
            }
        }
        duplicates.sort((a, b) => b.score - a.score);
        return duplicates;
    }

    function computeSimilarity(a, b) {
        let score = 0;
        let factors = 0;

        if (a.hash && b.hash) {
            if (a.hash === b.hash) return 1.0;
            factors += 3;
        }

        if (a.title && b.title) {
            score += stringSimilarity(normalize(a.title), normalize(b.title)) * 2;
            factors += 2;
        }
        if (a.artist && b.artist) {
            score += stringSimilarity(normalize(a.artist), normalize(b.artist)) * 1.5;
            factors += 1.5;
        }
        if (a.movie && b.movie) {
            score += stringSimilarity(normalize(a.movie), normalize(b.movie));
            factors += 1;
        }
        if (a.duration && b.duration) {
            const durDiff = Math.abs(a.duration - b.duration);
            if (durDiff < 3) score += 1;
            else if (durDiff < 10) score += 0.5;
            factors += 1;
        }

        return factors > 0 ? score / factors : 0;
    }

    function normalize(str) {
        return (str || '').toLowerCase().replace(/[^a-z0-9\u0B80-\u0BFF]/g, '').trim();
    }

    function stringSimilarity(a, b) {
        if (!a || !b) return 0;
        if (a === b) return 1;
        const longer = a.length > b.length ? a : b;
        const shorter = a.length > b.length ? b : a;
        if (longer.length === 0) return 1;
        return (longer.length - editDistance(longer, shorter)) / longer.length;
    }

    function editDistance(a, b) {
        const matrix = [];
        for (let i = 0; i <= b.length; i++) matrix[i] = [i];
        for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b[i - 1] === a[j - 1]) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        return matrix[b.length][a.length];
    }

    /* ---- Content Auto-Categorization ---- */
    function categorizeSong(song) {
        const result = {
            sections: [],
            playlists: [],
            tags: song.tags ? [...song.tags] : [],
            category: song.genre || 'Other',
            mood: song.mood || 'Neutral'
        };

        result.sections.push('recently-added');

        const genreSections = {
            'Devotional': 'devotional',
            'Romance': 'romance',
            'Dance': 'dance',
            'Melody': 'melody',
            'Action': 'action',
            'Folk': 'folk',
            'Hip Hop': 'hiphop',
            'Lo-fi': 'chill',
            'Workout': 'workout',
            'Instrumental': 'instrumental'
        };
        if (song.genre && genreSections[song.genre]) {
            result.sections.push(genreSections[song.genre]);
        }

        if (song.mood) {
            const moodMap = {
                'Happy': 'feel-good',
                'Sad': 'melancholy',
                'Romantic': 'romance',
                'Energetic': 'energetic',
                'Peaceful': 'calm',
                'Relaxing': 'chill',
                'Inspiring': 'motivational',
                'Aggressive': 'intense'
            };
            if (moodMap[song.mood]) {
                result.playlists.push(moodMap[song.mood]);
            }
        }

        if (song.artist) {
            result.playlists.push('artist-' + normalize(song.artist));
            result.tags.push(song.artist.toLowerCase());
        }
        if (song.movie) {
            result.playlists.push('movie-' + normalize(song.movie));
            result.tags.push(song.movie.toLowerCase());
        }

        return result;
    }

    /* ---- AI Playlist Generation ---- */
    function generatePlaylistFromDescription(description, songs) {
        const lower = description.toLowerCase();
        const matched = [];

        const moodKeywords = {
            'peaceful': ['Peaceful', 'Relaxing'],
            'calm': ['Peaceful', 'Relaxing'],
            'relaxing': ['Relaxing', 'Peaceful'],
            'romantic': ['Romantic'],
            'love': ['Romantic'],
            'sad': ['Sad'],
            'melancholy': ['Sad'],
            'happy': ['Happy'],
            'energetic': ['Energetic'],
            'dance': ['Energetic'],
            'workout': ['Energetic'],
            'devotional': ['Devotional'],
            'spiritual': ['Devotional'],
            'chill': ['Relaxing'],
            'focus': ['Instrumental', 'Relaxing'],
            'party': ['Energetic'],
            'night': ['Romantic', 'Relaxing'],
            'morning': ['Peaceful', 'Energetic'],
            'intense': ['Energetic'],
            'emotional': ['Sad', 'Romantic']
        };

        const genreKeywords = {
            'devotional': 'Devotional',
            'romance': 'Romance',
            'romantic': 'Romance',
            'dance': 'Dance',
            'melody': 'Melody',
            'folk': 'Folk',
            'instrumental': 'Instrumental',
            'hip hop': 'Hip Hop',
            'lofi': 'Lo-fi',
            'action': 'Action'
        };

        let targetMoods = [];
        let targetGenre = '';

        for (const [keyword, moods] of Object.entries(moodKeywords)) {
            if (lower.includes(keyword)) {
                targetMoods.push(...moods);
            }
        }
        for (const [keyword, genre] of Object.entries(genreKeywords)) {
            if (lower.includes(keyword)) {
                targetGenre = genre;
                break;
            }
        }
        targetMoods = [...new Set(targetMoods)];

        for (const song of songs) {
            if (song.status !== 'published' && song.status !== 'active') continue;
            let score = 0;

            if (targetGenre && song.genre === targetGenre) score += 3;
            if (targetMoods.length > 0 && targetMoods.includes(song.mood)) score += 2;

            for (const tag of (song.tags || [])) {
                for (const keyword of lower.split(/\s+/)) {
                    if (tag.includes(keyword) || keyword.includes(tag)) score += 1;
                }
            }

            if (song.artist) {
                for (const keyword of lower.split(/\s+/)) {
                    if (song.artist.toLowerCase().includes(keyword)) score += 2;
                }
            }
            if (song.movie) {
                for (const keyword of lower.split(/\s+/)) {
                    if (song.movie.toLowerCase().includes(keyword)) score += 1;
                }
            }

            if (score > 0) {
                matched.push({ song, score });
            }
        }

        if (matched.length === 0 && songs.length > 0) {
            const published = songs.filter(s => s.status === 'published' || s.status === 'active');
            const shuffled = [...published].sort(() => Math.random() - 0.5);
            return shuffled.slice(0, 20);
        }

        matched.sort((a, b) => b.score - a.score);
        return matched.map(m => m.song).slice(0, 30);
    }

    /* ---- AI Lyrics Processing ---- */
    function parseLyrics(lyricsText) {
        if (!lyricsText || !lyricsText.trim()) return [];

        const lines = lyricsText.split('\n').filter(l => l.trim());
        const parsed = [];

        const timestampRegex = /^\[?(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]?\s*(.*)$/;

        let hasTimestamps = false;
        for (const line of lines) {
            const match = line.match(timestampRegex);
            if (match) {
                hasTimestamps = true;
                const minutes = parseInt(match[1], 10);
                const seconds = parseInt(match[2], 10);
                const ms = match[3] ? parseInt(match[3].padEnd(3, '0'), 10) : 0;
                const time = minutes * 60 + seconds + ms / 1000;
                const text = match[4].trim();
                if (text) {
                    parsed.push({ time, text });
                }
            }
        }

        if (!hasTimestamps) {
            const estimatedDuration = lines.length * 4;
            const interval = lines.length > 0 ? estimatedDuration / lines.length : 4;
            for (let i = 0; i < lines.length; i++) {
                parsed.push({
                    time: Math.round(i * interval * 10) / 10,
                    text: lines[i].trim()
                });
            }
        }

        return parsed;
    }

    function findCurrentLyricLine(lyrics, currentTime) {
        if (!lyrics || lyrics.length === 0) return -1;
        let idx = -1;
        for (let i = 0; i < lyrics.length; i++) {
            if (lyrics[i].time <= currentTime) {
                idx = i;
            } else {
                break;
            }
        }
        return idx;
    }

    /* ---- Publish Pre-Check ---- */
    function runPublishChecks(dataStore) {
        const issues = [];

        const songs = dataStore.getSongs ? dataStore.getSongs() : (dataStore.songs || []);
        const stations = dataStore.getStations ? dataStore.getStations() : (dataStore.stations || []);
        const images = dataStore.getImages ? dataStore.getImages() : (dataStore.images || []);

        for (const song of songs) {
            if (!song.id) issues.push({ type: 'error', category: 'Songs', message: `Song missing ID: ${song.title || 'Unknown'}` });
            if (!song.title) issues.push({ type: 'warning', category: 'Songs', message: `Song missing title (ID: ${song.id})` });
            if (!song.audioUrl && !song.streamUrl) issues.push({ type: 'error', category: 'Songs', message: `Song "${song.title || song.id}" missing audio URL` });
            if (!song.artist) issues.push({ type: 'info', category: 'Songs', message: `Song "${song.title}" missing artist` });
            if (!song.duration || song.duration <= 0) issues.push({ type: 'info', category: 'Songs', message: `Song "${song.title}" missing duration` });
            if (!song.albumCover && !song.thumbnail) issues.push({ type: 'info', category: 'Songs', message: `Song "${song.title}" missing artwork` });

            if (song.albumCover && !isValidUrl(song.albumCover)) {
                issues.push({ type: 'error', category: 'Songs', message: `Song "${song.title}" has broken artwork URL` });
            }
            if (song.audioUrl && !isValidUrl(song.audioUrl)) {
                issues.push({ type: 'error', category: 'Songs', message: `Song "${song.title}" has broken audio URL` });
            }
        }

        for (const station of stations) {
            if (!station.name) issues.push({ type: 'warning', category: 'Stations', message: `Station missing name (ID: ${station.id})` });
            if (!station.streamUrl) issues.push({ type: 'error', category: 'Stations', message: `Station "${station.name || station.id}" missing stream URL` });
            if (station.streamUrl && !isValidUrl(station.streamUrl)) {
                issues.push({ type: 'error', category: 'Stations', message: `Station "${station.name}" has broken stream URL` });
            }
            if (station.thumbnail && !isValidUrl(station.thumbnail)) {
                issues.push({ type: 'warning', category: 'Stations', message: `Station "${station.name}" has broken thumbnail URL` });
            }
        }

        const titleCounts = {};
        for (const song of songs) {
            const key = normalize(song.title) + '|' + normalize(song.artist);
            if (titleCounts[key]) {
                titleCounts[key].push(song);
            } else {
                titleCounts[key] = [song];
            }
        }
        for (const [key, group] of Object.entries(titleCounts)) {
            if (group.length > 1) {
                issues.push({
                    type: 'warning',
                    category: 'Duplicates',
                    message: `Possible duplicate: "${group[0].title}" by ${group[0].artist} (${group.length} copies)`
                });
            }
        }

        const siteSettings = dataStore.getSiteSettings ? dataStore.getSiteSettings() : (dataStore.siteSettings || {});
        if (!siteSettings.title) issues.push({ type: 'warning', category: 'Settings', message: 'Site title not configured' });
        if (!siteSettings.description) issues.push({ type: 'info', category: 'Settings', message: 'Site description not set' });

        const errors = issues.filter(i => i.type === 'error').length;
        const warnings = issues.filter(i => i.type === 'warning').length;
        const infos = issues.filter(i => i.type === 'info').length;

        return {
            passed: errors === 0,
            errors,
            warnings,
            infos,
            total: issues.length,
            issues,
            summary: errors === 0
                ? `Ready to publish (${warnings} warnings, ${infos} suggestions)`
                : `Cannot publish: ${errors} errors, ${warnings} warnings`
        };
    }

    function isValidUrl(str) {
        if (!str) return false;
        if (str.startsWith('data:')) return true;
        if (str.startsWith('/')) return true;
        try { new URL(str); return true; } catch { return false; }
    }

    /* ---- AI Command Processing ---- */
    function processCommand(command, dataStore) {
        const lower = command.toLowerCase().trim();
        const result = { actions: [], response: '' };

        if (lower.includes('add') && lower.includes('recently')) {
            const songName = extractSongName(command);
            const songs = dataStore.getSongs ? dataStore.getSongs() : [];
            const song = songs.find(s => s.title && s.title.toLowerCase().includes(songName.toLowerCase()));
            if (song) {
                result.actions.push({ type: 'add-to-section', song, section: 'recently-added' });
                result.response = `Added "${song.title}" to Recently Added.`;
            } else {
                result.response = `Could not find a song matching "${songName}".`;
            }
        } else if (lower.includes('create') && lower.includes('playlist')) {
            const playlistName = extractPlaylistName(command);
            const songs = dataStore.getSongs ? dataStore.getSongs() : [];
            const matched = generatePlaylistFromDescription(command, songs);
            if (matched.length > 0) {
                result.actions.push({ type: 'create-playlist', name: playlistName, songs: matched });
                result.response = `Created playlist "${playlistName}" with ${matched.length} songs.`;
            } else {
                result.response = `No matching songs found for "${playlistName}".`;
            }
        } else if (lower.includes('hide') || lower.includes('show')) {
            const section = extractSectionName(command);
            const action = lower.includes('hide') ? 'hide' : 'show';
            if (section) {
                result.actions.push({ type: 'toggle-visibility', section, visible: action === 'show' });
                result.response = `${action === 'hide' ? 'Hidden' : 'Shown'} section "${section}".`;
            } else {
                result.response = 'Please specify which section to hide or show.';
            }
        } else if (lower.includes('move') && (lower.includes('above') || lower.includes('below') || lower.includes('above'))) {
            const source = extractSectionName(command);
            const target = extractTargetSection(command);
            if (source && target) {
                const direction = lower.includes('above') || lower.includes('before') ? 'before' : 'after';
                result.actions.push({ type: 'reorder-section', source, target, direction });
                result.response = `Moved "${source}" ${direction} "${target}".`;
            } else {
                result.response = 'Please specify which sections to move.';
            }
        } else if (lower.includes('duplicate') || lower.includes('duplicate')) {
            const songName = extractSongName(command);
            const songs = dataStore.getSongs ? dataStore.getSongs() : [];
            const dupes = [];
            for (const song of songs) {
                for (const other of songs) {
                    if (song.id !== other.id && computeSimilarity(song, other) >= 0.85) {
                        dupes.push({ a: song, b: other, score: Math.round(computeSimilarity(song, other) * 100) });
                    }
                }
            }
            if (dupes.length > 0) {
                result.actions.push({ type: 'show-duplicates', duplicates: dupes });
                result.response = `Found ${dupes.length} possible duplicate pairs.`;
            } else {
                result.response = 'No duplicate songs found.';
            }
        } else if (lower.includes('fix') && lower.includes('seek')) {
            result.actions.push({ type: 'fix-seek' });
            result.response = 'Audio seek fix applied. The mini player and full player now use the correct audio element for seeking.';
        } else if (lower.includes('create') && lower.includes('playlist')) {
            const name = extractPlaylistName(command);
            const songs = dataStore.getSongs ? dataStore.getSongs() : [];
            const matched = generatePlaylistFromDescription(command, songs);
            result.actions.push({ type: 'create-playlist', name, songs: matched });
            result.response = `Created playlist "${name}" with ${matched.length} songs.`;
        } else if (lower.includes('check') || lower.includes('validate') || lower.includes('publish check')) {
            const checks = runPublishChecks(dataStore);
            result.actions.push({ type: 'publish-check', result: checks });
            result.response = checks.summary;
        } else {
            result.response = `I can help with:\n• Add songs to sections\n• Create playlists\n• Hide/show sections\n• Reorder sections\n• Find duplicates\n• Fix issues\n• Run publish checks\n\nTry: "Create a devotional playlist" or "Check for duplicates"`;
        }

        return result;
    }

    function extractSongName(cmd) {
        const patterns = [
            /add\s+"([^"]+)"/i,
            /add\s+(?:the\s+)?(?:song\s+)?(.+?)(?:\s+to|\s+in)/i,
            /find\s+(?:the\s+)?(?:song\s+)?(.+?)(?:\s*$)/i
        ];
        for (const p of patterns) {
            const m = cmd.match(p);
            if (m) return m[1].trim();
        }
        return cmd.replace(/add|to|the|song|recently|in|found|found/gi, '').trim();
    }

    function extractPlaylistName(cmd) {
        const patterns = [
            /create\s+(?:a\s+|an?\s+)?(?:playlist\s+)?(?:named?\s+)?["']?([^"']+?)["']?\s*(?:playlist|$)/i,
            /create\s+["']?([^"']+?)["']?$/i,
            /make\s+(?:a\s+|an?\s+)?["']?([^"']+?)["']?\s*(?:playlist|$)/i
        ];
        for (const p of patterns) {
            const m = cmd.match(p);
            if (m) return m[1].trim();
        }
        return 'My Playlist';
    }

    function extractSectionName(cmd) {
        const sections = ['recently added', 'featured', 'trending', 'categories', 'songs', 'stations', 'ai recommended', 'tamil hits'];
        for (const s of sections) {
            if (cmd.toLowerCase().includes(s)) return s;
        }
        return cmd.replace(/hide|show|section|the|on|mobile|desktop|tablet/gi, '').trim() || null;
    }

    function extractTargetSection(cmd) {
        const sections = ['recently added', 'featured', 'trending', 'categories', 'songs', 'stations', 'ai recommended', 'tamil hits'];
        for (const s of sections) {
            if (cmd.toLowerCase().includes(s)) return s;
        }
        return null;
    }

    /* ---- Public API ---- */
    return {
        extractAudioMetadata,
        computeFileHash,
        parseFilenameIntelligence,
        detectDuplicates,
        categorizeSong,
        generatePlaylistFromDescription,
        parseLyrics,
        findCurrentLyricLine,
        runPublishChecks,
        processCommand
    };
})();
