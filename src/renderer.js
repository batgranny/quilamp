import JSZip from 'jszip';
import 'jsmediatags/dist/jsmediatags.min.js';

// Basic audio player state
const audio = new Audio();
let trackList = [];
let currentTrackIndex = -1;
// Global player state for easier debugging and persistence
window.playerState = {
    isShuffle: false,
    isRepeat: false,
    displayRemaining: false
};
const trackMetadata = {}; // Cache for metadata { title, artist }

// DOM Elements
const timeDisplay = document.getElementById('time-display');
const trackNameDisplay = document.querySelector('.marquee span');
const titleText = document.querySelector('.title-text');
const btnPlay = document.getElementById('btn-play');
const btnPause = document.getElementById('btn-pause');
const btnStop = document.getElementById('btn-stop');
const btnNext = document.getElementById('btn-next');
const btnPrev = document.getElementById('btn-prev');
const btnEject = document.getElementById('btn-eject');
const volumeSlider = document.getElementById('volume-slider');
const volumeThumb = document.getElementById('volume-thumb');
const panSlider = document.getElementById('pan-slider');
const panThumb = document.getElementById('pan-thumb');
const playlistItemsContainer = document.getElementById('playlist-items');
const btnMinimize = document.getElementById('btn-minimize');
const btnClose = document.getElementById('btn-close');
const btnShuffle = document.getElementById('btn-shuffle');
const btnRepeat = document.getElementById('btn-repeat');
const playlistToggleBtn = document.getElementById('pl-btn-close');
const playlistInner = document.getElementById('playlist-inner');
const playlistContainer = document.getElementById('playlist-container');
const kbpsDisplay = document.getElementById('kbps');
const khzDisplay = document.getElementById('khz');

// --- Web Audio API & Visualizer State ---
let audioCtx = null;
let analyser = null;
let source = null;
let visualizerCanvas = null;
let visualizerCtx = null;
let animationId = null;

// Built-in default Winamp spectrum colors (from bottom up: 17 to 2)
let visColors = new Array(24).fill('rgb(0,0,0)');
// Default palette values (approximate classic Winamp colors)
for (let i = 2; i <= 17; i++) {
    const green = Math.floor((17 - i) * (255 / 15));
    visColors[i] = `rgb(0, ${green}, 0)`;
}
visColors[23] = 'rgb(255, 255, 255)'; // Peak indicator
visColors[0] = 'rgb(0, 0, 0)';       // Background

// Peak tracking
const numBars = 18;
let peaks = new Array(numBars).fill(0);
let barHeights = new Array(numBars).fill(0);

function initVisualizer() {
    const container = document.querySelector('.visualizer');
    if (!container) return;

    visualizerCanvas = document.createElement('canvas');
    visualizerCanvas.width = 76;
    visualizerCanvas.height = 32;
    container.innerHTML = '';
    container.appendChild(visualizerCanvas);
    visualizerCtx = visualizerCanvas.getContext('2d');
}

function startVisualizer() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 1024;
        source = audioCtx.createMediaElementSource(audio);
        source.connect(analyser);
        analyser.connect(audioCtx.destination);
    }

    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    if (!animationId) {
        animate();
    }
}

