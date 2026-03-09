// Import JSZip for skin parsing
import JSZip from 'jszip';
import './style.css';

// Basic audio player state
const audio = new Audio();
let trackList = [];
let currentTrackIndex = -1;

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

// Custom slider state
let volumeValue = 1.0; // 0-1
let panValue = 0.5;    // 0-1 (0.5 = center)

// CSS zoom factor applied to the body — needed to correct getBoundingClientRect coordinates
const CSS_ZOOM = 1.5;

function makeDraggableSlider(track, thumb, initialValue, onChange, onStart, onEnd) {
    let dragging = false;
    let value = initialValue;

    function positionThumb(ratio) {
        const trackWidth = track.getBoundingClientRect().width / CSS_ZOOM;
        const thumbWidth = thumb.getBoundingClientRect().width / CSS_ZOOM;
        thumb.style.left = `${Math.round(ratio * (trackWidth - thumbWidth))}px`;
    }

    function update(e) {
        const rect = track.getBoundingClientRect();
        const trackWidth = rect.width / CSS_ZOOM;
        const thumbWidth = thumb.getBoundingClientRect().width / CSS_ZOOM;

        // Calculate mouse position relative to track in CSS pixels
        let mouseX = (e.clientX - rect.left) / CSS_ZOOM;

        // Standard slider behavior: center knob on mouse click, but clamp to bounds
        let targetLeft = mouseX - (thumbWidth / 2);
        let maxLeft = trackWidth - thumbWidth;
        let clampedLeft = Math.max(0, Math.min(maxLeft, targetLeft));

        // Ratio is for the onChange callback (0 to 1)
        value = maxLeft > 0 ? clampedLeft / maxLeft : 0;

        thumb.style.left = `${Math.round(clampedLeft)}px`;
        onChange(value);
    }

    // Set initially
    positionThumb(value);
    // And again after a short delay in case of font/layout shifts
    setTimeout(() => positionThumb(value), 150);

    // Thumb mousedown: start drag, prevent bubbling to track
    thumb.addEventListener('mousedown', (e) => {
        dragging = true;
        if (onStart) onStart();
        e.preventDefault();
        e.stopPropagation();
    });

    // Track mousedown: click on track to jump there, then allow drag
    track.addEventListener('mousedown', (e) => {
        dragging = true;
        if (onStart) onStart();
        e.preventDefault();
        update(e);
    });

    document.addEventListener('mousemove', (e) => {
        if (dragging) update(e);
    });

    document.addEventListener('mouseup', () => {
        if (dragging && onEnd) onEnd();
        dragging = false;
    });

    return {
        getValue: () => value,
        setValue: (v) => { value = v; positionThumb(v); }
    };
}

const volumeControl = makeDraggableSlider(volumeSlider, volumeThumb, 1.0, (ratio) => {
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
audio.addEventListener('timeupdate', () => {
    timeDisplay.textContent = formatTime(audio.currentTime);
});

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

// Render Playlist
function renderPlaylist() {
    playlistItemsContainer.innerHTML = '';
    trackList.forEach((filePath, index) => {
        const fileName = filePath.split('/').pop().split('\\').pop();
        const li = document.createElement('li');
        li.textContent = `${index + 1}. ${fileName}`;

        if (index === currentTrackIndex) {
            li.classList.add('active');
        }

        li.addEventListener('dblclick', () => {
            loadTrack(index);
        });
        playlistItemsContainer.appendChild(li);
    });
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
        renderPlaylist();

        // Try to read ID3 tags
        const tags = await readID3Tags(filePath);
        if (tags.artist && tags.title) {
            trackNameDisplay.textContent = `${tags.artist} - ${tags.title}`;
        } else if (tags.title) {
            trackNameDisplay.textContent = tags.title;
        }
        // else keep the filename
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
        if (audio.duration) {
            audio.currentTime = ratio * audio.duration;
        }
    },
    () => { window.isSeeking = true; },
    () => { window.isSeeking = false; }
);

// Audio element event listeners
audio.addEventListener('timeupdate', () => {
    if (!window.isSeeking && audio.duration) {
        seekControl.setValue(audio.currentTime / audio.duration);
    }
});

// Actions
btnPlay.addEventListener('click', () => {
    if (audio.src) {
        audio.play();
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
});

btnNext.addEventListener('click', () => {
    if (currentTrackIndex < trackList.length - 1) {
        loadTrack(currentTrackIndex + 1);
    }
});

btnPrev.addEventListener('click', () => {
    if (audio.currentTime > 3) {
        // restart song if > 3s in
        audio.currentTime = 0;
    } else if (currentTrackIndex > 0) {
        // go to previous if <= 3s in
        loadTrack(currentTrackIndex - 1);
    }
});

volumeSlider.addEventListener('click', () => { /* handled by makeDraggableSlider */ });

// Load files via IPC
if (window.electronAPI) {
    // Eject button (Main Window) - REPLACES playlist
    btnEject.addEventListener('click', async () => {
        const filePaths = await window.electronAPI.openFileDialog();
        if (filePaths && filePaths.length > 0) {
            trackList = filePaths;
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

                renderPlaylist();

                // If the playlist was empty and nothing is currently playing, start playing
                if (wasEmpty && !audio.src && trackList.length > 0) {
                    loadTrack(0);
                }
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
                if (!audio.src) {
                    loadTrack(trackList.length - audioPaths.length); // Play first newly added track
                }
                renderPlaylist();
            }
        }
    });
} else {
    console.warn("Running in browser, local file loading via dialog not available.");
}

// Ensure the Electron OS Window accurately resizes when the CSS container resizes
const appContainer = document.getElementById('app-container');
if (appContainer && window.electronAPI && window.electronAPI.resizeWindow) {
    const resizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
            // Apply zoom factor correction since the CSS width/height are zoomed by body
            const zoomedWidth = Math.ceil(entry.contentRect.width * CSS_ZOOM);
            const zoomedHeight = Math.ceil(entry.contentRect.height * CSS_ZOOM);

            // Only trigger if actually resized
            window.electronAPI.resizeWindow(zoomedWidth, zoomedHeight);
        }
    });

    resizeObserver.observe(appContainer);
}