function animate() {
    animationId = requestAnimationFrame(animate);
    if (!analyser || !visualizerCtx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const timeDataArray = new Uint8Array(analyser.fftSize);
    analyser.getByteFrequencyData(dataArray);
    analyser.getByteTimeDomainData(timeDataArray);

    // Stream to visualizer window if active
    if (window.electronAPI && window.electronAPI.sendAudioData) {
        window.electronAPI.sendAudioData({
            timeData: timeDataArray,
            freqData: dataArray
        });
    }

    const ctx = visualizerCtx;
    const w = visualizerCanvas.width;
    const h = visualizerCanvas.height;

    // Clear background (Background color is usually color index 0 in viscolor.txt, which is 0,0,0)
    ctx.fillStyle = visColors[0] || 'rgb(0,0,0)';
    ctx.fillRect(0, 0, w, h);

    const barWidth = 2; // Fixed winamp style bar width
    const gap = 1;
    const totalBarWidth = barWidth + gap;

    for (let i = 0; i < numBars; i++) {
        // Group frequency bins into bars. We focus on the lower/mid frequencies mostly.
        const binStart = Math.floor(i * (bufferLength / 2) / numBars);
        const binEnd = Math.floor((i + 1) * (bufferLength / 2) / numBars);
        let val = 0;
        for (let j = binStart; j < binEnd; j++) {
            val += dataArray[j];
        }
        val /= (binEnd - binStart);

        // Scale to canvas height
        let targetHeight = (val / 255) * h;

        // Gravity effect for bars
        if (targetHeight > barHeights[i]) {
            barHeights[i] = targetHeight;
        } else {
            barHeights[i] -= 1.2; // Fall speed
        }
        if (barHeights[i] < 0) barHeights[i] = 0;

        let drawHeight = Math.round(barHeights[i]);
        const x = i * totalBarWidth; // Removed horizontal offset to align flush left

        // Draw segmented bar (classic winamp style)
        for (let segment = 0; segment < drawHeight; segment += 2) {
            // Index 17 is bottom, index 2 is top
            const colorIndex = 17 - Math.floor((segment / h) * 15);
            ctx.fillStyle = visColors[colorIndex] || 'rgb(0,255,0)';
            ctx.fillRect(x, h - segment - 1, barWidth, 1);
        }

        // Peaks logic
        if (targetHeight >= peaks[i]) {
            peaks[i] = targetHeight;
        } else {
            peaks[i] -= 0.4; // Peaks fall slower
        }
        if (peaks[i] < 0) peaks[i] = 0;

        // Draw peak (standard Winamp uses index 23 for peak indicator)
        if (peaks[i] > 0) {
            ctx.fillStyle = visColors[23] || 'rgb(255,255,255)';
            ctx.fillRect(x, Math.round(h - peaks[i] - 1), barWidth, 1);
        }
    }
}

initVisualizer();

// --- End Visualizer State ---

// Window Controls
if (window.electronAPI) {
    if (btnMinimize) {
        btnMinimize.addEventListener('click', () => {
            window.electronAPI.minimizeWindow();
        });
    }
    if (btnClose) {
        btnClose.addEventListener('click', () => {
            window.electronAPI.closeWindow();
        });
    }

    if (playlistToggleBtn) {
        playlistToggleBtn.addEventListener('click', togglePlaylist);
    }

    window.electronAPI.onTogglePlaylist(() => {
        togglePlaylist();
    });
}

function togglePlaylist() {
    console.log('Toggling playlist visibility...');
    playlistContainer.classList.toggle('hidden');
    const isHidden = playlistContainer.classList.contains('hidden');

    if (isHidden) {
        // Player height: (116px + 2px borders) * 1.5 = 177px. 180px for safety.
        window.electronAPI.resizeWindow(413, 180);
    } else {
        // Default height with playlist
        window.electronAPI.resizeWindow(413, 696);
    }
}

// Custom Playlist Scrollbar Logic
function initPlaylistScrollbar() {
    const box = document.getElementById('playlist-box');
    const thumb = document.getElementById('playlist-scroll-thumb');
    const track = document.getElementById('playlist-scrollbar');

    if (!box || !thumb || !track) return;

    let dragging = false;
    let startY = 0;
    let startTop = 0;

    function updateThumb() {
        if (dragging) return;
        const maxScroll = box.scrollHeight - box.clientHeight;
        const trackHeight = track.clientHeight;
        const thumbHeight = thumb.clientHeight;
        const maxTop = Math.max(0, trackHeight - thumbHeight);

        if (maxScroll <= 0) {
            thumb.style.top = '0px';
            return;
        }

        const ratio = box.scrollTop / maxScroll;
        thumb.style.top = `${ratio * maxTop}px`;
    }

    box.addEventListener('scroll', updateThumb);
    box.addEventListener('playlistUpdated', updateThumb);
    window.addEventListener('resize', updateThumb);

    thumb.addEventListener('mousedown', (e) => {
        dragging = true;
        startY = e.clientY;
        startTop = parseFloat(thumb.style.top) || 0;
        e.preventDefault();
        e.stopPropagation();
    });

    document.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        const trackHeight = track.clientHeight;
        const thumbHeight = thumb.clientHeight;
        const maxTop = Math.max(0, trackHeight - thumbHeight);

        const deltaY = (e.clientY - startY) / CSS_ZOOM;
        let newTop = startTop + deltaY;
        newTop = Math.max(0, Math.min(newTop, maxTop));
        thumb.style.top = `${newTop}px`;

        const maxScroll = box.scrollHeight - box.clientHeight;
        if (maxScroll > 0 && maxTop > 0) {
            box.scrollTop = (newTop / maxTop) * maxScroll;
        }
    });

    document.addEventListener('mouseup', () => {
        dragging = false;
    });

    track.addEventListener('mousedown', (e) => {
        if (e.target === thumb) return;
        const rect = track.getBoundingClientRect();
        let mouseY = (e.clientY - rect.top) / CSS_ZOOM;
        const trackHeight = track.clientHeight;
        const thumbHeight = thumb.clientHeight;
        const maxTop = Math.max(0, trackHeight - thumbHeight);

        let newTop = mouseY - (thumbHeight / 2);
        newTop = Math.max(0, Math.min(newTop, maxTop));
        thumb.style.top = `${newTop}px`;

        const maxScroll = box.scrollHeight - box.clientHeight;
        if (maxScroll > 0 && maxTop > 0) {
            box.scrollTop = (newTop / maxTop) * maxScroll;
        }

        dragging = true;
        startY = e.clientY;
        startTop = newTop;
        e.preventDefault();
    });
}

initPlaylistScrollbar();

// Custom slider state
let volumeValue = 0.7; // 0-1 (70%)
let panValue = 0.5;    // 0-1 (0.5 = center)

// CSS zoom factor applied to the body — needed to correct getBoundingClientRect coordinates
const CSS_ZOOM = 1.5;

function makeDraggableSlider(track, thumb, initialValue, onChange, onStart, onEnd) {
    let dragging = false;
    let value = initialValue;
    let startX = 0;
    let startLeftCSS = 0;

    function positionThumb(ratio) {
        const logicalTrackWidth = parseFloat(getComputedStyle(track).width);
        const logicalThumbWidth = parseFloat(getComputedStyle(thumb).width);
        thumb.style.left = `${ratio * (logicalTrackWidth - logicalThumbWidth)}px`;
    }

    function getLogicalWidth(el) {
        return parseFloat(getComputedStyle(el).width);
    }

    function update(e) {
        if (!dragging) return;
        const logicalTrackWidth = getLogicalWidth(track);
        const logicalThumbWidth = getLogicalWidth(thumb);

        // Explicitly use the 1.5 zoom constant for screen -> logical conversion
        // This is much more robust than detecting it from getBoundingClientRect
        const deltaX = (e.clientX - startX) / CSS_ZOOM;
        let targetLeftCSS = startLeftCSS + deltaX;

        let maxLeftCSS = logicalTrackWidth - logicalThumbWidth;
        let clampedLeftCSS = Math.max(0, Math.min(maxLeftCSS, targetLeftCSS));

        value = maxLeftCSS > 0 ? clampedLeftCSS / maxLeftCSS : 0;
        thumb.style.left = `${clampedLeftCSS}px`;
        onChange(value);
    }

    positionThumb(value);
    setTimeout(() => positionThumb(value), 150);

    thumb.addEventListener('mousedown', (e) => {
        if (onStart) onStart(); // Call immediately to lock UI feedback

        dragging = true;
        startX = e.clientX;
        startLeftCSS = parseFloat(thumb.style.left) || 0;

        document.body.classList.add('dragging');
        e.preventDefault();
        e.stopPropagation();
    });

    track.addEventListener('mousedown', (e) => {
        if (onStart) onStart(); // Call immediately

        const rect = track.getBoundingClientRect();
        const logicalTrackWidth = getLogicalWidth(track);
        const logicalThumbWidth = getLogicalWidth(thumb);

        // Use the hardcoded zoom for calculating click position relative to logical pixels
        // We assume rect.left is in the same coordinate space as clientX (Physical/Viewport)
        // If it's not, the browser will likely report them both as CSS which also works.
        let mouseXCSS = (e.clientX - rect.left) / CSS_ZOOM;
        let targetLeftCSS = mouseXCSS - (logicalThumbWidth / 2);
        let maxLeftCSS = logicalTrackWidth - logicalThumbWidth;
        let clampedLeftCSS = Math.max(0, Math.min(maxLeftCSS, targetLeftCSS));

        value = maxLeftCSS > 0 ? clampedLeftCSS / maxLeftCSS : 0;
        thumb.style.left = `${clampedLeftCSS}px`;
        onChange(value);

        dragging = true;
        startX = e.clientX;
        startLeftCSS = clampedLeftCSS;

        document.body.classList.add('dragging');
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (dragging) update(e);
    });

    document.addEventListener('mouseup', () => {
        if (dragging) {
            document.body.classList.remove('dragging');
            if (onEnd) onEnd();
        }
        dragging = false;
    });

    return {
        getValue: () => value,
        setValue: (v) => { value = v; positionThumb(v); }
    };
}

const volumeControl = makeDraggableSlider(volumeSlider, volumeThumb, 0.7, (ratio) => {
    volumeValue = ratio;
    audio.volume = ratio;
    // Update track background row if skin is active
    const bmpUrl = getSkinUrl('--skin-volume-bg');
    if (bmpUrl) updateVolumeTrack(ratio, bmpUrl);
});

const panControl = makeDraggableSlider(panSlider, panThumb, 0.5, (ratio) => {
    panValue = ratio;
    // Update track background row if skin is active
    const bmpUrl = getSkinUrl('--skin-balance-bg');
    if (bmpUrl) updatePanTrack(ratio, bmpUrl);
});

// Sync initial audio volume
audio.volume = volumeValue;

// Helper – extract raw URL from a CSS custom property containing url("...")
function getSkinUrl(prop) {
    return document.documentElement.style.getPropertyValue(prop)
        .replace(/^url\(["']?/, '').replace(/["']?\)$/, '').trim();
}

// Format time in MM:SS
function formatTime(seconds) {
    if (isNaN(seconds)) return "00:00";
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

// Update time display
function updateTimeDisplay() {
    let seconds = audio.currentTime;
    if (window.playerState.displayRemaining) {
        const duration = audio.duration || window.currentTrackDuration;
        if (duration) {
            seconds = -(duration - audio.currentTime);
        }
    }

    if (isNaN(seconds)) {
        timeDisplay.textContent = "00:00";
        return;
    }

    const isNegative = seconds < 0;
    const absSeconds = Math.abs(seconds);
    const m = Math.floor(absSeconds / 60).toString().padStart(2, '0');
    const s = Math.floor(absSeconds % 60).toString().padStart(2, '0');
    timeDisplay.textContent = `${isNegative ? '-' : ''}${m}:${s}`;
}

audio.addEventListener('timeupdate', updateTimeDisplay);

// Toggle time display mode
if (timeDisplay) {
    timeDisplay.addEventListener('click', () => {
        window.playerState.displayRemaining = !window.playerState.displayRemaining;
        updateTimeDisplay();
    });
}

// Read ID3 tags from a file path using jsmediatags (browser-compatible)
function readID3Tags(filePath) {
    return new Promise((resolve) => {
        try {
            // jsmediatags can read from a URL
            window.jsmediatags.read(`file://${filePath}`, {
                onSuccess: (tag) => {
                    const title = tag.tags.title || null;
                    const artist = tag.tags.artist || null;
                    resolve({ title, artist });
                },
                onError: () => {
                    resolve({ title: null, artist: null });
                }
            });
        } catch (e) {
            resolve({ title: null, artist: null });
        }
    });
}

// Debounced playlist rendering to avoid flickering when metadata is fetched in bulk
let renderTimeout = null;
function debouncedRenderPlaylist() {
    if (renderTimeout) clearTimeout(renderTimeout);
    renderTimeout = setTimeout(() => {
        renderPlaylist();
    }, 50);
}

async function fetchMetadata(filePath) {
    if (trackMetadata[filePath]) return;

    let tags = null;
    if (window.electronAPI && window.electronAPI.getMetadata) {
        tags = await window.electronAPI.getMetadata(filePath);
    } else {
        tags = await readID3Tags(filePath);
    }

    if (tags && (tags.title || tags.artist)) {
        trackMetadata[filePath] = {
            title: tags.title,
            artist: tags.artist
        };
        debouncedRenderPlaylist();
    }
}

// Render Playlist
function renderPlaylist() {
    playlistItemsContainer.innerHTML = '';
    trackList.forEach((filePath, index) => {
        const metadata = trackMetadata[filePath];
        let displayName = filePath.split('/').pop().split('\\').pop(); // Default to filename

        if (metadata && metadata.title) {
            displayName = metadata.title;
        }

        const li = document.createElement('li');
        li.textContent = `${index + 1}. ${displayName}`;
        li.draggable = true;

        if (index === currentTrackIndex) {
            li.classList.add('active');
        }

        li.addEventListener('dblclick', () => {
            loadTrack(index);
        });

        // Drag and Drop events
        li.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', index);
            li.classList.add('dragging');
        });

        li.addEventListener('dragover', (e) => {
            e.preventDefault();
            li.classList.add('drag-over');
        });

        li.addEventListener('dragleave', () => {
            li.classList.remove('drag-over');
        });

        li.addEventListener('drop', (e) => {
            e.preventDefault();
            li.classList.remove('drag-over');
            const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
            const toIndex = index;

            if (fromIndex !== toIndex) {
                moveTrack(fromIndex, toIndex);
            }
        });

        li.addEventListener('dragend', () => {
            li.classList.remove('dragging');
        });

        playlistItemsContainer.appendChild(li);
    });

    // Notify scrollbar that heights may have changed
    const box = document.getElementById('playlist-box');
    if (box) box.dispatchEvent(new Event('playlistUpdated'));
}

function moveTrack(fromIndex, toIndex) {
    const item = trackList.splice(fromIndex, 1)[0];
    trackList.splice(toIndex, 0, item);

    // Update currentTrackIndex to follow the playing song
    if (currentTrackIndex === fromIndex) {
        currentTrackIndex = toIndex;
    } else if (fromIndex < currentTrackIndex && toIndex >= currentTrackIndex) {
        currentTrackIndex--;
    } else if (fromIndex > currentTrackIndex && toIndex <= currentTrackIndex) {
        currentTrackIndex++;
    }

    renderPlaylist();
}

// Update track name and play
async function loadTrack(index) {
    if (index >= 0 && index < trackList.length) {
        currentTrackIndex = index;
        const filePath = trackList[index];
        const fileName = filePath.split('/').pop().split('\\').pop().replace(/\.[^/.]+$/, '');

        // Show filename first as fallback
        trackNameDisplay.textContent = `${index + 1}. ${fileName}`;

        // Load local file
        audio.src = `file://${filePath}`;
        audio.play();
        startVisualizer();
        renderPlaylist();

        // Try to read metadata via IPC if not already cached
        window.currentTrackDuration = 0;

        const cached = trackMetadata[filePath];
        if (cached && cached.title) {
            if (cached.artist) {
                trackNameDisplay.textContent = `${cached.artist} - ${cached.title}`;
            } else {
                trackNameDisplay.textContent = cached.title;
            }
        }

        if (window.electronAPI && window.electronAPI.getMetadata) {
            const tags = await window.electronAPI.getMetadata(filePath);
            if (tags) {
                if (tags.duration) window.currentTrackDuration = tags.duration;

                // Update cache if missing or new info found
                if (!trackMetadata[filePath] || !trackMetadata[filePath].title) {
                    trackMetadata[filePath] = { title: tags.title, artist: tags.artist };
                    renderPlaylist();
                }

                if (tags.artist && tags.title) {
                    trackNameDisplay.textContent = `${tags.artist} - ${tags.title}`;
                } else if (tags.title) {
                    trackNameDisplay.textContent = tags.title;
                }

                // Update bitrate and sample rate
                if (tags.bitrate && kbpsDisplay) {
                    kbpsDisplay.textContent = Math.round(tags.bitrate / 1000);
                }
                if (tags.sampleRate && khzDisplay) {
                    khzDisplay.textContent = Math.round(tags.sampleRate / 1000);
                }
            }
        } else {
            // Fallback for browser testing
            const tags = await readID3Tags(filePath);
            if (tags.title) {
                if (!trackMetadata[filePath]) {
                    trackMetadata[filePath] = { title: tags.title, artist: tags.artist };
                    renderPlaylist();
                }
                if (tags.artist) {
                    trackNameDisplay.textContent = `${tags.artist} - ${tags.title}`;
                } else {
                    trackNameDisplay.textContent = tags.title;
                }
            }
        }
    }
}

// Skin Loading Logic
async function applySkin(file) {
    try {
        const zip = new JSZip();
        const contents = await zip.loadAsync(file);

        const extractImage = async (filename) => {
            const fileKey = Object.keys(contents.files).find(
                key => key.toLowerCase() === filename.toLowerCase()
            );
            if (fileKey) {
                const fileData = await contents.files[fileKey].async("blob");
                return URL.createObjectURL(fileData);
            }
            return null;
        };

        const extractSpriteRegion = async (filename, x, y, width, height) => {
            const url = await extractImage(filename);
            if (!url) return null;
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, x, y, width, height, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/png'));
                };
                img.src = url;
            });
        };

        // Extract and parse PLEDIT.TXT and VISCOLOR.TXT for colors
        const extractText = async (filename) => {
            const fileKey = Object.keys(contents.files).find(
                key => key.toLowerCase() === filename.toLowerCase()
            );
            if (fileKey) {
                return await contents.files[fileKey].async("text");
            }
            return null;
        };

        const pleditTxt = await extractText('pledit.txt');
        if (pleditTxt) {
            const colors = {};
            pleditTxt.split('\n').forEach(line => {
                const parts = line.split('=');
                if (parts.length >= 2) {
                    const key = parts[0].trim().toLowerCase();
                    const value = parts[1].trim();
                    colors[key] = value;
                }
            });

            if (colors.normal) {
                document.documentElement.style.setProperty('--skin-playlist-text-normal', colors.normal);
                document.documentElement.style.setProperty('--skin-display-color', colors.normal);
            }
            if (colors.current) document.documentElement.style.setProperty('--skin-playlist-text-current', colors.current);
            if (colors.normalbg) document.documentElement.style.setProperty('--skin-playlist-bg-normal', colors.normalbg);
            if (colors.selectedbg) document.documentElement.style.setProperty('--skin-playlist-bg-selected', colors.selectedbg);
        }

        const viscolorTxt = await extractText('viscolor.txt');
        if (viscolorTxt) {
            const lines = viscolorTxt.split('\n')
                .map(line => line.split('//')[0].trim())
                .filter(line => line.length > 0);

            if (lines.length >= 24) {
                // Winamp viscolor.txt has 24 colors
                const newVisColors = lines.slice(0, 24).map(line => {
                    const rgb = line.split(',').map(c => c.trim());
                    return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
                });
                visColors = newVisColors;
            }

            if (lines[0]) {
                const rgb = lines[0].split(',').map(c => c.trim());
                if (rgb.length >= 3) {
                    document.documentElement.style.setProperty('--skin-vis-bg', `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`);
                    // Use index 0 as display fallback if PLEDIT didn't provide one
                    if (!document.documentElement.style.getPropertyValue('--skin-display-color')) {
                        document.documentElement.style.setProperty('--skin-display-color', `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`);
                    }
                }
            }
        }

        // Extract all skin images
        const mainBmpUrl = await extractImage('main.bmp');
        if (mainBmpUrl) document.documentElement.style.setProperty('--skin-main-bg', `url("${mainBmpUrl}")`);

        const titlebarBmpUrl = await extractImage('titlebar.bmp');
        if (titlebarBmpUrl) document.documentElement.style.setProperty('--skin-titlebar-bg', `url("${titlebarBmpUrl}")`);

        const cbuttonsBmpUrl = await extractImage('cbuttons.bmp');
        if (cbuttonsBmpUrl) document.documentElement.style.setProperty('--skin-cbuttons-bg', `url("${cbuttonsBmpUrl}")`);

        const pleditBmpUrl = await extractImage('pledit.bmp');
        if (pleditBmpUrl) document.documentElement.style.setProperty('--skin-pledit-bg', `url("${pleditBmpUrl}")`);

        const shufrepBmpUrl = await extractImage('shufrep.bmp');
        if (shufrepBmpUrl) document.documentElement.style.setProperty('--skin-shufrep-bg', `url("${shufrepBmpUrl}")`);

        const volumeBmpUrl = await extractImage('volume.bmp');
        if (volumeBmpUrl) document.documentElement.style.setProperty('--skin-volume-bg', `url("${volumeBmpUrl}")`);

        const balanceBmpUrl = await extractImage('balance.bmp');
        if (balanceBmpUrl) document.documentElement.style.setProperty('--skin-balance-bg', `url("${balanceBmpUrl}")`);

        const textBmpUrl = await extractImage('text.bmp');
        if (textBmpUrl) document.documentElement.style.setProperty('--skin-text-bg', `url("${textBmpUrl}")`);

        const numbersBmpUrl = await extractImage('numbers.bmp');
        if (numbersBmpUrl) document.documentElement.style.setProperty('--skin-numbers-bg', `url("${numbersBmpUrl}")`);

        const posbarBmpUrl = await extractImage('posbar.bmp');
        if (posbarBmpUrl) document.documentElement.style.setProperty('--skin-posbar-bg', `url("${posbarBmpUrl}")`);

        const genBmpUrl = await extractImage('gen.bmp');
        if (genBmpUrl) document.documentElement.style.setProperty('--skin-gen-bg', `url("${genBmpUrl}")`);

        // Extract specific playlist border slices so they can cleanly repeat-y in CSS purely as a 29px tile
        const pleditLeftUrl = await extractSpriteRegion('pledit.bmp', 0, 42, 12, 29);
        if (pleditLeftUrl) document.documentElement.style.setProperty('--skin-pledit-left', `url("${pleditLeftUrl}")`);

        // Right border slice (at x=31 in pledit.bmp, width=20)
        const pleditRightUrl = await extractSpriteRegion('pledit.bmp', 31, 42, 20, 29);
        if (pleditRightUrl) document.documentElement.style.setProperty('--skin-pledit-right', `url("${pleditRightUrl}")`);

        const pleditBottomLeftUrl = await extractSpriteRegion('pledit.bmp', 0, 72, 125, 38);
        if (pleditBottomLeftUrl) document.documentElement.style.setProperty('--skin-pledit-bottom-left', `url("${pleditBottomLeftUrl}")`);

        // Skip 1px potential cyan divider at x=125 in some skins
        const pleditBottomRightUrl = await extractSpriteRegion('pledit.bmp', 126, 72, 149, 38);
        if (pleditBottomRightUrl) document.documentElement.style.setProperty('--skin-pledit-bottom-right', `url("${pleditBottomRightUrl}")`);

        const pleditBottomFillUrl = await extractSpriteRegion('pledit.bmp', 179, 0, 25, 38);
        if (pleditBottomFillUrl) document.documentElement.style.setProperty('--skin-pledit-bottom-fill', `url("${pleditBottomFillUrl}")`);

        // List Opts Pop-up Menu (NEW | SAVE | LOAD) - 22 width x 42 height
        const pleditMenuUrl = await extractSpriteRegion('pledit.bmp', 43, 42, 22, 42);
        if (pleditMenuUrl) document.documentElement.style.setProperty('--skin-pledit-menu-bg', `url("${pleditMenuUrl}")`);

        const pleditTopLeftUrl = await extractSpriteRegion('pledit.bmp', 0, 21, 25, 20);
        if (pleditTopLeftUrl) document.documentElement.style.setProperty('--skin-pledit-top-left', `url("${pleditTopLeftUrl}")`);

        const pleditTopRightUrl = await extractSpriteRegion('pledit.bmp', 153, 21, 25, 20);
        if (pleditTopRightUrl) document.documentElement.style.setProperty('--skin-pledit-top-right', `url("${pleditTopRightUrl}")`);

        const pleditTopFillUrl = await extractSpriteRegion('pledit.bmp', 127, 21, 25, 20);
        if (pleditTopFillUrl) document.documentElement.style.setProperty('--skin-pledit-top-fill', `url("${pleditTopFillUrl}")`);

        const pleditScrollHandleUrl = await extractSpriteRegion('pledit.bmp', 52, 53, 8, 18);
        if (pleditScrollHandleUrl) document.documentElement.style.setProperty('--skin-pledit-scroll-handle', `url("${pleditScrollHandleUrl}")`);

        // Apply skin-active class NOW — before any optional thumb styling
        document.body.classList.add('skin-active');

        // Set TRACK backgrounds from sprite rows — each row has the fill baked in
        // volume.bmp: 68×433, 28 rows × 15px. Row 27=full bar.
        if (volumeBmpUrl) {
            updateVolumeTrack(volumeValue, volumeBmpUrl);
            const vFill = document.getElementById('volume-fill');
            if (vFill) vFill.style.display = 'none';
        }
        if (balanceBmpUrl) {
            updatePanTrack(panValue, balanceBmpUrl);
            const pFill = document.getElementById('pan-fill');
            if (pFill) pFill.style.display = 'none';
        }

        // Apply knob sprite to thumbs (null-safe)
        const vThumb = document.getElementById('volume-thumb');
        const pThumb = document.getElementById('pan-thumb');
        if (vThumb && volumeBmpUrl) {
            vThumb.style.backgroundImage = `url("${volumeBmpUrl}")`;
            vThumb.style.backgroundRepeat = 'no-repeat';
            vThumb.style.backgroundPosition = '0px -420px';
            vThumb.style.backgroundSize = 'auto auto';
            vThumb.style.backgroundColor = 'transparent';
            vThumb.style.border = 'none';
        }
        if (pThumb && balanceBmpUrl) {
            pThumb.style.backgroundImage = `url("${balanceBmpUrl}")`;
            pThumb.style.backgroundRepeat = 'no-repeat';
            pThumb.style.backgroundPosition = '0px -420px';
            pThumb.style.backgroundSize = 'auto auto';
            pThumb.style.backgroundColor = 'transparent';
            pThumb.style.border = 'none';
        }

        console.log("Skin applied successfully!");
    } catch (e) {
        console.error("Failed to parse skin:", e);
        if (playlistItemsContainer) {
            playlistItemsContainer.innerHTML = `<li style="color:red">Skin Error: ${e.message}</li>`;
        }
    }
}

// Update the volume slider fill row from volume.bmp based on current ratio
// Set volume TRACK background from volume.bmp row (row 0=empty, row 27=full)
// The entire bar image is 68px wide – each row already has fill baked in
function updateVolumeTrack(ratio, bmpUrl) {
    const track = document.getElementById('volume-slider');
    if (!track || !bmpUrl) return;
    const row = Math.round(ratio * 27);
    track.style.backgroundImage = `url("${bmpUrl}")`;
    track.style.backgroundRepeat = 'no-repeat';
    track.style.backgroundPosition = `0px ${-row * 15}px`;
    track.style.backgroundSize = 'auto auto';
    track.style.backgroundColor = 'transparent';
}

// Set pan TRACK background from balance.bmp row (row 0=full-left, 13=center, 27=full-right)
function updatePanTrack(ratio, bmpUrl) {
    const track = document.getElementById('pan-slider');
    if (!track || !bmpUrl) return;
    const row = Math.round(ratio * 27);
    track.style.backgroundImage = `url("${bmpUrl}")`;
    track.style.backgroundRepeat = 'no-repeat';
    track.style.backgroundPosition = `0px ${-row * 15}px`;
    track.style.backgroundSize = 'auto auto';
    track.style.backgroundColor = 'transparent';
}



// UI Elements for playback
const seekThumb = document.getElementById('seek-thumb');
const seekSlider = document.getElementById('seek-slider');
if (!window.isSeekingDeclared) {
    window.isSeeking = false;
    window.isSeekingDeclared = true;
}

const seekControl = makeDraggableSlider(
    seekSlider,
    seekThumb,
    0,
    (ratio) => {
        const duration = audio.duration || window.currentTrackDuration;
        if (duration) {
            audio.currentTime = ratio * duration;
        }
    },
    () => { window.isSeeking = true; },
    () => { window.isSeeking = false; }
);

// Audio element event listeners
audio.addEventListener('timeupdate', () => {
    const duration = audio.duration || window.currentTrackDuration;
    if (!window.isSeeking && duration) {
        seekControl.setValue(audio.currentTime / duration);
    }
});

audio.addEventListener('ended', () => {
    if (!window.isSeeking) {
        seekControl.setValue(1.0);
        playNextTrack(true); // true means it was an automatic end
    }
});

function playNextTrack(isAuto = false) {
    if (trackList.length === 0) return;

    if (window.playerState.isShuffle) {
        let nextIndex;
        if (trackList.length > 1) {
            do {
                nextIndex = Math.floor(Math.random() * trackList.length);
            } while (nextIndex === currentTrackIndex);
        } else {
            nextIndex = 0;
        }
        console.log(`Shuffle: picking track ${nextIndex + 1}`);
        loadTrack(nextIndex);
    } else {
        if (currentTrackIndex < trackList.length - 1) {
            loadTrack(currentTrackIndex + 1);
        } else if (window.playerState.isRepeat) {
            console.log('Repeat: looping to start');
            loadTrack(0);
        } else if (!isAuto) {
            // Manual click on last track loops to start
            loadTrack(0);
        }
    }
}

function playPrevTrack() {
    if (trackList.length === 0) return;

    if (audio.currentTime > 3) {
        audio.currentTime = 0;
    } else {
        if (window.playerState.isShuffle) {
            let prevIndex;
            if (trackList.length > 1) {
                do {
                    prevIndex = Math.floor(Math.random() * trackList.length);
                } while (prevIndex === currentTrackIndex);
            } else {
                prevIndex = 0;
            }
            loadTrack(prevIndex);
        } else {
            if (currentTrackIndex > 0) {
                loadTrack(currentTrackIndex - 1);
            } else {
                loadTrack(trackList.length - 1);
            }
        }
    }
}

// Global UI state updater
function updateToggleButtons() {
    const sBtn = document.getElementById('btn-shuffle');
    const rBtn = document.getElementById('btn-repeat');
    if (sBtn) sBtn.classList.toggle('active', window.playerState.isShuffle);
    if (rBtn) rBtn.classList.toggle('active', window.playerState.isRepeat);
}

// Delegated click listener for UI controls
document.addEventListener('click', (e) => {
    const toggle = e.target.closest('.toggle-btn');
    if (toggle) {
        toggleShuffleRepeat(toggle.id);
    }
});

function toggleShuffleRepeat(id) {
    if (id === 'btn-shuffle') {
        window.playerState.isShuffle = !window.playerState.isShuffle;
        console.log('Shuffle toggled:', window.playerState.isShuffle);
    } else if (id === 'btn-repeat') {
        window.playerState.isRepeat = !window.playerState.isRepeat;
        console.log('Repeat toggled:', window.playerState.isRepeat);
    }
    updateToggleButtons();
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Reserved for future use (e.g. search)
});

// Actions
btnPlay.addEventListener('click', () => {
    if (audio.src) {
        audio.play();
        startVisualizer();
    } else if (trackList.length > 0) {
        loadTrack(0);
    }
});

btnPause.addEventListener('click', () => {
    audio.pause();
});

btnStop.addEventListener('click', () => {
    audio.pause();
    audio.currentTime = 0;
    timeDisplay.textContent = "00:00";
    // Clear visualizer heights
    barHeights.fill(0);
    peaks.fill(0);
});

btnNext.addEventListener('click', () => {
    playNextTrack(false);
});

btnPrev.addEventListener('click', () => {
    playPrevTrack();
});

// Ensure initial UI state
updateToggleButtons();

volumeSlider.addEventListener('click', () => { /* handled by makeDraggableSlider */ });

// Load files via IPC
if (window.electronAPI) {
    // Eject button (Main Window) - REPLACES playlist
    btnEject.addEventListener('click', async () => {
        const filePaths = await window.electronAPI.openFileDialog();
        if (filePaths && filePaths.length > 0) {
            trackList = filePaths;
            filePaths.forEach(fetchMetadata);
            loadTrack(0);
        }
    });

    // ADD button (Playlist Window) - APPENDS to playlist
    const btnPlAdd = document.getElementById('pl-btn-add');
    if (btnPlAdd) {
        btnPlAdd.addEventListener('click', async () => {
            const filePaths = await window.electronAPI.openFileDialog();
            if (filePaths && filePaths.length > 0) {
                const wasEmpty = trackList.length === 0;
                // Avoid duplicates by filtering (optional, but good practice)
                const newPaths = filePaths.filter(p => !trackList.includes(p));
                trackList = trackList.concat(newPaths);
                newPaths.forEach(fetchMetadata);

                renderPlaylist();

                // If the playlist was empty and nothing is currently playing, start playing
                if (wasEmpty && !audio.src && trackList.length > 0) {
                    loadTrack(0);
                }
            }
        });
    }

    // Playlist Save/Load Buttons
    const btnPlListOpts = document.getElementById('pl-btn-list-opts');
    const plListOptsMenu = document.getElementById('pl-list-opts-menu');

    const btnPlNew = document.getElementById('pl-btn-list-new');
    const btnPlSave = document.getElementById('pl-btn-list-save');
    const btnPlLoad = document.getElementById('pl-btn-list-load');

    if (btnPlListOpts && plListOptsMenu) {
        btnPlListOpts.addEventListener('click', (e) => {
            e.stopPropagation(); // prevent window click from immediately closing it
            plListOptsMenu.classList.toggle('collapsed');
        });

        // Click outside to close map
        window.addEventListener('click', (e) => {
            if (!plListOptsMenu.contains(e.target) && e.target !== btnPlListOpts) {
                if (!plListOptsMenu.classList.contains('collapsed')) {
                    plListOptsMenu.classList.add('collapsed');
                }
            }
        });
    }

    if (btnPlNew) {
        btnPlNew.addEventListener('click', () => {
            trackList = [];
            currentTrackIndex = -1;
            audio.src = '';
            document.querySelector('.marquee span').textContent = '*** QUILAMP *** WINAMP CLONE ***';
            timeDisplay.textContent = '00:00';
            renderPlaylist();
        });
    }

    if (btnPlSave) {
        btnPlSave.addEventListener('click', async () => {
            if (trackList.length > 0) {
                await window.electronAPI.savePlaylist(trackList);
            }
        });
    }

    if (btnPlLoad) {
        btnPlLoad.addEventListener('click', async () => {
            const loadedTracks = await window.electronAPI.loadPlaylist();
            if (loadedTracks && loadedTracks.length > 0) {
                trackList = loadedTracks;
                loadedTracks.forEach(fetchMetadata);
                renderPlaylist();
                loadTrack(0);
            }
        });
    }

    // Drag and Drop support
    document.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
    });

    document.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const files = Array.from(e.dataTransfer.files);

            // Collect audio files separately from skins
            const audioPaths = [];

            files.forEach(file => {
                if (file.name.toLowerCase().endsWith('.wsz') || file.name.toLowerCase().endsWith('.zip')) {
                    applySkin(file);
                } else {
                    audioPaths.push(file.path);
                }
            });

            if (audioPaths.length > 0) {
                trackList = trackList.concat(audioPaths);
                audioPaths.forEach(fetchMetadata);
                if (!audio.src) {
                    loadTrack(trackList.length - audioPaths.length); // Play first newly added track
                }
                renderPlaylist();
            }
        }
    });

    // Right-click Context Menu
    window.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        window.electronAPI.showContextMenu();
    });

    // Handle skin loading from context menu
    window.electronAPI.onLoadSkin(async (data) => {
        if (data.isDir) {
            // Directory skins not fully supported yet in this JSZip-based flow
            console.warn("Directory skins not yet supported via context menu");
            return;
        }
        const buffer = await window.electronAPI.readSkinFile(data.path);
        if (buffer) {
            const blob = new Blob([buffer]);
            applySkin(blob);
        }
    });

    // Handle reset skin
    window.electronAPI.onResetSkin(() => {
        document.body.classList.remove('skin-active');
        // Clear skin variables
        const props = [
            '--skin-main-bg', '--skin-titlebar-bg', '--skin-cbuttons-bg', '--skin-pledit-bg',
            '--skin-shufrep-bg', '--skin-volume-bg', '--skin-balance-bg', '--skin-text-bg',
            '--skin-numbers-bg', '--skin-posbar-bg', '--skin-gen-bg', '--skin-pledit-left',
            '--skin-pledit-right', '--skin-pledit-bottom-left', '--skin-pledit-bottom-right',
            '--skin-pledit-bottom-fill', '--skin-pledit-menu-bg', '--skin-pledit-top-left',
            '--skin-pledit-top-right', '--skin-pledit-top-fill', '--skin-pledit-scroll-handle'
        ];
        props.forEach(p => document.documentElement.style.removeProperty(p));

        // Reset slider backgrounds
        const vTrack = document.getElementById('volume-slider');
        const pTrack = document.getElementById('pan-slider');
        if (vTrack) vTrack.style.backgroundImage = '';
        if (pTrack) pTrack.style.backgroundImage = '';

        // Reset fill displays
        const vFill = document.getElementById('volume-fill');
        const pFill = document.getElementById('pan-fill');
        if (vFill) vFill.style.display = '';
        if (pFill) pFill.style.display = '';

        // Reset thumbs
        const vThumb = document.getElementById('volume-thumb');
        const pThumb = document.getElementById('pan-thumb');
        if (vThumb) vThumb.style.cssText = '';
        if (pThumb) pThumb.style.cssText = '';

        console.log("Skin reset to default");
    });

    window.electronAPI.onAddTracks((paths) => {
        if (paths && paths.length > 0) {
            const wasEmpty = trackList.length === 0;
            const newPaths = paths.filter(p => !trackList.includes(p));
            trackList = trackList.concat(newPaths);
            newPaths.forEach(fetchMetadata);
            renderPlaylist();
            if (wasEmpty && !audio.src && trackList.length > 0) {
                loadTrack(0);
            }
        }
    });

} else {
    console.warn("Running in browser, local file loading via dialog not available.");
}
